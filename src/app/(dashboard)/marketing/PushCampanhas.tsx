"use client";

import { useState } from "react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getPushCampaigns, setPushCampaignActive, type PushCampaign } from "@/services/marketingService";
import { formatDateTime, formatNumber } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Smartphone, HardHat, Users, RefreshCw } from "lucide-react";

/**
 * Campanhas de push, com os números que saíram mesmo.
 *
 * O ecrã anterior guardava as campanhas em `localStorage` do browser e gerava
 * entregas, aberturas e conversões com `Math.random()`: reportava resultados de
 * campanhas que nunca saíram da máquina. As campanhas reais sempre existiram --
 * no Laravel, enviadas pelo canal Expo e registadas com entrega, abertura e
 * clique -- mas só se viam no Filament.
 *
 * Criar continua a fazer-se lá, de propósito: criar uma campanha é enviar push
 * a milhares de pessoas, e isso não devia ser um botão a mais num ecrã de
 * consulta. Aqui vê-se e, se for preciso, pára-se.
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

  const alternar = async (c: PushCampaign) => {
    setAMudar(c.id);
    try {
      await setPushCampaignActive(c.id, !c.is_active);
      toast(c.is_active ? `"${c.name}" desligada.` : `"${c.name}" ligada.`);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível mudar o estado.", "error");
    } finally {
      setAMudar(null);
    }
  };

  if (error) {
    return (
      <div className="card p-4">
        <p className="text-sm text-danger">{error}</p>
        <p className="text-sm text-text-secondary mt-1">
          As campanhas vivem no Laravel. Se a API de admin estiver em baixo, não há aqui nada a mostrar.
        </p>
      </div>
    );
  }

  const campanhas = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Campanhas de push</h3>
          <p className="text-xs text-text-secondary">
            Enviadas pela app. Criam-se no painel de administração — aqui vê-se o resultado e pára-se se for preciso.
          </p>
        </div>
        <button onClick={refetch} className="btn-secondary text-sm">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {campanhas.length === 0 && !loading && (
        <div className="card p-5 text-center">
          <p className="text-sm font-medium text-text-primary">Nenhuma campanha de push criada.</p>
          <p className="text-sm text-text-secondary">Criam-se no painel de administração da app; aparecem aqui com os números reais.</p>
        </div>
      )}

      <div className="space-y-2">
        {campanhas.map((c) => {
          const alvo = ALVO[c.target_type ?? ""] ?? { rotulo: c.target_type ?? "—", Icone: Users };
          return (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary flex items-center gap-2">
                    {c.name}
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      c.is_active ? "bg-success-light text-success" : "bg-surface-muted text-text-muted")}>
                      {c.is_active ? "Ativa" : "Parada"}
                    </span>
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">{c.title}</p>
                  {c.body && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{c.body}</p>}
                  <p className="text-[11px] text-text-muted mt-1.5 inline-flex items-center gap-1.5">
                    <alvo.Icone className="h-3.5 w-3.5" /> {alvo.rotulo}
                    {c.last_sent_at && <> · último envio {formatDateTime(c.last_sent_at)}</>}
                  </p>
                </div>
                <button
                  onClick={() => alternar(c)}
                  disabled={aMudar === c.id}
                  className={cn("text-sm shrink-0 disabled:opacity-50", c.is_active ? "btn-secondary" : "btn-primary")}
                >
                  {aMudar === c.id ? "A guardar…" : c.is_active ? "Parar" : "Ligar"}
                </button>
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
                    <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold">{m.r}</p>
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
    </div>
  );
}
