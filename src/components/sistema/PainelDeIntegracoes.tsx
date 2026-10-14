"use client";

import { AlertTriangle } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getIntegrationsStatus } from "@/services/backofficeService";
import { formatDateTime } from "@/lib/formatters";
import { SectionHeader } from "@/components/ui/PageHeader";
import { Etiqueta } from "@/components/ui/Ficha";

/**
 * A saúde das pipelines de dados (crons e avisos do Payshop): estado,
 * última execução e falhas seguidas. Vivia em Produto › Integrações; é tema
 * técnico e passou para Configurações › Sistema (auditoria de 08/10/2026).
 */
/** Como se mostra o estado de cada pipeline (ver src/lib/saudeDasIntegracoes.ts). */
const ESTADO_DA_INTEGRACAO: Record<string, { tom: "bom" | "perigo" | "atencao" | "neutro"; label: string }> = {
  ok: { tom: "bom", label: "Operacional" },
  falha: { tom: "perigo", label: "Em falha" },
  atrasado: { tom: "atencao", label: "Atrasado" },
  sem_avisos: { tom: "neutro", label: "Sem avisos" },
  nunca: { tom: "neutro", label: "Nunca correu" },
};

export function PainelDeIntegracoes() {
  const { data: health } = useAsyncData(() => getIntegrationsStatus(), []);
  const aFalhar = (health?.jobs ?? []).filter((j) => j.consecutiveFailures >= 2);
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <SectionHeader title="Pipelines de dados" description="Os trabalhos que trazem dados de fora (lojas, anúncios, Payshop): estado, última execução e falhas seguidas." className="mb-0" />

        {/* Falhas repetidas primeiro — é o alerta que faltava quando o
            Google Play esteve uma semana em 403 sem ninguém reparar. */}
        {aFalhar.map((j) => (
          <div key={`alert-${j.id}`} className="aviso aviso-perigo flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{j.name} está a falhar há {j.consecutiveFailures} execuções seguidas</p>
              <p className="text-xs text-text-secondary mt-0.5">Último erro: {j.lastDetail || "—"} · Último sucesso: {j.lastOkAt ? formatDateTime(j.lastOkAt) : "nunca"}</p>
            </div>
          </div>
        ))}

        <ul className="card divide-y divide-surface-border">
          {(health?.jobs ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-text-muted">A carregar…</li>}
          {(health?.jobs ?? []).map((j) => {
            const estado = j.estado ?? (j.lastRunOk === null ? "nunca" : j.lastRunOk ? "ok" : "falha");
            const { tom, label } = ESTADO_DA_INTEGRACAO[estado];
            return (
              <li key={j.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {j.name} <span className="font-normal text-text-muted">· {j.providers.join(" + ")} · {j.schedule}</span>
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {j.lastRunAt
                      ? <>Última execução {formatDateTime(j.lastRunAt)} · {j.lastUpserted} registos{!j.lastRunOk && j.lastDetail ? <> · <span className="text-danger">{j.lastDetail.slice(0, 120)}</span></> : null}</>
                      : estado === "sem_avisos" ? "Nenhum aviso do Payshop recebido." : "Sem execuções registadas — a primeira fica registada no próximo ciclo."}
                  </p>
                  {estado === "sem_avisos" && (
                    <p className="text-xs text-text-muted mt-1">
                      O Payshop só avisa as ordens criadas com o URL do aviso, que o Laravel junta quando tem
                      PAYSHOP_SDK_NOTIFICATION_URL definida. Até lá o cron diário das 06:30 traz tudo na mesma.
                    </p>
                  )}
                  {estado === "atrasado" && (
                    <p className="text-xs text-warning mt-1">Não corre há mais de um dia: o cron devia ter corrido entretanto.</p>
                  )}
                </div>
                <div className="shrink-0"><Etiqueta tom={tom}>{label}</Etiqueta></div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeader title="Credenciais configuradas" description="Os serviços externos com credenciais definidas. A cinzento, os que ainda não as têm." />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(health?.configured ?? {}).map(([name, on]) => (
            <Etiqueta key={name} tom={on ? "bom" : "neutro"}>{name}</Etiqueta>
          ))}
        </div>
      </section>
    </div>
  );
}
