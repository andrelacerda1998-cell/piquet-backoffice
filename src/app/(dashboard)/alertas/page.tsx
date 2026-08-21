"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bell, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { PriorityBadge, AlertTypeBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts } from "@/services/supportService";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { DashboardAlert, AlertPriority } from "@/types";

/**
 * Alertas DERIVADOS do estado real do negócio.
 *
 * O ecrã anterior tinha estados ("Analisar", "Resolver") que não gravavam
 * nada: a lista vinha de `mockData.alerts` em memória e voltava ao início a
 * cada recarregamento. Dava a sensação de haver vigilância a acontecer.
 *
 * Um alerta destes não se "resolve" aqui — resolve-se resolvendo a causa. Por
 * isso a única ação é ir ao ecrã onde isso se faz, e o alerta desaparece
 * sozinho quando o motivo deixar de existir.
 */

/** Para onde vai o botão de cada alerta, conforme o que o originou. */
function destino(a: DashboardAlert): { href: string; label: string } {
  // Os `tab` têm de bater certo com os ids reais de cada página — três destes
  // apontavam para separadores que não existem ("kyc", "faturas") e o clique
  // abria a página no separador por omissão, como se não tivesse funcionado.
  switch (a.entityType) {
    // Com o id, o CRM abre o pedido em vez de deixar o utilizador à procura.
    case "lead": return { href: `/leads?lead=${a.entityId ?? ""}`, label: "Abrir pedido" };
    case "ticket": return { href: `/suporte?ticket=${a.entityId ?? ""}`, label: "Abrir ticket" };
    case "integracao": return { href: "/produto?tab=integracoes", label: "Ver integrações" };
    case "kyc": return { href: "/tecnicos?tab=aprovacoes", label: "Rever documentos" };
    case "marketing": return { href: "/marketing", label: "Ir para Marketing" };
    case "pagamentos": return { href: "/financeiro?tab=app-pagamentos", label: "Ver pagamentos" };
    case "fatura": return { href: "/financeiro?tab=custos", label: "Ver faturas" };
    // KYC, integrações e impostos são filas/listas, não um registo só — o
    // destino certo é mesmo o separador.
    case "imposto": return { href: "/financeiro?tab=impostos", label: "Ver impostos" };
    default: return { href: "/", label: "Abrir" };
  }
}

const GRUPOS: Array<{ p: AlertPriority; titulo: string; nota: string }> = [
  { p: "critica", titulo: "A precisar de atenção agora", nota: "Está parado há demasiado tempo" },
  { p: "alta", titulo: "Para tratar hoje", nota: "" },
  { p: "media", titulo: "Quando houver tempo", nota: "" },
  { p: "baixa", titulo: "Informativo", nota: "" },
];

export default function AlertsPage() {
  const { data, loading, refetch } = useAsyncData(() => getAlerts(1, 200), []);
  const alertas = useMemo(() => data?.data ?? [], [data]);
  const fontesEmFalta = (data as unknown as { fontesIndisponiveis?: string[] })?.fontesIndisponiveis ?? [];

  const porGrupo = useMemo(
    () => GRUPOS.map((g) => ({ ...g, itens: alertas.filter((a) => a.priority === g.p) }))
      .filter((g) => g.itens.length > 0),
    [alertas],
  );

  return (
    <RouteGuard route="/alertas">
      <div className="space-y-6">
        <PageHeader
          icon={Bell}
          eyebrow="Operação"
          title="Alertas"
          subtitle="O que precisa de ação, apurado a partir dos dados reais do negócio"
          actions={
            <button onClick={refetch} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Verificar agora
            </button>
          }
        />

        {fontesEmFalta.length > 0 && (
          <div className="rounded-xl border-l-[3px] border-l-warning bg-warning-light/40 px-4 py-3 text-sm">
            <p className="font-medium text-text-primary">Verificação incompleta</p>
            <p className="text-text-secondary">
              Não foi possível consultar: {fontesEmFalta.join(", ")}. Podem existir alertas por mostrar.
            </p>
          </div>
        )}

        {loading && alertas.length === 0 && (
          <p className="text-sm text-text-muted py-10 text-center">A verificar…</p>
        )}

        {!loading && alertas.length === 0 && (
          <div className="card p-10 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-3" />
            <p className="font-semibold text-text-primary">Nada a assinalar</p>
            <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
              Sem leads por responder, integrações paradas, tickets sem resposta ou fila de
              documentos acumulada. Esta página só mostra alguma coisa quando há mesmo.
            </p>
          </div>
        )}

        {porGrupo.map((g) => (
          <section key={g.p} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-semibold text-text-primary">{g.titulo}</h2>
              <span className="text-xs text-text-muted">
                {g.itens.length} {g.itens.length === 1 ? "alerta" : "alertas"}
                {g.nota && ` · ${g.nota}`}
              </span>
            </div>
            <div className="space-y-2">
              {g.itens.map((a) => {
                const d = destino(a);
                return (
                  <Link
                    key={a.id}
                    href={d.href}
                    className={cn(
                      // O cartão todo é o link: clicar no texto do alerta era o
                      // gesto natural e não fazia nada — só o botão da direita
                      // navegava.
                      "card p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-surface-muted transition-colors",
                      a.priority === "critica" && "border-l-[3px] border-l-danger",
                      a.priority === "alta" && "border-l-[3px] border-l-warning",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={a.priority} />
                        <AlertTypeBadge type={a.type} />
                        <span className="text-[11px] text-text-muted">{formatDateTime(a.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 font-medium text-text-primary">{a.title}</p>
                      <p className="text-sm text-text-secondary">{a.description}</p>
                      <p className="text-xs text-text-muted mt-1">→ {a.recommendedAction}</p>
                    </div>
                    <span className="btn-secondary shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto pointer-events-none">
                      {d.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {alertas.length > 0 && (
          <p className="text-xs text-text-muted">
            Os alertas são recalculados a cada visita e desaparecem sozinhos quando o motivo
            deixa de existir — não há nada para marcar como resolvido.
          </p>
        )}
      </div>
    </RouteGuard>
  );
}
