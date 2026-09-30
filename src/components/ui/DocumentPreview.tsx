"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ExternalLink, Loader2, RotateCw, Maximize2, Minimize2 } from "lucide-react";
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
 *
 * NO TELEMÓVEL, o problema não é abrir — é LER.
 *
 * Um cartão de cidadão é deitado; o telemóvel é ao alto. Encaixado inteiro
 * numa caixa de 62vh, o documento ficava com uns três centímetros de largura
 * e era preciso afastar os dedos para ler o número — e depois arrastar para
 * encontrar o resto.
 *
 * Daí os dois botões: RODAR, que põe um documento deitado a ocupar o ecrã ao
 * alto, e ENCHER, que troca "cabe todo" por "ocupa a largura toda, rola-se o
 * que sobra". Juntos resolvem o caso normal sem se tocar no zoom.
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
  const [rotacao, setRotacao] = useState(0);
  /** `largura` enche o ecrã e deixa rolar; `cabe` mostra o documento inteiro. */
  const [ajuste, setAjuste] = useState<"cabe" | "largura">("cabe");

  useEffect(() => {
    if (!docId) return;
    let revoked = false;
    let created: string | null = null;
    setLoading(true);
    // Documento novo, vista nova: herdar a rotação do anterior deixava o
    // seguinte de lado sem se perceber porquê.
    setRotacao(0);
    setAjuste("cabe");
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
  const deitado = rotacao % 180 !== 0;

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
        <div
          className={cn(
            "rounded-xl border border-surface-border bg-surface-muted",
            heightClass,
            ajuste === "cabe"
              ? "flex items-center justify-center overflow-hidden"
              // `overflow-auto` com arrasto nativo: é assim que se percorre um
              // documento grande sem o beliscar para dentro e para fora.
              : "overflow-auto [-webkit-overflow-scrolling:touch]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Documento submetido"
            onError={() => setImgError(true)}
            style={{ transform: `rotate(${rotacao}deg)` }}
            className={cn(
              "origin-center transition-transform duration-200",
              ajuste === "cabe"
                ? "max-h-full max-w-full object-contain"
                // Rodado, é a ALTURA que passa a encher a largura do ecrã --
                // por isso a medida troca com a rotação.
                : deitado ? "h-auto max-w-none w-[max(100%,theme(spacing.96))]" : "w-full max-w-none h-auto",
            )}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setRotacao((r) => (r + 90) % 360)}
            className="btn-secondary text-xs"
            title="Um documento deitado ocupa o ecrã todo se o rodares"
          >
            <RotateCw className="h-3.5 w-3.5" /> Rodar
          </button>
          <button
            type="button"
            onClick={() => setAjuste((a) => (a === "cabe" ? "largura" : "cabe"))}
            className="btn-secondary text-xs"
          >
            {ajuste === "cabe"
              ? <><Maximize2 className="h-3.5 w-3.5" /> Encher</>
              : <><Minimize2 className="h-3.5 w-3.5" /> Ver todo</>}
          </button>
          {openLink}
        </div>
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
