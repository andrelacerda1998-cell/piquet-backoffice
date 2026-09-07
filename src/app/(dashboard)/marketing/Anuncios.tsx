"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getAnunciosMeta, mudarEstadoMeta,
  getAnunciosGoogle, mudarEstadoGoogleUI,
  type MetaAnuncioUI,
} from "@/services/marketingService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Plus, Play, Pause, AlertTriangle, RefreshCw, ImageOff } from "lucide-react";

/**
 * Anúncios das duas plataformas, num só sítio.
 *
 * Antes eram dois componentes empilhados, cada um com cabeçalho, botão de
 * atualizar e grelha própria — o mesmo ecrã desenhado duas vezes, uma por
 * plataforma. A pergunta de quem abre isto não é "o que tenho na Meta?" seguida
 * de "o que tenho no Google?": é "o que está a correr?". Por isso há uma lista
 * só, agrupada por campanha, e um filtro para restringir a uma plataforma
 * quando é mesmo isso que se quer.
 */

type Plataforma = "meta" | "google";

interface Anuncio {
  chave: string;
  plataforma: Plataforma;
  nome: string;
  campanhaChave: string;
  campanhaNome: string;
  subtitulo: string | null;
  imagem: string | null;
  titulos: string[];
  texto: string | null;
  estado: { label: string; tone: string };
  activo: boolean;
  /** `null` quando não há como mudar o estado (falta a referência). */
  alternar: (() => Promise<void>) | null;
}

function estadoMeta(a: MetaAnuncioUI) {
  const e = (a.effectiveStatus || a.status || "").toUpperCase();
  if (e === "ACTIVE") return { label: "A correr", tone: "bg-success-light text-success" };
  if (e.includes("PAUSED")) return { label: "Em pausa", tone: "bg-surface-subtle text-text-secondary" };
  if (e === "PENDING_REVIEW" || e === "IN_PROCESS") return { label: "Em revisão", tone: "bg-warning-light text-warning" };
  if (e === "DISAPPROVED" || e === "WITH_ISSUES") return { label: "Recusado", tone: "bg-danger-light text-danger" };
  return { label: e || "—", tone: "bg-surface-subtle text-text-muted" };
}

function estadoGoogle(status: string) {
  const e = (status || "").toUpperCase();
  if (e === "ENABLED") return { label: "A correr", tone: "bg-success-light text-success" };
  if (e === "PAUSED") return { label: "Em pausa", tone: "bg-surface-subtle text-text-secondary" };
  return { label: e || "—", tone: "bg-surface-subtle text-text-muted" };
}

const CANAL: Record<string, string> = {
  SEARCH: "Pesquisa", DISPLAY: "Display", VIDEO: "Vídeo",
  DEMAND_GEN: "Demand Gen", PERFORMANCE_MAX: "Performance Max",
  MULTI_CHANNEL: "App",
};

/** Selo da plataforma — a cor distingue-as sem precisar de ler. */
function Selo({ p }: { p: Plataforma }) {
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
      p === "meta" ? "bg-piquet/15 text-piquet-700" : "bg-info-light text-info")}>
      {p === "meta" ? "Meta" : "Google"}
    </span>
  );
}

