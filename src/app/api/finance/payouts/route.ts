import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { deriveTechnicianPayouts } from "../../_lib/payouts";

/**
 * GET /api/finance/payouts — pagamentos a técnicos REAIS, derivados dos
 * serviços concluídos (technician_value somado por técnico × mês).
 * "processado" vem de technician_payout_records; o resto está pendente.
 * (Substituiu a leitura do seed technician_payouts a 2026-07-22.)
 */
export const GET = withStaff(async () => {
  const [payouts, { data: records, error }] = await Promise.all([
    deriveTechnicianPayouts(),
    supabaseAdmin().from("technician_payout_records").select("id, paid_at"),
  ]);
  if (error) throw new Error(error.message);
  const paid = new Map(((records ?? []) as { id: string; paid_at: string }[]).map((r) => [r.id, r.paid_at]));

  return apiOk(payouts.map((p) => ({
    id: p.id,
    technicianName: p.technicianName,
    services: p.services,
    amountDue: Math.round(p.amountDue * 100) / 100,
    period: p.period,
    status: paid.has(p.id) ? ("processado" as const) : ("pendente" as const),
    paidAt: paid.get(p.id) ?? null,
  })));
});
