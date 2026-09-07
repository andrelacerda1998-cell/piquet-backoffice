"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAnunciosMeta, mudarEstadoMeta, type MetaAnuncioUI } from "@/services/marketingService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Plus, Play, Pause, AlertTriangle, ImageOff, RefreshCw } from "lucide-react";

/**
 * Criativos REAIS da conta Meta, agrupados por campanha.
 *
 * Substitui a antiga aba "Criativos", que mostrava uma linha por campanha com
 * o formato "Imagem" escrito no código — não havia lá criativo nenhum. Aqui
 * vê-se a imagem que o cliente vê, a que campanha pertence e em que estado
 * está, e pode-se pausar ou activar sem sair do backoffice.
 *
 * As URLs das imagens são assinadas pela Meta e expiram, por isso lêem-se de
 * cada vez em vez de se guardarem.
 */

/** Estados da Meta em português, com o tom certo para um relance. */
function estadoUI(a: MetaAnuncioUI): { label: string; tone: string } {
  const e = (a.effectiveStatus || a.status || "").toUpperCase();
  if (e === "ACTIVE") return { label: "A correr", tone: "bg-success-light text-success" };
  if (e === "PAUSED" || e === "ADSET_PAUSED" || e === "CAMPAIGN_PAUSED") {
    return { label: "Em pausa", tone: "bg-surface-subtle text-text-secondary" };
  }
  if (e === "PENDING_REVIEW" || e === "IN_PROCESS") return { label: "Em revisão", tone: "bg-warning-light text-warning" };
  if (e === "DISAPPROVED" || e === "WITH_ISSUES") return { label: "Recusado", tone: "bg-danger-light text-danger" };
  if (e === "ARCHIVED" || e === "DELETED") return { label: "Arquivado", tone: "bg-surface-subtle text-text-muted" };
  return { label: e || "—", tone: "bg-surface-subtle text-text-muted" };
}

export function CriativosMeta({ onCriar }: { onCriar: () => void }) {
  const { data, loading, refetch } = useAsyncData(() => getAnunciosMeta(), []);
  const [aMudar, setAMudar] = useState<string | null>(null);

  const anuncios = useMemo(() => data?.ads ?? [], [data]);

  // Agrupados por campanha — é assim que se pensa nos anúncios, e responde à
  // pergunta "que campanhas tenho a correr?" sem uma lista à parte.
  const porCampanha = useMemo(() => {
    const m = new Map<string, { nome: string; itens: MetaAnuncioUI[] }>();
    for (const a of anuncios) {
      const k = a.campaignId ?? "sem-campanha";
      const atual = m.get(k) ?? { nome: a.campaignName ?? "Sem campanha", itens: [] };
      atual.itens.push(a);
      m.set(k, atual);
    }
    return [...m.entries()];
  }, [anuncios]);

  const alternar = async (a: MetaAnuncioUI) => {
    const activo = (a.effectiveStatus || a.status).toUpperCase() === "ACTIVE";
    setAMudar(a.id);
    try {
      await mudarEstadoMeta(a.id, activo ? "PAUSED" : "ACTIVE");
      toast(activo ? "Anúncio em pausa." : "Anúncio activado — passa a gastar orçamento.");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao mudar o estado.", "error");
    } finally {
      setAMudar(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Anúncios na Meta</h3>
          <p className="text-xs text-text-secondary">
            {anuncios.length > 0
              ? `${anuncios.length} anúncio(s) em ${porCampanha.length} campanha(s), lidos da conta ao vivo.`
              : "Criativos, campanhas e estados lidos diretamente da conta de anúncios."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="btn-secondary text-sm" title="Voltar a ler da Meta">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button onClick={onCriar} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Criar anúncio
          </button>
        </div>
      </div>

      {data?.error && (
        <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/30 px-4 py-3">
          <p className="text-sm font-medium text-text-primary flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" /> Não foi possível ler os anúncios
          </p>
          <p className="text-xs text-text-secondary mt-1">{data.error}</p>
        </div>
      )}

      {data && !data.configured && (
        <div className="rounded-xl border-l-[3px] border-l-warning bg-warning-light/30 px-4 py-3 text-sm text-text-secondary">
          Faltam <code>META_ACCESS_TOKEN</code> e <code>META_AD_ACCOUNT_ID</code> na Vercel.
        </div>
      )}

      {loading && anuncios.length === 0 && <p className="text-sm text-text-secondary">A ler a conta de anúncios…</p>}

      {!loading && !data?.error && anuncios.length === 0 && data?.configured && (
        <p className="text-sm text-text-secondary">Ainda não há anúncios nesta conta.</p>
      )}

      {porCampanha.map(([id, grupo]) => (
        <div key={id} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{grupo.nome}</p>
            <span className="text-[11px] text-text-muted">{grupo.itens.length} anúncio(s)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {grupo.itens.map((a) => {
              const st = estadoUI(a);
              const activo = (a.effectiveStatus || a.status).toUpperCase() === "ACTIVE";
              return (
                <div key={a.id} className="card overflow-hidden flex flex-col">
                  {a.imageUrl ? (
                    <Image src={a.imageUrl} alt={a.name} width={400} height={300} unoptimized
                      className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-surface-subtle flex flex-col items-center justify-center gap-1 text-text-muted">
                      <ImageOff className="h-5 w-5" />
                      <span className="text-[11px]">Sem imagem</span>
                    </div>
                  )}
                  <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary line-clamp-2">{a.name}</p>
                      <span className={cn("shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", st.tone)}>
                        {st.label}
                      </span>
                    </div>
                    {a.adsetName && <p className="text-[11px] text-text-muted truncate">{a.adsetName}</p>}
                    {a.texto && <p className="text-xs text-text-secondary line-clamp-2">{a.texto}</p>}
                    <div className="pt-1 mt-auto">
                      <button
                        onClick={() => alternar(a)}
                        disabled={aMudar === a.id}
                        className={cn("text-xs inline-flex items-center gap-1.5 hover:underline disabled:opacity-50",
                          activo ? "text-warning" : "text-success")}
                      >
                        {activo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {aMudar === a.id ? "A gravar…" : activo ? "Pausar" : "Activar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
