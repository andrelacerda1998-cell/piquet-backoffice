"use client";

import { AlertTriangle, Plug } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getIntegrationsStatus } from "@/services/backofficeService";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * A saúde das pipelines de dados (crons e avisos do Payshop): estado,
 * última execução e falhas seguidas. Vivia em Produto › Integrações; é tema
 * técnico e passou para Configurações › Sistema (auditoria de 08/10/2026).
 */
/** Como se mostra o estado de cada pipeline (ver src/lib/saudeDasIntegracoes.ts). */
const ESTADO_DA_INTEGRACAO: Record<string, { tone: string; label: string }> = {
  ok: { tone: "bg-success-light text-success", label: "Operacional" },
  falha: { tone: "bg-danger-light text-danger", label: "Em falha" },
  atrasado: { tone: "bg-warning-light text-warning", label: "Atrasado" },
  sem_avisos: { tone: "bg-surface-subtle text-text-secondary", label: "Sem avisos" },
  nunca: { tone: "bg-surface-subtle text-text-secondary", label: "Nunca correu" },
};

export function PainelDeIntegracoes() {
  const { data: health } = useAsyncData(() => getIntegrationsStatus(), []);
  return (
          <div className="space-y-6">
            {/* Falhas repetidas primeiro — é o alerta que faltava quando o
                Google Play esteve uma semana em 403 sem ninguém reparar. */}
            {(health?.jobs ?? []).filter((j) => j.consecutiveFailures >= 2).map((j) => (
              <div key={`alert-${j.id}`} className="card p-4 border-l-4 border-danger bg-danger-light/40 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-text-primary">{j.name} está a falhar há {j.consecutiveFailures} execuções seguidas</p>
                  <p className="text-xs text-text-secondary mt-0.5">Último erro: {j.lastDetail || "—"} · Último sucesso: {j.lastOkAt ? formatDateTime(j.lastOkAt) : "nunca"}</p>
                </div>
              </div>
            ))}

            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">Pipelines de dados</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(health?.jobs ?? []).map((j) => {
                  const estado = j.estado ?? (j.lastRunOk === null ? "nunca" : j.lastRunOk ? "ok" : "falha");
                  const { tone, label } = ESTADO_DA_INTEGRACAO[estado];
                  return (
                    <div key={j.id} className="card p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700 shrink-0"><Plug className="h-4 w-4" /></span>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{j.name}</p>
                            <p className="text-[11px] text-text-muted">{j.providers.join(" + ")} · {j.schedule}</p>
                          </div>
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0", tone)}>{label}</span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        {j.lastRunAt
                          ? <>Última execução {formatDateTime(j.lastRunAt)} · {j.lastUpserted} registos{!j.lastRunOk && j.lastDetail ? <> · <span className="text-danger">{j.lastDetail.slice(0, 120)}</span></> : null}</>
                          : estado === "sem_avisos" ? "Nenhum aviso do Payshop recebido." : "Sem execuções registadas — a primeira fica registada no próximo ciclo."}
                      </p>
                      {estado === "sem_avisos" && (
                        <p className="text-xs text-text-muted">
                          O Payshop só avisa as ordens criadas com o URL do aviso, que o Laravel junta quando tem
                          PAYSHOP_SDK_NOTIFICATION_URL definida. Até lá o cron diário das 06:30 traz tudo na mesma.
                        </p>
                      )}
                      {estado === "atrasado" && (
                        <p className="text-xs text-warning">Não corre há mais de um dia: o cron devia ter corrido entretanto.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">Credenciais configuradas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(health?.configured ?? {}).map(([name, on]) => (
                  <span key={name} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    on ? "bg-success-light text-success" : "bg-surface-subtle text-text-muted")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-success" : "bg-text-muted")} />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
  );
}
