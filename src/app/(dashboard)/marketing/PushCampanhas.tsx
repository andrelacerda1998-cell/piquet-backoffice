"use client";

import { useEffect, useState } from "react";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getPushCampaigns, setPushCampaignActive, apagarCampanhaPush, publicoDaCampanhaPush, type PushCampaign,
} from "@/services/marketingService";
import { formatDateTime, formatNumber } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Smartphone, HardHat, Users, RefreshCw, Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/PageHeader";
import { Etiqueta } from "@/components/ui/Ficha";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MOTIVO_MINIMO } from "@/lib/motivo";
import { resumoDaFrequencia } from "@/lib/campanhasPush";
import { CampanhaPushForm } from "./CampanhaPushForm";

/**
 * Campanhas de push, com os números que saíram mesmo.
 *
 * O ecrã anterior guardava as campanhas em `localStorage` do browser e gerava
 * entregas, aberturas e conversões com `Math.random()`: reportava resultados de
 * campanhas que nunca saíram da máquina. As campanhas reais sempre existiram --
 * no Laravel, enviadas pelo canal Expo e registadas com entrega, abertura e
 * clique -- mas só se viam no Filament.
 *
 * Criar também se faz aqui desde 15/10/2026 (pedido do André), mas em passos
 * (src/lib/campanhasPush.ts): grava-se desligada, como rascunho, com o público
 * contado; liga-se à parte, com o número de pessoas outra vez à frente e um
 * motivo. Parar continua a ser um clique.
 */

const ALVO: Record<string, { rotulo: string; Icone: typeof Users }> = {
  customer: { rotulo: "Clientes", Icone: Smartphone },
  vendor: { rotulo: "Técnicos", Icone: HardHat },
  both: { rotulo: "Clientes e técnicos", Icone: Users },
};

/** Percentagem, ou traço quando não há base para a calcular. */
function pct(v: number | null) {
  return v == null ? "—" : `${v.toString().replace(".", ",")}%`;
}

