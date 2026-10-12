"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts, adiarAlerta, dispensarAlerta, amanhaAsNove } from "@/services/supportService";
import { destinoDoAlerta } from "@/lib/alertLinks";
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

const URGENCIA: Record<AlertPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

/** Vermelho para agir já, âmbar para estar atento, cinzento para o resto. */
const COR: Record<AlertPriority, string> = {
  critica: "border-l-danger",
  alta: "border-l-warning",
  media: "border-l-info",
  baixa: "border-l-surface-strong",
};

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

  // O mais urgente primeiro e, dentro da mesma urgência, o mais antigo.
  const alertas = [...(data?.data ?? [])].sort((a, b) =>
    URGENCIA[a.priority] - URGENCIA[b.priority] || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
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

  if (loading && !data) return <div className="card p-4 text-sm text-text-muted">A ver o que está à tua espera…</div>;
  // Uma fila que não se conseguiu ler NÃO é uma fila vazia: dizê-lo.
  if (error) {
    return (
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-warning">
        <p className="text-sm text-text-primary">Não foi possível ver a fila agora. Pode haver coisas à tua espera.</p>
        <button onClick={refetch} className="btn-secondary text-xs py-1.5"><RefreshCw className="h-3.5 w-3.5" /> Tentar de novo</button>
      </div>
    );
  }

  return (
    <section aria-labelledby="precisa-de-ti">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="precisa-de-ti" className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Precisa de ti{alertas.length > 0 && <span className="ml-1.5 text-text-primary">{alertas.length}</span>}
        </h2>
        {alertas.length > 0 && (onVerTodos ? (
          <button onClick={onVerTodos} className="text-sm text-piquet-600 hover:underline">
            {alertas.length > MAXIMO ? `Ver todos (${alertas.length})` : "Ver em Alertas"} →
          </button>
        ) : (
          <Link href="/?tab=alertas" className="text-sm text-piquet-600 hover:underline">
            {alertas.length > MAXIMO ? `Ver todos (${alertas.length})` : "Ver em Alertas"} →
          </Link>
        ))}
      </div>

      {fila.length === 0 ? (
        <div className="card p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <p className="text-sm text-text-primary"><b>Nada pendente.</b> Bom trabalho.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {fila.map((a) => {
            const d = destinoDoAlerta(a);
            return (
              <li key={a.id} className={cn("card border-l-[3px] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2", COR[a.priority])}>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium text-text-primary">{a.title}</p>
                  <p className="text-sm text-text-secondary truncate">
                    {a.description}
                    {a.createdAt && temHoraPropria(a) && <span className="text-text-muted"> · {haQuanto(a.createdAt)}</span>}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{a.recommendedAction}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => adiar(a)}
                    disabled={aMexer === a.id}
                    className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
                    title="Tirar da fila até amanhã às 9:00 (volta se ainda for preciso)"
                  >
                    Adiar
                  </button>
                  {podeDispensar(a) && (
                    <button
                      onClick={() => setADispensar(a)}
                      className="text-xs text-text-muted hover:text-text-primary"
                      title="Tirar da fila de vez, com o motivo"
                    >
                      Não é preciso
                    </button>
                  )}
                  <Link href={d.href} className="btn-primary text-sm py-1.5 inline-flex items-center gap-1">
                    {d.label} <ArrowRight className="h-4 w-4" />
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
