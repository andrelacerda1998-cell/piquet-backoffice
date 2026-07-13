import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

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

/** GET /api/finance/payouts — pagamentos a técnicos (por valor devido). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("technician_payouts")
    .select("*")
    .order("amount_due", { ascending: false });
  if (error) throw new Error(error.message);
  return apiOk(((data ?? []) as PayoutRow[]).map(toPayout));
});
