import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { motivoValido } from "@/lib/motivo";

/**
 * POST /api/alerts/snooze — adiar um alerta até uma data.
 * DELETE /api/alerts/snooze?id=… — voltar a mostrá-lo já.
 *
 * Adiar não é resolver: o alerta volta na data escolhida se o motivo ainda lá
 * estiver. É a diferença entre "já decidi o que fazer com isto" e "isto está
 * tratado" — sem ela, os alertas que demoram (uma fatura com plano de
 * pagamento, um imposto já submetido) ficariam vermelhos para sempre.
 */

/**
 * "Não é preciso": o alerta sai da fila sem data de volta, com o motivo e o
 * nome de quem decidiu. Os ids dos alertas são de um caso concreto (o pedido
 * 282, a lead 17), por isso não esconde o próximo caso igual.
 */
const PARA_SEMPRE = "9999-12-31T00:00:00.000Z";

export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json().catch(() => null)) as { alertId?: string; until?: string; note?: string; naoEPreciso?: boolean; motivo?: string } | null;
  const alertId = (b?.alertId ?? "").trim();
  if (!alertId) return apiErr("Falta o alerta a adiar.");

  if (b?.naoEPreciso) {
    // Um resumo (grupo) junta vários casos: dar a família inteira como "não é preciso" esconderia os próximos.
    if (alertId.startsWith("grupo-") || !/\d/.test(alertId)) return apiErr("Este alerta junta vários casos: só se pode adiar.", 422);
    const motivo = motivoValido(b.motivo);
    if (!motivo) return apiErr("Escreve porque não é preciso (pelo menos 5 letras). Fica registado com o teu nome.", 422);
    const { error } = await supabaseAdmin().from("alert_snoozes").upsert({
      alert_id: alertId, snooze_until: PARA_SEMPRE, note: `Não é preciso: ${motivo}`.slice(0, 500), created_by: staff.email,
    }, { onConflict: "alert_id" });
    if (error) {
      if (isMissingTable(error, "alert_snoozes")) return apiErr("Adiar alertas precisa da migração alert_snoozes.", 501);
      throw new Error(error.message);
    }
    return apiOk({ alertId, until: PARA_SEMPRE });
  }

  const until = (b?.until ?? "").trim();
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
