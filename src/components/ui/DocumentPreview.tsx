"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { getVendorDocumentBlobUrl } from "@/services/vendorDocumentsService";

/** Deduz o tipo do ficheiro pela extensão (ignora query string de URLs assinados). */
function fileKind(url: string): "image" | "pdf" | "other" {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)$/.test(path)) return "image";
  if (/\.pdf$/.test(path)) return "pdf";
  return "other";
}

/**
 * Pré-visualização inline de um documento (imagem ou PDF) — para rever KYC sem
 * descarregar.
 *
 * Quando recebe `docId`, busca o ficheiro pelo proxy autenticado (que o serve
 * com `Content-Disposition: inline`) e mostra-o a partir de um `blob:`. É o que
 * garante que ABRE em vez de descarregar, mesmo quando o armazenamento manda
 * `attachment` ou bloqueia o embed com X-Frame-Options. Sem `docId` (ou se o
 * proxy falhar) usa o `url` diretamente.
 */
export function DocumentPreview({ url, docId, className, heightClass = "h-[62vh]" }: {
  url: string;
  docId?: number;
  className?: string;
  heightClass?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!docId);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!docId) return;
    let revoked = false;
    let created: string | null = null;
    setLoading(true);
    getVendorDocumentBlobUrl(docId)
      .then((u) => {
        if (revoked) { if (u) URL.revokeObjectURL(u); return; }
        created = u;
        setBlobUrl(u);
      })
      .catch(() => setBlobUrl(null)) // cai para o url direto
      .finally(() => !revoked && setLoading(false));
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [docId]);

  const src = blobUrl ?? url;
  // O tipo vem sempre do URL original: um blob: não tem extensão.
  const kind = fileKind(url);

  const openLink = (
    <a href={src} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
      <ExternalLink className="h-3.5 w-3.5" /> Abrir noutro separador
    </a>
  );

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-surface-border bg-surface-muted", heightClass, className)}>
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> A abrir o documento…
        </span>
      </div>
    );
  }

  if (kind === "image" && !imgError) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className={cn("flex items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-surface-muted", heightClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Documento submetido" onError={() => setImgError(true)} className="max-h-full max-w-full object-contain" />
        </div>
        <div className="flex justify-end">{openLink}</div>
      </div>
    );
  }

  // PDF (ou imagem que falhou, ex.: HEIC, ou tipo desconhecido).
  return (
    <div className={cn("space-y-2", className)}>
      <iframe src={src} title="Documento submetido" className={cn("w-full rounded-xl border border-surface-border bg-surface-muted", heightClass)} />
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <FileText className="h-3.5 w-3.5" /> Se não aparecer aqui, abre no browser (sem descarregar).
        </p>
        {openLink}
      </div>
    </div>
  );
}
