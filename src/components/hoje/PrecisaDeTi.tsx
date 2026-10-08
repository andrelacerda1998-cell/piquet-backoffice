"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts, adiarAlerta } from "@/services/supportService";
import { destinoDoAlerta } from "@/lib/alertLinks";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import type { AlertPriority, DashboardAlert } from "@/types";

/**
 * "Precisa de ti": a fila do que está à espera de alguém da equipa, à cabeça
 * da Visão Geral.
 *
 * São os mesmos alertas do ecrã de Alertas (mesmas regras, mesmos destinos,
 * mesmos adiamentos), só os mais urgentes e com uma ação cada. Antes, a
 * Visão Geral abria em quinze números e dois cartões (leads e documentos);
 * nada dizia que um pedido tinha acabado sem técnico há quatro minutos.
 */
const MAXIMO = 6;

const URGENCIA: Record<AlertPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

const COR: Record<AlertPriority, string> = {
  critica: "border-l-danger",
  alta: "border-l-warning",
  media: "border-l-piquet",
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

export function PrecisaDeTi() {
  const { data, loading, error, refetch } = useAsyncData(() => getAlerts(1, 200), []);
  const [aAdiar, setAAdiar] = useState<string | null>(null);

  // O mais urgente primeiro e, dentro da mesma urgência, o mais antigo.
  const alertas = [...(data?.data ?? [])].sort((a, b) =>
    URGENCIA[a.priority] - URGENCIA[b.priority] || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const fila = alertas.slice(0, MAXIMO);

  const adiar = async (a: DashboardAlert) => {
    setAAdiar(a.id);
    try {
      const amanha = new Date(Date.now() + 86_400_000).toISOString();
      await adiarAlerta(a.id, amanha);
      toast("Adiado para amanhã.");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível adiar.", "error");
    } finally {
      setAAdiar(null);
    }
  };

  if (loading && !data) return <div className="card p-4 text-sm text-text-muted">A ver o que está à tua espera…</div>;
  if (error) return null;

  return (
    <section aria-labelledby="precisa-de-ti">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="precisa-de-ti" className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Precisa de ti{alertas.length > 0 && <span className="ml-1.5 text-text-primary">{alertas.length}</span>}
        </h2>
        {alertas.length > 0 && (
          <Link href="/alertas" className="text-sm text-piquet-600 hover:underline">
            {alertas.length > MAXIMO ? `Ver todos (${alertas.length})` : "Ver em Alertas"} →
          </Link>
        )}
      </div>

      {fila.length === 0 ? (
        <div className="card p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <p className="text-sm text-text-primary">Nada à tua espera. Os pedidos, os contactos e os documentos estão em dia.</p>
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
                    {a.createdAt && <span className="text-text-muted"> · {haQuanto(a.createdAt)}</span>}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{a.recommendedAction}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => adiar(a)}
                    disabled={aAdiar === a.id}
                    className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
                    title="Tirar da fila até amanhã"
                  >
                    Amanhã
                  </button>
                  <Link href={d.href} className="btn-primary text-sm py-1.5 inline-flex items-center gap-1">
                    {d.label} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
