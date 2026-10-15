"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts, adiarAlerta, dispensarAlerta, amanhaAsNove } from "@/services/supportService";
import { destinoDoAlerta } from "@/lib/alertLinks";
import { ordenarAlertas } from "@/lib/ordemDosAlertas";
import { MOTIVO_MINIMO } from "@/lib/motivo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import type { AlertPriority, DashboardAlert } from "@/types";

/**
 * "Precisa de ti": a fila do que está à espera de alguém da equipa, à cabeça
 * da Visão Geral.
 *
 * São os alertas deste perfil (cada alerta tem dono), só os mais urgentes e
 * com uma ação cada. Cada linha pode sair da fila de duas maneiras:
 * "Adiar" (volta amanhã às 9 h, se ainda for preciso) ou "Não é preciso"
 * (sai de vez, com o motivo e o nome de quem decidiu). Os lembretes de gestão
 * -- faturas, impostos, anúncios -- não vêm para aqui: estão nas áreas deles.
 */
const MAXIMO = 7;

/**
 * Vermelho para agir já, âmbar para estar atento, cinzento para o resto.
 * Um ponto e não uma barra a toda a altura: com sete linhas, sete barras
 * vermelhas eram a coisa mais forte do ecrã e todas pareciam iguais.
 */
const COR: Record<AlertPriority, string> = {
  critica: "bg-danger",
  alta: "bg-warning",
  media: "bg-info",
  baixa: "bg-surface-strong",
};
const NOME_DA_URGENCIA: Record<AlertPriority, string> = { critica: "Crítico", alta: "Alta", media: "Média", baixa: "Baixa" };

/** "há 4 min", "há 3 h", "há 2 dias". */
function haQuanto(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(s)) return "";
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Um resumo de vários casos não tem uma hora sua (a dele seria "agora"). */
const temHoraPropria = (a: DashboardAlert) => !a.id.startsWith("grupo-") && Date.now() - Date.parse(a.createdAt) > 90_000;

/** Só um caso concreto (o pedido 282, a lead 17) se pode dar como "não é preciso". */
export const podeDispensar = (a: DashboardAlert) => !a.id.startsWith("grupo-") && /\d/.test(a.id);

/**
 * `onVerTodos`: na Visão Geral, "Ver todos" muda para o separador Alertas em
 * vez de navegar. `onTotal` diz quantos alertas há (para o número no separador).
 */
export function PrecisaDeTi({ onVerTodos, onTotal }: { onVerTodos?: () => void; onTotal?: (n: number) => void } = {}) {
  const { data, loading, error, refetch } = useAsyncData(() => getAlerts(1, 200), []);
  const [aMexer, setAMexer] = useState<string | null>(null);
  const [aDispensar, setADispensar] = useState<DashboardAlert | null>(null);

  // O mais urgente primeiro; dentro da mesma urgência, o prazo mais curto e
  // depois o mais antigo (a mesma ordem do motor: ver ordemDosAlertas).
  const alertas = ordenarAlertas(data?.data ?? []);
  const fila = alertas.slice(0, MAXIMO);
  useEffect(() => { if (data) onTotal?.(alertas.length); }, [data, alertas.length, onTotal]);

  const adiar = async (a: DashboardAlert) => {
    setAMexer(a.id);
    try {
      await adiarAlerta(a.id, amanhaAsNove());
      toast("Adiado para amanhã às 9:00.");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível adiar.", "error");
    } finally {
      setAMexer(null);
    }
  };

  const dispensar = async (motivo?: string) => {
    if (!aDispensar || !motivo) return;
    try {
      await dispensarAlerta(aDispensar.id, motivo);
      toast("Saiu da fila. Fica registado o motivo, com o teu nome.");
      setADispensar(null);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível tirar da fila.", "error");
    }
  };

  if (loading && !data) return <div className="card p-5 text-sm text-text-muted">A ver o que está à tua espera…</div>;
  // Uma fila que não se conseguiu ler NÃO é uma fila vazia: dizê-lo.
  if (error) {
    return (
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-primary"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-warning align-middle" />Não foi possível ver a fila agora. Pode haver coisas à tua espera.</p>
        <button onClick={refetch} className="btn-secondary py-1.5 text-[13px]"><RefreshCw className="h-3.5 w-3.5" /> Tentar de novo</button>
      </div>
    );
  }

  return (
    <section aria-labelledby="precisa-de-ti" className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-border">
        <h2 id="precisa-de-ti" className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
          Precisa de ti
          {alertas.length > 0 && <span className="rounded-md bg-surface-subtle px-1.5 py-px text-xs font-semibold tabular-nums text-text-secondary">{alertas.length}</span>}
        </h2>
        {alertas.length > 0 && (onVerTodos ? (
          <button onClick={onVerTodos} className="btn-ghost text-[13px] -mr-1.5">
            {alertas.length > MAXIMO ? `Ver todos` : "Ver em Alertas"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link href="/?tab=alertas" className="btn-ghost text-[13px] -mr-1.5">
            {alertas.length > MAXIMO ? `Ver todos` : "Ver em Alertas"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
      {fila.length === 0 ? (
        <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <p className="text-sm text-text-primary font-medium">Nada pendente.</p>
          <p className="text-[13px] text-text-muted">Quando alguma coisa precisar de ti, aparece aqui.</p>
        </div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {fila.map((a) => {
            const d = destinoDoAlerta(a);
            return (
              <li key={a.id} className="group flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-surface-subtle/50 transition-colors">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", COR[a.priority])} title={NOME_DA_URGENCIA[a.priority]} aria-label={`Urgência ${NOME_DA_URGENCIA[a.priority]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                  <p className="text-[13px] text-text-muted truncate" title={a.recommendedAction || undefined}>
                    {a.description}
                    {a.createdAt && temHoraPropria(a) && <span> · {haQuanto(a.createdAt)}</span>}
                  </p>
                </div>
                {/* Adiar e "não é preciso" aparecem ao passar o rato: são a
                    saída de emergência da fila, não o caminho normal. No
                    telemóvel (sem rato) ficam sempre visíveis. */}
                <div className="ml-5 sm:ml-0 flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => adiar(a)}
                    disabled={aMexer === a.id}
                    className="btn-ghost text-xs px-2 py-1 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    title="Tirar da fila até amanhã às 9:00 (volta se ainda for preciso)"
                  >
                    Adiar
                  </button>
                  {podeDispensar(a) && (
                    <button
                      onClick={() => setADispensar(a)}
                      className="btn-ghost text-xs px-2 py-1 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                      title="Tirar da fila de vez, com o motivo"
                    >
                      Não é preciso
                    </button>
                  )}
                  <Link href={d.href} className="btn-secondary py-1 px-2.5 text-[13px]" title={a.recommendedAction || undefined}>
                    {d.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={aDispensar !== null}
        onClose={() => setADispensar(null)}
        onConfirm={dispensar}
        title="Tirar da fila de vez?"
        description={aDispensar && (
          <><b className="text-text-primary">{aDispensar.title}</b> deixa de aparecer na fila e nos Alertas. Fica registado o motivo, com o teu nome; nos Alertas, em &quot;adiados&quot;, pode voltar a mostrar-se.</>
        )}
        confirmLabel="Não é preciso"
        requireReason
        minReason={MOTIVO_MINIMO}
        reasonLabel="Porque não é preciso?"
        reasonPlaceholder="Ex.: o cliente já foi contactado por telefone e remarcou"
      />
    </section>
  );
}
