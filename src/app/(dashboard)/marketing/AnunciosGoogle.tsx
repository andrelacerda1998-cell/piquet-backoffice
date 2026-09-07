"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAnunciosGoogle, mudarEstadoGoogleUI, type GoogleAnuncioUI } from "@/services/marketingService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Play, Pause, AlertTriangle, RefreshCw, Search, Image as ImgIcon } from "lucide-react";

/**
 * Anúncios do Google Ads, agrupados por campanha.
 *
 * Trata Pesquisa e Display de forma diferente porque SÃO diferentes: um
 * anúncio de Pesquisa não tem imagem nenhuma — são títulos e descrições que a
 * Google combina sozinha. Mostrar uma moldura de imagem vazia para esses seria
 * sugerir que falta lá alguma coisa.
 */

function estadoUI(status: string): { label: string; tone: string } {
  const e = (status || "").toUpperCase();
  if (e === "ENABLED") return { label: "A correr", tone: "bg-success-light text-success" };
  if (e === "PAUSED") return { label: "Em pausa", tone: "bg-surface-subtle text-text-secondary" };
  return { label: e || "—", tone: "bg-surface-subtle text-text-muted" };
}

const CANAL_LABEL: Record<string, string> = {
  SEARCH: "Pesquisa",
  DISPLAY: "Display",
  VIDEO: "Vídeo",
  DEMAND_GEN: "Demand Gen",
  PERFORMANCE_MAX: "Performance Max",
};

export function AnunciosGoogle() {
  const { data, loading, refetch } = useAsyncData(() => getAnunciosGoogle(), []);
  const [aMudar, setAMudar] = useState<string | null>(null);

  const anuncios = useMemo(() => data?.ads ?? [], [data]);

  const porCampanha = useMemo(() => {
    const m = new Map<string, { nome: string; canal: string; itens: GoogleAnuncioUI[] }>();
    for (const a of anuncios) {
      const k = a.campaignId ?? "sem-campanha";
      const atual = m.get(k) ?? { nome: a.campaignName ?? "Sem campanha", canal: a.canal, itens: [] };
      atual.itens.push(a);
      m.set(k, atual);
    }
    return [...m.entries()];
  }, [anuncios]);

  const alternar = async (a: GoogleAnuncioUI) => {
    const activo = a.status.toUpperCase() === "ENABLED";
    if (!a.resourceName) { toast("Sem referência do anúncio para mudar o estado.", "error"); return; }
    setAMudar(a.id);
    try {
      await mudarEstadoGoogleUI(a.resourceName, activo ? "PAUSED" : "ENABLED");
      toast(activo ? "Anúncio em pausa." : "Anúncio activado.");
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
          <h3 className="font-semibold">Anúncios no Google Ads</h3>
          <p className="text-xs text-text-secondary">
            {anuncios.length > 0
              ? `${anuncios.length} anúncio(s) em ${porCampanha.length} campanha(s).`
              : "Pesquisa e Display, lidos da conta ao vivo."}
          </p>
        </div>
        <button onClick={refetch} className="btn-secondary text-sm" title="Voltar a ler do Google">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {data?.error && (
        <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/30 px-4 py-3">
          <p className="text-sm font-medium text-text-primary flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" /> Não foi possível ler o Google Ads
          </p>
          <p className="text-xs text-text-secondary mt-1">{data.error}</p>
        </div>
      )}

      {data && !data.configured && (
        <div className="rounded-xl border-l-[3px] border-l-warning bg-warning-light/30 px-4 py-3 text-sm text-text-secondary">
          Faltam as credenciais do Google Ads na Vercel.
        </div>
      )}

      {loading && anuncios.length === 0 && <p className="text-sm text-text-secondary">A ler o Google Ads…</p>}

      {!loading && !data?.error && anuncios.length === 0 && data?.configured && (
        <p className="text-sm text-text-secondary">Ainda não há anúncios nesta conta.</p>
      )}

      {porCampanha.map(([id, grupo]) => (
        <div key={id} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{grupo.nome}</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
              {grupo.canal === "SEARCH" ? <Search className="h-3 w-3" /> : <ImgIcon className="h-3 w-3" />}
              {CANAL_LABEL[grupo.canal] ?? grupo.canal}
            </span>
            <span className="text-[11px] text-text-muted">· {grupo.itens.length} anúncio(s)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grupo.itens.map((a) => {
              const st = estadoUI(a.status);
              const activo = a.status.toUpperCase() === "ENABLED";
              const temImagem = a.imagens.length > 0;
              return (
                <div key={a.id} className="card overflow-hidden flex flex-col">
                  {/* Só Display tem imagem. Em Pesquisa mostram-se os títulos,
                      que é o que o utilizador vê no Google. */}
                  {temImagem ? (
                    <Image src={a.imagens[0]} alt={a.name} width={400} height={300} unoptimized
                      className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="bg-surface-subtle/60 px-3 py-3 space-y-1">
                      {a.titulos.slice(0, 3).map((t, i) => (
                        <p key={i} className={cn("text-sm truncate", i === 0 ? "text-piquet-700 font-medium" : "text-text-secondary")}>{t}</p>
                      ))}
                      {a.titulos.length === 0 && <p className="text-xs text-text-muted">Sem títulos.</p>}
                      {a.titulos.length > 3 && (
                        <p className="text-[11px] text-text-muted">+{a.titulos.length - 3} títulos que a Google combina</p>
                      )}
                    </div>
                  )}
                  <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary line-clamp-2">{a.name}</p>
                      <span className={cn("shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", st.tone)}>
                        {st.label}
                      </span>
                    </div>
                    {a.adGroupName && <p className="text-[11px] text-text-muted truncate">{a.adGroupName}</p>}
                    {a.descricoes[0] && <p className="text-xs text-text-secondary line-clamp-2">{a.descricoes[0]}</p>}
                    <div className="pt-1 mt-auto">
                      <button onClick={() => alternar(a)} disabled={aMudar === a.id}
                        className={cn("text-xs inline-flex items-center gap-1.5 hover:underline disabled:opacity-50",
                          activo ? "text-warning" : "text-success")}>
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
