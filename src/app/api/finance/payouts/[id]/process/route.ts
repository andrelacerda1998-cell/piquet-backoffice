import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { deriveTechnicianPayouts } from "../../../../_lib/payouts";

/**
 * PUT /api/finance/payouts/:id/process — marca um pagamento como processado.
 * O id é derivado ("po|<YYYY-MM>|<techKey>"); o valor NÃO vem do cliente —
 * re-deriva-se dos serviços concluídos e grava-se um registo idempotente.
 */
export const PUT = withStaff(async (_req, { params }) => {
  const id = decodeURIComponent(params.id);
  const payouts = await deriveTechnicianPayouts();
  const payout = payouts.find((p) => p.id === id);
  if (!payout) return apiErr("Pagamento não encontrado.", 404);

  const { error } = await supabaseAdmin().from("technician_payout_records").upsert({
    id: payout.id,
    technician_key: payout.technicianKey,
    technician_name: payout.technicianName,
    period: payout.period,
    amount: Math.round(payout.amountDue * 100) / 100,
    services: payout.services,
  }, { onConflict: "technician_key,period" });
  if (error) return apiErr(error.message, 400);

  return apiOk({
    id: payout.id,
    technicianName: payout.technicianName,
    services: payout.services,
    amountDue: Math.round(payout.amountDue * 100) / 100,
    period: payout.period,
    status: "processado" as const,
  });
});
