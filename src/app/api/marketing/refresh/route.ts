import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { ingestAdMetrics } from "../../_lib/adIngest";
import { logCronRun } from "../../_lib/cronlog";

/**
 * "Atualizar agora" do módulo Marketing — corre a mesma recolha do cron diário,
 * a pedido do staff, sem depender do CRON_SECRET.
 *
 * Existe porque esperar pelas 06:20 UTC é inútil quando se acabou de arranjar
 * uma credencial: queremos saber já se ficou bom. Fica registado em `cron_runs`
 * como qualquer outra corrida (com o email de quem a pediu), para o painel de
 * Integrações não mentir sobre a origem dos dados.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withStaff(async (_req, { staff }) => {
  const r = await ingestAdMetrics();
  await logCronRun(
    "ad-metrics",
    r.ok,
    [`manual: ${staff.email}`, ...r.errors, ...r.skipped, ...r.notes].join(" | "),
    r.upsertedCount,
  );
  if (!r.ok) return apiErr(r.errors.join(" | ") || "Falha na recolha.", 502);
  return apiOk(r);
});
