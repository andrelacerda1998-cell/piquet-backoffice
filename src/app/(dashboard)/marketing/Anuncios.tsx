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
import { Plus, Play, Pause, AlertTriangle, RefreshCw, ImageOff, ChevronRight } from "lucide-react";
import { SearchInput } from "@/components/ui/DataTable";

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
  const [busca, setBusca] = useState("");
  // Campanhas recolhidas por omissão: são ~180 anúncios, um por campanha.
  // Abertas todas, o ecrã era uma coluna de cartões com centenas de metros.
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
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

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return anuncios.filter((a) =>
      (filtro === "todas" || a.plataforma === filtro) &&
      (!q || a.nome.toLowerCase().includes(q) || a.campanhaNome.toLowerCase().includes(q))
    );
  }, [anuncios, filtro, busca]);

  const grupos = useMemo(() => {
    const m = new Map<string, { chave: string; nome: string; plataforma: Plataforma; canal: string; itens: Anuncio[] }>();
    for (const a of visiveis) {
      const canal = a.plataforma === "google"
        ? (google?.ads.find((g) => `google:${g.campaignId ?? "sem"}` === a.campanhaChave)?.canal ?? "")
        : "";
      const atual = m.get(a.campanhaChave) ?? { chave: a.campanhaChave, nome: a.campanhaNome, plataforma: a.plataforma, canal, itens: [] };
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
    <div className="space-y-3">
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
          <SearchInput value={busca} onChange={setBusca} className="w-56" placeholder="Campanha ou anúncio…" />
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

      {grupos.map((g) => {
        const aberta = abertas.has(g.chave);
        const aCorrer = g.itens.filter((i) => i.activo).length;
        return (
          <div key={g.chave} className="rounded-xl border border-surface-border overflow-hidden">
            {/* Linha da campanha: clicável, com as miniaturas em ponto pequeno
                para se perceber o que lá está sem abrir. */}
            <button
              onClick={() => setAbertas((s) => {
                const n = new Set(s);
                if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave);
                return n;
              })}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted/50 transition-colors"
            >
              <ChevronRight className={cn("h-4 w-4 text-text-muted shrink-0 transition-transform", aberta && "rotate-90")} />
              <Selo p={g.plataforma} />
              <span className="text-sm font-medium text-text-primary truncate flex-1">{g.nome}</span>
              {g.canal && <span className="text-[11px] text-text-muted shrink-0 hidden sm:inline">{CANAL[g.canal] ?? g.canal}</span>}
              {!aberta && (
                <span className="hidden md:flex items-center gap-1 shrink-0">
                  {g.itens.slice(0, 4).map((a) => (
                    a.imagem
                      ? <Image key={a.chave} src={a.imagem} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded object-cover" />
                      : <span key={a.chave} className="h-7 w-7 rounded bg-surface-subtle" />
                  ))}
                </span>
              )}
              <span className="text-[11px] text-text-muted shrink-0 tabular-nums">
                {aCorrer > 0 ? `${aCorrer}/${g.itens.length} a correr` : `${g.itens.length} em pausa`}
              </span>
            </button>

            {aberta && (
              <div className="border-t border-surface-border p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {g.itens.map((a) => (
                  <div key={a.chave} className="rounded-lg border border-surface-border overflow-hidden flex flex-col">
                    {a.imagem ? (
                      <Image src={a.imagem} alt={a.nome} width={300} height={225} unoptimized
                        className="w-full aspect-[4/3] object-cover" />
                    ) : a.titulos.length > 0 ? (
                      <div className="aspect-[4/3] bg-surface-subtle/60 px-2.5 py-2 space-y-0.5 overflow-hidden">
                        {a.titulos.slice(0, 4).map((t, i) => (
                          <p key={i} className={cn("text-xs truncate", i === 0 ? "text-piquet-700 font-medium" : "text-text-secondary")}>{t}</p>
                        ))}
                        {a.titulos.length > 4 && <p className="text-[10px] text-text-muted">+{a.titulos.length - 4}</p>}
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] bg-surface-subtle flex items-center justify-center text-text-muted">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                    <div className="p-2 space-y-1 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-xs font-medium text-text-primary line-clamp-2">{a.nome}</p>
                        <span className={cn("shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium", a.estado.tone)}>
                          {a.estado.label}
                        </span>
                      </div>
                      {a.alternar && (
                        <div className="pt-0.5 mt-auto">
                          <button onClick={() => mudar(a.chave, a.alternar!, a.activo)} disabled={aMudar === a.chave}
                            className={cn("text-[11px] inline-flex items-center gap-1 hover:underline disabled:opacity-50",
                              a.activo ? "text-warning" : "text-success")}>
                            {a.activo ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            {aMudar === a.chave ? "A gravar…" : a.activo ? "Pausar" : "Activar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}
