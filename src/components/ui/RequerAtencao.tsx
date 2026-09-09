"use client";

import Link from "next/link";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts } from "@/services/supportService";
import { rotaDoAlerta } from "@/lib/navBadges";
import { cn } from "@/lib/utils";
import { ArrowRight, AlertTriangle } from "lucide-react";
import type { DashboardAlert, AlertPriority } from "@/types";

/**
 * O que está à espera de alguém, no topo do ecrã inicial.
 *
 * Vem da MESMA fonte das bolinhas do menu e do ecrã de Alertas (`/alerts`), em
 * vez de fazer as suas próprias contas. A versão anterior deste bloco olhava
 * só para leads por responder e documentos por aprovar, e fazia-o com contas
 * próprias: mostrava dois dos sete tipos de problema, e podia discordar do
 * número que o menu mostrava ao lado.
 *
 * Um ecrã de alertas é um sítio onde se vai; um bloco no ecrã inicial é uma
 * coisa que se vê. Por isso os problemas passam a estar antes das métricas.
 */

const TOM: Record<AlertPriority, { barra: string; texto: string }> = {
  critica: { barra: "bg-danger", texto: "text-danger" },
  alta: { barra: "bg-warning", texto: "text-warning" },
  media: { barra: "bg-info", texto: "text-info" },
  baixa: { barra: "bg-text-muted", texto: "text-text-muted" },
};

/** O número que o alerta traz no título ("3 documentos…"), quando traz. */
function quantos(a: DashboardAlert): string {
  return a.title.match(/^(\d+)\s/)?.[1] ?? "";
}

export function RequerAtencao({ limite = 6 }: { limite?: number }) {
  const { data } = useAsyncData(() => getAlerts(1, 50), []);
  const alertas = data?.data ?? [];

  /*
    Primeiro o mais urgente, e dentro da mesma urgência o mais antigo: um
    problema que já lá está há três dias é pior do que um igual de hoje.
  */
  const ordem: AlertPriority[] = ["critica", "alta", "media", "baixa"];
  const ordenados = [...alertas].sort(
    (a, b) => ordem.indexOf(a.priority) - ordem.indexOf(b.priority)
      || (a.createdAt || "").localeCompare(b.createdAt || ""),
  );
  const mostrar = ordenados.slice(0, limite);
  const restantes = ordenados.length - mostrar.length;

  // Sem problemas não se ocupa espaço a dizer que não há problemas.
  if (ordenados.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-text-muted inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Requer atenção
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold tracking-normal text-text-secondary">
            {ordenados.length}
          </span>
        </h2>
        {restantes > 0 && (
          <Link href="/alertas" className="text-xs text-piquet-700 hover:underline">
            ver os outros {restantes}
          </Link>
        )}
      </div>

      <div className="card divide-y divide-surface-border overflow-hidden">
        {mostrar.map((a) => {
          const tom = TOM[a.priority];
          const n = quantos(a);
          return (
            <Link
              key={a.id}
              href={rotaDoAlerta(a) ?? "/alertas"}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/50 transition-colors group"
            >
              <span className={cn("w-[3px] h-8 rounded-full shrink-0", tom.barra)} />
              {n && <span className={cn("text-lg font-bold tabular-nums w-7 shrink-0", tom.texto)}>{n}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">{a.title}</span>
                <span className="block truncate text-xs text-text-secondary">{a.description}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-text-muted shrink-0 group-hover:text-piquet-700 transition-colors" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
