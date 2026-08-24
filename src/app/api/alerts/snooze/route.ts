import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

/**
 * POST /api/alerts/snooze — adiar um alerta até uma data.
 * DELETE /api/alerts/snooze?id=… — voltar a mostrá-lo já.
 *
 * Adiar não é resolver: o alerta volta na data escolhida se o motivo ainda lá
 * estiver. É a diferença entre "já decidi o que fazer com isto" e "isto está
 * tratado" — sem ela, os alertas que demoram (uma fatura com plano de
 * pagamento, um imposto já submetido) ficariam vermelhos para sempre.
 */

export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json().catch(() => null)) as { alertId?: string; until?: string; note?: string } | null;
  const alertId = (b?.alertId ?? "").trim();
  const until = (b?.until ?? "").trim();
  if (!alertId) return apiErr("Falta o alerta a adiar.");

  const quando = new Date(until);
  if (Number.isNaN(quando.getTime())) return apiErr("Data de adiamento inválida.");
  // Adiar para o passado seria o mesmo que não adiar, e deixaria um registo a
  // sugerir o contrário.
  if (quando.getTime() <= Date.now()) return apiErr("A data tem de ser no futuro.");

  const { error } = await supabaseAdmin()
    .from("alert_snoozes")
    .upsert({
      alert_id: alertId,
      snooze_until: quando.toISOString(),
      note: (b?.note ?? "").slice(0, 500),
      created_by: staff.email,
    }, { onConflict: "alert_id" });

  if (error) {
    // Sem a migração aplicada, dizer o que falta em vez de um 500 opaco.
    if (isMissingTable(error, "alert_snoozes")) {
      return apiErr("Adiar alertas precisa da migração alert_snoozes.", 501);
    }
    throw new Error(error.message);
  }
  return apiOk({ alertId, until: quando.toISOString() });
});

export const DELETE = withStaff(async (req) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return apiErr("Falta o alerta.");
  const { error } = await supabaseAdmin().from("alert_snoozes").delete().eq("alert_id", id);
  if (error && !isMissingTable(error, "alert_snoozes")) throw new Error(error.message);
  return apiOk({ alertId: id });
});
