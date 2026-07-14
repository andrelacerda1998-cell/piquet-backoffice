import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { gunzipSync } from "node:zlib";

/**
 * App Store Connect — Sales Reports API.
 *
 * Devolve as unidades (downloads) diárias por SKU. Autenticação por JWT ES256
 * assinado com a chave .p8 gerada em App Store Connect → Users and Access →
 * Integrations → App Store Connect API (perfil Sales and Finance).
 *
 * Env necessárias (ver APP_STORES_SETUP.md):
 * - APPLE_ISSUER_ID       (UUID do issuer)
 * - APPLE_KEY_ID          (ID da chave, ex.: 2X9R4HXF34)
 * - APPLE_PRIVATE_KEY     (conteúdo do ficheiro .p8, com \n literais ou reais)
 * - APPLE_VENDOR_NUMBER   (Payments and Financial Reports → canto sup. esq.)
 * - APPLE_SKU_CLIENTE / APPLE_SKU_PRO  (SKU de cada app, definido ao criá-la)
 */

export function appleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_ISSUER_ID && process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY && process.env.APPLE_VENDOR_NUMBER
  );
}

async function appleToken(): Promise<string> {
  // A chave .p8 pode vir com `\n` escapados (limite das env vars de uma linha).
  const pem = (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID, typ: "JWT" })
    .setIssuer(process.env.APPLE_ISSUER_ID!)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}

/** Linha relevante do relatório de vendas (TSV). */
export interface AppleSalesRow {
  sku: string;
  units: number;
  productTypeIdentifier: string;
}

/** Parser puro do TSV de Sales Reports (exportado para testes). */
export function parseAppleSalesTsv(tsv: string): AppleSalesRow[] {
  const lines = tsv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  const iSku = headers.indexOf("SKU");
  const iUnits = headers.indexOf("Units");
  const iType = headers.indexOf("Product Type Identifier");
  if (iSku < 0 || iUnits < 0) return [];
  return lines.slice(1).map((l) => {
    const c = l.split("\t");
    return {
      sku: c[iSku] ?? "",
      units: Number(c[iUnits] ?? 0) || 0,
      productTypeIdentifier: iType >= 0 ? (c[iType] ?? "") : "",
    };
  });
}

/**
 * Downloads (units) de UM dia, por app.
 * `date` em YYYY-MM-DD. Devolve null se o relatório desse dia ainda não existe
 * (a Apple publica com ~1 dia de atraso) — o cron tenta no dia seguinte.
 */
export async function fetchAppleDownloads(date: string): Promise<{ cliente: number; profissional: number } | null> {
  const token = await appleToken();
  const params = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportDate]": date,
    "filter[reportSubType]": "SUMMARY",
    "filter[reportType]": "SALES",
    "filter[vendorNumber]": process.env.APPLE_VENDOR_NUMBER!,
  });
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" },
  });
  if (res.status === 404) return null; // relatório ainda não disponível
  if (!res.ok) throw new Error(`App Store Connect ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const tsv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf-8");
  const rows = parseAppleSalesTsv(tsv);

  const skuCliente = process.env.APPLE_SKU_CLIENTE ?? "";
  const skuPro = process.env.APPLE_SKU_PRO ?? "";
  // Product Type "1"/"1F"/"1T" = downloads de app (exclui re-downloads/updates).
  const isDownload = (t: string) => t === "" || t.startsWith("1");
  const sum = (sku: string) =>
    rows.filter((r) => r.sku === sku && isDownload(r.productTypeIdentifier)).reduce((s, r) => s + r.units, 0);

  return { cliente: skuCliente ? sum(skuCliente) : 0, profissional: skuPro ? sum(skuPro) : 0 };
}
