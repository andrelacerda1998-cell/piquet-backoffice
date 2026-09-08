"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getDispatchBoard, type DispatchPedido } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MapPin, Radio, Clock, Check, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DespachoLead } from "@/components/ui/DespachoLead";

/**
 * Despacho — quem está à espera de técnico, e em que ponto.
 *
 * A fila são leads: um serviço só existe depois de haver técnico e preço, e
 * quem está à espera está antes disso. Cada linha abre no mesmo painel que
 * existe no detalhe da lead — o despacho faz-se aqui, não noutro sítio com
 * outras regras.
 */

/** Há quantas horas entrou. É a única medida que interessa numa fila. */
function espera(recebidoEm: string, agora = Date.now()): { texto: string; tarde: boolean } {
  const horas = Math.floor((agora - new Date(recebidoEm).getTime()) / 3_600_000);
  if (horas < 1) return { texto: "há menos de 1h", tarde: false };
  if (horas < 24) return { texto: `há ${horas}h`, tarde: horas >= 4 };
  const dias = Math.floor(horas / 24);
  return { texto: `há ${dias} ${dias === 1 ? "dia" : "dias"}`, tarde: true };
}

function Linha({ p, aberta, onAbrir }: { p: DispatchPedido; aberta: boolean; onAbrir: () => void }) {
  const e = espera(p.recebidoEm);
  return (
    <div className="rounded-xl border border-surface-border overflow-hidden">
      <button
        onClick={onAbrir}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/40"
      >
        {aberta ? <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
          : <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-text-primary">
            {p.servico}
            {p.urgente && <span className="ml-2 text-xs font-medium text-danger">Urgente</span>}
          </span>
          <span className="block truncate text-xs text-text-secondary">
            {p.nome}
            {p.cidade && (
              <span className="inline-flex items-center gap-1 ml-2">
                <MapPin className="h-3 w-3" />{p.cidade}
              </span>
            )}
          </span>
        </span>

        <span className={cn("text-xs inline-flex items-center gap-1 shrink-0",
          e.tarde ? "text-warning font-medium" : "text-text-muted")}>
          <Clock className="h-3.5 w-3.5" />{e.texto}
        </span>

        {/* O estado do despacho em três palavras: é o que decide a acção. */}
        <span className="text-xs shrink-0 min-w-[9rem] text-right">
          {p.aceites > 0 ? (
            <span className="text-success font-medium inline-flex items-center gap-1 justify-end">
              <Check className="h-3.5 w-3.5" />
              {p.aceites} {p.aceites === 1 ? "aceitou" : "aceitaram"}
            </span>
          ) : p.perguntados === 0 ? (
            <span className="text-text-muted">Ninguém perguntado</span>
          ) : (
            <span className="text-text-muted">{p.porResponder} por responder</span>
          )}
        </span>
      </button>

      {aberta && (
        <div className="border-t border-surface-border p-3 bg-surface-muted/20">
          <p className="text-[11px] text-text-muted mb-2">
            Recebido a {formatDate(p.recebidoEm)}
            {p.urgencia && ` · ${p.urgencia}`}
          </p>
          <DespachoLead leadId={p.leadId} cidade={p.cidade} />
        </div>
      )}
    </div>
  );
}

export default function DispatchPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getDispatchBoard(), []);
  const [aberta, setAberta] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const k = data?.kpis;

  return (
    <RouteGuard route="/despacho">
      <div className="space-y-6">
        <PageHeader
          icon={Radio}
          eyebrow="Operação"
          title="Despacho"
          subtitle="Pedidos à espera de técnico, e em que ponto está cada um"
        />

        {k && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="À espera de técnico" metric={buildMetricValue(k.espera, k.espera)} hideDelta />
            <MetricCard title="Ninguém perguntado" metric={buildMetricValue(k.porDifundir, k.porDifundir)} hideDelta />
            <MetricCard title="À espera da tua decisão" metric={buildMetricValue(k.porDecidir, k.porDecidir)} hideDelta />
            {/*
              Sem histórico mostra-se um traço, não um zero: "0 min" diria que
              os técnicos respondem de imediato, que é o contrário de não se
              saber ainda.
            */}
            {k.minutosAteAceitar === null ? (
              <div className="card p-4">
                <p className="text-sm text-text-secondary">Minutos até alguém aceitar</p>
                <p className="mt-1 text-2xl font-bold text-text-muted">—</p>
                <p className="text-xs text-text-muted">ainda sem respostas</p>
              </div>
            ) : (
              <MetricCard
                title="Minutos até alguém aceitar"
                metric={buildMetricValue(k.minutosAteAceitar, k.minutosAteAceitar)}
                hideDelta
              />
            )}
          </div>
        )}

        {data && data.pedidos.length === 0 ? (
          <EmptyState
            title="Ninguém à espera"
            description="Todos os pedidos abertos já têm técnico atribuído."
          />
        ) : (
          <div className="space-y-2">
            {data?.pedidos.map((p) => (
              <Linha
                key={p.leadId}
                p={p}
                aberta={aberta === p.leadId}
                onAbrir={() => setAberta(aberta === p.leadId ? null : p.leadId)}
              />
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
