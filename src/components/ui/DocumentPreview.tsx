"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ExternalLink } from "lucide-react";

/** Deduz o tipo do ficheiro pela extensão (ignora query string de URLs assinados). */
function fileKind(url: string): "image" | "pdf" | "other" {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)$/.test(path)) return "image";
  if (/\.pdf$/.test(path)) return "pdf";
  return "other";
}

/**
 * Pré-visualização inline de um documento (imagem ou PDF) — para rever KYC sem
 * descarregar. Imagens vão em <img> (nunca bloqueadas por framing); PDFs e
 * desconhecidos em <iframe>. Há sempre o atalho "abrir noutro separador" para os
 * casos que o browser não renderiza (ex.: HEIC do iPhone, ou host que bloqueia
 * o embed).
 */
export function DocumentPreview({ url, className, heightClass = "h-[62vh]" }: { url: string; className?: string; heightClass?: string }) {
  const kind = fileKind(url);
  const [imgError, setImgError] = useState(false);

  const openLink = (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
      <ExternalLink className="h-3.5 w-3.5" /> Abrir noutro separador
    </a>
  );

  if (kind === "image" && !imgError) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className={cn("flex items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-surface-muted", heightClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Documento submetido" onError={() => setImgError(true)} className="max-h-full max-w-full object-contain" />
        </div>
        <div className="flex justify-end">{openLink}</div>
      </div>
    );
  }

  // PDF (ou imagem que falhou, ex.: HEIC, ou tipo desconhecido): <iframe> renderiza
  // inline quando o host permite; se bloquear o embed (X-Frame-Options), fica a
  // dica + o atalho para abrir no browser (sem descarregar).
  return (
    <div className={cn("space-y-2", className)}>
      <iframe src={url} title="Documento submetido" className={cn("w-full rounded-xl border border-surface-border bg-surface-muted", heightClass)} />
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <FileText className="h-3.5 w-3.5" /> Se não aparecer aqui, abre no browser (sem descarregar).
        </p>
        {openLink}
      </div>
    </div>
  );
}
