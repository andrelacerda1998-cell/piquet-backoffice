import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToTaxObligation, type TaxObligationRow } from "@/lib/supabase/adapters";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

/** PUT /api/tax/obligations/:id/pay — marca uma obrigação como paga. */
export const PUT = withStaff(async (req, { params }) => {
  const b = (await req.json()) as { paymentDate?: string; amount?: number };
  const admin = supabaseAdmin();

  // Confirma o valor pago: amount indicado, ou o estimado da obrigação.
  const { data: current } = await admin.from("tax_obligations").select("amount_estimated").eq("id", params.id).single();
  const amountConfirmed = b.amount ?? (current?.amount_estimated as number | undefined) ?? 0;

  const { data, error } = await admin
    .from("tax_obligations")
    .update({
      status: "pago",
      payment_date: b.paymentDate ?? new Date().toISOString(),
      amount_confirmed: amountConfirmed,
      is_estimated: false,
    })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Obrigação não encontrada.", 404);
  return apiOk(rowToTaxObligation(data as TaxObligationRow));
});