export function PushCampanhas() {
  const { data, loading, error, refetch } = useAsyncData(() => getPushCampaigns(), []);
  const [aMudar, setAMudar] = useState<number | null>(null);
  const [noFormulario, setNoFormulario] = useState<{ campanha: PushCampaign | null } | null>(null);
  const [paraLigar, setParaLigar] = useState<PushCampaign | null>(null);
  const [paraApagar, setParaApagar] = useState<PushCampaign | null>(null);

  /** Parar é o travão: um clique. */
  const parar = async (c: PushCampaign) => {
    setAMudar(c.id);
    try {
      await setPushCampaignActive(c.id, false);
      toast(`"${c.name}" desligada.`);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível mudar o estado.", "error");
    } finally {
      setAMudar(null);
    }
  };

  const apagar = async () => {
    if (!paraApagar) return;
    try {
      await apagarCampanhaPush(paraApagar.id);
      toast(`Rascunho "${paraApagar.name}" apagado.`);
      setParaApagar(null);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível apagar o rascunho.", "error");
    }
  };

  if (error) {
    return (
      <div className="aviso aviso-perigo">
        <p className="text-danger">{error}</p>
        <p className="text-sm text-text-secondary mt-1">
          As campanhas vivem no Laravel. Se a API de admin estiver em baixo, não há aqui nada a mostrar.
        </p>
      </div>
    );
  }

  const campanhas = data?.items ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Campanhas de push"
        description="Enviadas pela app. Uma campanha nova fica desligada até alguém a ligar, com o número de pessoas à frente."
        aside={
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="btn-ghost text-[13px]">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
            </button>
            <button onClick={() => setNoFormulario({ campanha: null })} className="btn-primary text-[13px]">
              <Plus className="h-3.5 w-3.5" /> Nova campanha
            </button>
          </div>
        }
        className="mb-0"
      />

      {campanhas.length === 0 && !loading && (
        <div className="card px-4 py-8 text-center">
          <p className="text-sm font-medium text-text-primary">Nenhuma campanha de push criada.</p>
          <p className="text-sm text-text-muted">Cria a primeira em &ldquo;Nova campanha&rdquo;: fica desligada até a ligares.</p>
        </div>
      )}

      <div className="space-y-2">
        {campanhas.map((c) => {
          const alvo = ALVO[c.target_type ?? ""] ?? { rotulo: c.target_type ?? "—", Icone: Users };
          return (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    {c.name}
                    <Etiqueta tom={c.is_active ? "bom" : "neutro"}>{c.is_active ? "Ativa" : c.rascunho ? "Rascunho" : "Parada"}</Etiqueta>
                    {c.ingles_por_rever && <Etiqueta tom="atencao" title="Enquanto o inglês não for revisto, a campanha não sai para ninguém.">Inglês por rever</Etiqueta>}
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">{c.title}</p>
                  {c.body && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{c.body}</p>}
                  <p className="text-[11px] text-text-muted mt-1.5 inline-flex items-center gap-1.5">
                    <alvo.Icone className="h-3.5 w-3.5" /> {alvo.rotulo} · {resumoDaFrequencia(c)}
                    {c.last_sent_at && <> · último envio {formatDateTime(c.last_sent_at)}</>}
                    {c.is_active && c.next_send_at && <> · próximo {formatDateTime(c.next_send_at)}</>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {c.is_active ? (
                    <button onClick={() => parar(c)} disabled={aMudar === c.id} className="btn-secondary text-sm disabled:opacity-50">
                      {aMudar === c.id ? "A parar…" : "Parar"}
                    </button>
                  ) : (
                    <>
                      {c.rascunho && (
                        <>
                          <button onClick={() => setParaApagar(c)} className="btn-ghost text-sm hover:text-danger">Apagar</button>
                          <button onClick={() => setNoFormulario({ campanha: c })} className="btn-secondary text-sm">Corrigir</button>
                        </>
                      )}
                      <button onClick={() => setParaLigar(c)} className="btn-primary text-sm">Ligar…</button>
                    </>
                  )}
                </div>
              </div>

              {/*
                Os números reais. "Entregues" é o que a Expo aceitou; "abertos"
                é quem tocou na notificação. A taxa de abertura mede-se sobre os
                entregues, não sobre os enviados — dividir pelo que não chegou
                faria a campanha parecer pior do que foi.
              */}
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3 border-t border-surface-border">
                {[
                  { r: "Enviados", v: formatNumber(c.stats.enviados) },
                  { r: "Entregues", v: formatNumber(c.stats.entregues) },
                  { r: "Taxa entrega", v: pct(c.stats.taxa_entrega) },
                  { r: "Abertos", v: formatNumber(c.stats.abertos) },
                  { r: "Taxa abertura", v: pct(c.stats.taxa_abertura) },
                  { r: "Saíram", v: formatNumber(c.stats.saidas) },
                ].map((m) => (
                  <div key={m.r}>
                    <p className="text-xs font-medium text-text-muted">{m.r}</p>
                    <p className="text-sm font-semibold text-text-primary tabular-nums mt-0.5">{m.v}</p>
                  </div>
                ))}
              </div>

              {c.stats.falhados > 0 && (
                <p className="mt-2 text-[11px] text-danger">
                  {formatNumber(c.stats.falhados)} não chegaram — telemóveis sem a app ou sem permissão de notificações.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <CampanhaPushForm
        open={noFormulario !== null}
        campanha={noFormulario?.campanha ?? null}
        onClose={() => setNoFormulario(null)}
        onGuardada={(c) => {
          setNoFormulario(null);
          toast(`"${c.name}" guardada como rascunho. Liga-a quando estiver pronta.`);
          refetch();
        }}
      />
      <LigarCampanha
        campanha={paraLigar}
        onClose={() => setParaLigar(null)}
        onLigada={(c) => { setParaLigar(null); toast(`"${c.name}" ligada.`); refetch(); }}
        onCorrigir={(c) => { setParaLigar(null); setNoFormulario({ campanha: c }); }}
      />
      <ConfirmDialog
        open={paraApagar !== null}
        onClose={() => setParaApagar(null)}
        onConfirm={apagar}
        title={`Apagar o rascunho "${paraApagar?.name ?? ""}"?`}
        description="Nunca foi enviado, por isso não se perde nenhum número."
        confirmLabel="Apagar"
        tone="danger"
      />
    </div>
  );
}

/**
 * Ligar uma campanha: o número de pessoas outra vez à frente, contado agora, e
 * o motivo, que fica no histórico da equipa com o nome de quem ligou.
 */
function LigarCampanha({ campanha, onClose, onLigada, onCorrigir }: {
  campanha: PushCampaign | null;
  onClose: () => void;
  onLigada: (c: PushCampaign) => void;
  onCorrigir: (c: PushCampaign) => void;
}) {
  const [pessoas, setPessoas] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aLigar, setALigar] = useState(false);

  useEffect(() => {
    if (!campanha) return;
    let vivo = true;
    setPessoas(null); setErro(null); setMotivo("");
    publicoDaCampanhaPush(campanha.id)
      .then((p) => vivo && setPessoas(p))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível contar o público."));
    return () => { vivo = false; };
  }, [campanha]);

  if (!campanha) return null;

  const futuro = campanha.starts_at && Date.parse(campanha.starts_at) > Date.now();
  const curto = motivo.trim().length < MOTIVO_MINIMO;
  const bloqueada = !!campanha.ingles_por_rever;

  const ligar = async () => {
    if (curto || pessoas === null || bloqueada) return;
    setALigar(true);
    try {
      await setPushCampaignActive(campanha.id, true, { motivo: motivo.trim(), pessoas });
      onLigada(campanha);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível ligar a campanha.", "error");
    } finally {
      setALigar(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ligar "${campanha.name}"?`}
      subtitle={futuro ? `Fica à espera e começa a ${formatDateTime(campanha.starts_at!)}.` : "Começa a enviar no próximo minuto."}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={ligar} disabled={curto || pessoas === null || bloqueada || aLigar} className="btn-primary disabled:opacity-40">
            {aLigar ? "A ligar…" : pessoas === null ? "Ligar" : `Ligar para ${formatNumber(pessoas)} pessoa${pessoas === 1 ? "" : "s"}`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-subtle px-4 py-3">
          <p className="text-sm font-medium text-text-primary">
            {erro ? <span className="text-danger">{erro}</span>
              : pessoas === null ? "A contar o público…"
              : <>Vai chegar a <span className="tabular-nums">{formatNumber(pessoas)}</span> pessoa{pessoas === 1 ? "" : "s"}.</>}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {resumoDaFrequencia(campanha)}{campanha.ends_at ? `, até ${formatDateTime(campanha.ends_at)}` : ""}. Contado agora, com a regra do envio.
          </p>
        </div>
        <div className="rounded-xl border border-surface-border px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">{campanha.title}</p>
          {campanha.body && <p className="text-sm text-text-secondary mt-0.5 whitespace-pre-wrap">{campanha.body}</p>}
        </div>
        {bloqueada ? (
          <div className="aviso aviso-atencao">
            <p className="text-sm">O inglês ainda não foi revisto: até ser, a campanha não sai para ninguém.</p>
            {campanha.rascunho && <button onClick={() => onCorrigir(campanha)} className="btn-secondary text-xs py-1.5 mt-2">Rever o inglês</button>}
          </div>
        ) : (
          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Porque a ligas</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={500}
              placeholder="Ex.: reativar clientes de Almada antes do fim de semana." className="input-field mt-1 w-full" />
            <span className="text-[11px] text-text-muted">Fica no histórico da equipa com o teu nome.</span>
          </label>
        )}
      </div>
    </Modal>
  );
}
