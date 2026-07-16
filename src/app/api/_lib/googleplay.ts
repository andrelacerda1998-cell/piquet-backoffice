import "server-only";
import { SignJWT, importPKCS8 } from "jose";

/**
 * Google Play Console — estatísticas de instalações.
 *
 * A Google publica os downloads como CSVs mensais num bucket GCS do Play
 * Console (`pubsite_prod_rev_…/stats/installs/`). Lemos o "overview" mensal de
 * cada package com uma service account (OAuth2 JWT RS256 → access token).
 *
 * Env necessárias (ver APP_STORES_SETUP.md):
 * - GOOGLE_SA_EMAIL        (email da service account)
 * - GOOGLE_SA_PRIVATE_KEY  (private_key do JSON da service account)
 * - GOOGLE_PLAY_BUCKET     (ex.: pubsite_prod_rev_01234567890987654321)
 * - GOOGLE_PACKAGE_CLIENTE / GOOGLE_PACKAGE_PRO (applicationId de cada app)
 */

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && process.env.GOOGLE_PLAY_BUCKET
  );
}

async function googleToken(): Promise<string> {
  const pem = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/devstorage.read_only" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(process.env.GOOGLE_SA_EMAIL!)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/** Instalações diárias extraídas do CSV mensal (exportado para testes). */
export function parseInstallsCsv(csv: string): Array<{ date: string; installs: number }> {
  // O CSV vem em UTF-16 já convertido; 1ª linha = cabeçalho.
  // Colunas típicas: Date, Package Name, Daily Device Installs, ...
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const iDate = headers.findIndex((h) => h === "date");
  const iInstalls = headers.findIndex((h) => h.includes("daily device installs") || h.includes("daily user installs"));
  if (iDate < 0 || iInstalls < 0) return [];
  return lines.slice(1)
    .map((l) => {
      const c = l.split(",");
      return { date: (c[iDate] ?? "").trim(), installs: Number(c[iInstalls] ?? 0) || 0 };
    })
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
}

/**
 * Instalações diárias de um package no mês `yyyymm` (ex.: "202607").
 * Devolve null se o CSV do mês ainda não existir no bucket.
 */
export async function fetchPlayInstalls(packageName: string, yyyymm: string): Promise<Array<{ date: string; installs: number }> | null> {
  const token = await googleToken();
  const bucket = process.env.GOOGLE_PLAY_BUCKET!;
  const object = encodeURIComponent(`stats/installs/installs_${packageName}_${yyyymm}_overview.csv`);
  const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${object}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null; // mês ainda sem relatório
  if (!res.ok) throw new Error(`Play stats ${res.status}: ${(await res.text()).slice(0, 200)}`);

  // Os CSVs do Play vêm em UTF-16LE.
  const buf = Buffer.from(await res.arrayBuffer());
  const csv = buf.includes(0) ? buf.toString("utf16le") : buf.toString("utf-8");
  return parseInstallsCsv(csv);
}

/* --------------------------- Avaliações na loja --------------------------- */

import type { StoreRating } from "./appstore";

/**
 * Avaliação da app no Google Play.
 *
 * 1.ª escolha: a página pública da loja (JSON-LD `aggregateRating`) — é o
 * número que os utilizadores veem e traz a contagem de votos.
 * Fallback: o CSV oficial `stats/ratings` do Play Console ("Total Average
 * Rating", sem contagem) — o Play esconde a avaliação da página pública
 * enquanto a app tem poucos votos, mas o CSV tem sempre a média real.
 */
export async function fetchPlayRating(packageName: string): Promise<StoreRating | null> {
  try {
    const res = await fetch(`https://play.google.com/store/apps/details?id=${packageName}&hl=pt_PT`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/"aggregateRating":\{"@type":"AggregateRating","ratingValue":"([\d.]+)","ratingCount":"(\d+)"\}/);
      if (m) return { rating: Number(m[1]), count: Number(m[2]), source: "loja" };
    }
  } catch {
    /* página indisponível → tenta o CSV */
  }

  if (!googleConfigured()) return null;
  const token = await googleToken();
  const bucket = process.env.GOOGLE_PLAY_BUCKET!;
  const now = new Date();
  // Mês corrente e anterior — no início do mês o CSV novo ainda não existe.
  for (const d of [now, new Date(now.getFullYear(), now.getMonth() - 1, 1)]) {
    const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    const object = encodeURIComponent(`stats/ratings/ratings_${packageName}_${yyyymm}_overview.csv`);
    const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${object}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const csv = (buf.includes(0) ? buf.toString("utf16le") : buf.toString("utf-8")).trim();
    const lines = csv.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const iTotal = headers.findIndex((h) => h.includes("total average rating"));
    if (iTotal < 0) continue;
    // Última linha do mês com média acumulada > 0.
    for (let i = lines.length - 1; i > 0; i--) {
      const total = Number(lines[i].split(",")[iTotal]);
      if (Number.isFinite(total) && total > 0) return { rating: total, count: null, source: "csv" };
    }
  }
  return null;
}