export function Anuncios({ onCriar }: { onCriar: () => void }) {
  const { data: meta, loading: loadMeta, refetch: refetchMeta } = useAsyncData(() => getAnunciosMeta(), []);
  const { data: google, loading: loadGoogle, refetch: refetchGoogle } = useAsyncData(() => getAnunciosGoogle(), []);
  const [filtro, setFiltro] = useState<"todas" | Plataforma>("todas");
  const [aMudar, setAMudar] = useState<string | null>(null);

  const loading = loadMeta || loadGoogle;
  const recarregar = () => { refetchMeta(); refetchGoogle(); };

  const mudar = async (chave: string, accao: () => Promise<void>, activo: boolean) => {
    setAMudar(chave);
    try {
      await accao();
      toast(activo ? "Em pausa." : "Activado — passa a gastar orçamento.");
      recarregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao mudar o estado.", "error");
    } finally {
      setAMudar(null);
    }
  };

  const anuncios: Anuncio[] = useMemo(() => {
    const out: Anuncio[] = [];

    for (const a of meta?.ads ?? []) {
      const est = estadoMeta(a);
      const activo = (a.effectiveStatus || a.status).toUpperCase() === "ACTIVE";
      out.push({
        chave: `meta:${a.id}`,
        plataforma: "meta",
        nome: a.name,
        campanhaChave: `meta:${a.campaignId ?? "sem"}`,
        campanhaNome: a.campaignName ?? "Sem campanha",
        subtitulo: a.adsetName,
        imagem: a.imageUrl,
        titulos: [],
        texto: a.texto,
        estado: est,
        activo,
        alternar: () => mudarEstadoMeta(a.id, activo ? "PAUSED" : "ACTIVE").then(() => undefined),
      });
    }

    for (const a of google?.ads ?? []) {
      const est = estadoGoogle(a.status);
      const activo = a.status.toUpperCase() === "ENABLED";
      out.push({
        chave: `google:${a.id}`,
        plataforma: "google",
        nome: a.name,
        campanhaChave: `google:${a.campaignId ?? "sem"}`,
        campanhaNome: a.campaignName ?? "Sem campanha",
        subtitulo: a.origem === "asset_group"
          ? "Grupo de recursos · a Google combina os elementos"
          : a.adGroupName,
        imagem: a.imagens[0] ?? null,
        titulos: a.titulos,
        texto: a.descricoes[0] ?? null,
        estado: est,
        activo,
        alternar: a.resourceName
          ? () => mudarEstadoGoogleUI(a.resourceName, activo ? "PAUSED" : "ENABLED").then(() => undefined)
          : null,
      });
    }

    return out;
  }, [meta, google]);

  const visiveis = filtro === "todas" ? anuncios : anuncios.filter((a) => a.plataforma === filtro);

  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; plataforma: Plataforma; canal: string; itens: Anuncio[] }>();
    for (const a of visiveis) {
      const canal = a.plataforma === "google"
        ? (google?.ads.find((g) => `google:${g.campaignId ?? "sem"}` === a.campanhaChave)?.canal ?? "")
        : "";
      const atual = m.get(a.campanhaChave) ?? { nome: a.campanhaNome, plataforma: a.plataforma, canal, itens: [] };
      atual.itens.push(a);
      m.set(a.campanhaChave, atual);
    }
    return [...m.values()];
  }, [visiveis, google]);

  const erros = [
    meta?.error ? { p: "Meta", msg: meta.error } : null,
    google?.error ? { p: "Google Ads", msg: google.error } : null,
  ].filter(Boolean) as { p: string; msg: string }[];

  const contagem = (p: Plataforma) => anuncios.filter((a) => a.plataforma === p).length;

  return (
    <div className="space-y-4">
      {/* Um cabeçalho só: filtro, atualizar e criar. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {([
            { id: "todas" as const, label: "Todas", n: anuncios.length },
            { id: "meta" as const, label: "Meta", n: contagem("meta") },
            { id: "google" as const, label: "Google", n: contagem("google") },
          ]).map((o) => (
            <button key={o.id} onClick={() => setFiltro(o.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                filtro === o.id
                  ? "border-piquet/30 bg-piquet/15 text-piquet-700"
                  : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
              {o.label}
              <span className={cn("tabular-nums text-xs", filtro === o.id ? "opacity-80" : "text-text-muted")}>{o.n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={recarregar} className="btn-secondary text-sm" title="Voltar a ler das plataformas">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button onClick={onCriar} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Criar anúncio
          </button>
        </div>
      </div>

      {erros.map((e) => (
        <div key={e.p} className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/30 px-4 py-2.5">
          <p className="text-sm font-medium text-text-primary flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" /> {e.p} não respondeu
          </p>
          <p className="text-xs text-text-secondary mt-0.5">{e.msg}</p>
        </div>
      ))}

      {loading && anuncios.length === 0 && <p className="text-sm text-text-secondary">A ler as plataformas…</p>}
      {!loading && visiveis.length === 0 && erros.length === 0 && (
        <p className="text-sm text-text-secondary">Sem anúncios a mostrar.</p>
      )}

      {grupos.map((g) => (
        <div key={`${g.plataforma}-${g.nome}`} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <Selo p={g.plataforma} />
            <p className="text-sm font-medium text-text-primary">{g.nome}</p>
            {g.canal && <span className="text-[11px] text-text-muted">{CANAL[g.canal] ?? g.canal}</span>}
            <span className="text-[11px] text-text-muted">· {g.itens.length}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {g.itens.map((a) => (
              <div key={a.chave} className="card overflow-hidden flex flex-col">
                {a.imagem ? (
                  <Image src={a.imagem} alt={a.nome} width={400} height={300} unoptimized
                    className="w-full aspect-[4/3] object-cover" />
                ) : a.titulos.length > 0 ? (
                  /* Pesquisa: os títulos SÃO o criativo. Uma moldura vazia
                     sugeriria que falta lá uma imagem, e não falta. */
                  <div className="aspect-[4/3] bg-surface-subtle/60 px-3 py-3 space-y-1 overflow-hidden">
                    {a.titulos.slice(0, 4).map((t, i) => (
                      <p key={i} className={cn("text-sm truncate", i === 0 ? "text-piquet-700 font-medium" : "text-text-secondary")}>{t}</p>
                    ))}
                    {a.titulos.length > 4 && (
                      <p className="text-[11px] text-text-muted">+{a.titulos.length - 4} títulos</p>
                    )}
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] bg-surface-subtle flex flex-col items-center justify-center gap-1 text-text-muted">
                    <ImageOff className="h-5 w-5" />
                    <span className="text-[11px]">Sem pré-visualização</span>
                  </div>
                )}

                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary line-clamp-2">{a.nome}</p>
                    <span className={cn("shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", a.estado.tone)}>
                      {a.estado.label}
                    </span>
                  </div>
                  {a.subtitulo && <p className="text-[11px] text-text-muted line-clamp-1">{a.subtitulo}</p>}
                  {a.texto && <p className="text-xs text-text-secondary line-clamp-2">{a.texto}</p>}
                  {a.alternar && (
                    <div className="pt-1 mt-auto">
                      <button onClick={() => mudar(a.chave, a.alternar!, a.activo)} disabled={aMudar === a.chave}
                        className={cn("text-xs inline-flex items-center gap-1.5 hover:underline disabled:opacity-50",
                          a.activo ? "text-warning" : "text-success")}>
                        {a.activo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {aMudar === a.chave ? "A gravar…" : a.activo ? "Pausar" : "Activar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
