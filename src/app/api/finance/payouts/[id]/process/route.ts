import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

interface PayoutRow {
  id: string; technician_name: string; services: number; amount_due: number;
  period: string; status: string;
}

function toPayout(r: PayoutRow) {
  return {
    id: r.id, technicianName: r.technician_name, services: Number(r.services) || 0,
    amountDue: Number(r.amount_due) || 0, period: r.period,
    status: r.status as "pendente" | "processado",
  };
}

/** PUT /api/finance/payouts/:id/process — marca o pagamento como processado. */
export const PUT = withStaff(async (_req, { params }) => {
  const { data, error } = await supabaseAdmin()
    .from("technician_payouts")
    .update({ status: "processado", processed_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Pagamento não encontrado.", 404);
  return apiOk(toPayout(data as PayoutRow));
});
