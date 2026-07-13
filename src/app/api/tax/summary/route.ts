import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToTaxObligation, type TaxObligationRow } from "@/lib/supabase/adapters";
import { calculateEstimatedVat } from "@/lib/calculations";
import { TODAY } from "@/lib/today";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/tax/summary — resumo fiscal (mesma lógica do mock, sobre a BD). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("tax_obligations").select("*");
  if (error) throw new Error(error.message);
  const obligations = ((data ?? []) as TaxObligationRow[]).map(rowToTaxObligation);

  const now = TODAY;
  const thisMonth = now.toISOString().slice(0, 7);
  const daysTo = (d: string) => (new Date(d).getTime() - now.getTime()) / 86400000;

  const thisMonthObs = obligations.filter((o) => o.referencePeriod === thisMonth || o.dueDate.startsWith(thisMonth));
  const paid = obligations.filter((o) => o.status === "pago");
  const pending = obligations.filter((o) => !["pago", "cancelado", "nao_aplicavel"].includes(o.status));
  const overdue = obligations.filter((o) => o.status === "vencido");
  const upcoming7 = obligations.filter((o) => o.status !== "pago" && daysTo(o.dueDate) >= 0 && daysTo(o.dueDate) <= 7);
  const upcoming30 = obligations.filter((o) => o.status !== "pago" && daysTo(o.dueDate) >= 0 && daysTo(o.dueDate) <= 30);
  const nextObligation = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const ivaLiquidado = 18500;
  const ivaDedutivel = 8200;
  const ivaEstimado = calculateEstimatedVat(ivaLiquidado, ivaDedutivel);

  return apiOk({
    estimatedThisMonth: thisMonthObs.reduce((s, o) => s + o.amountEstimated, 0),
    paidThisMonth: paid.filter((o) => o.paymentDate?.startsWith(thisMonth)).reduce((s, o) => s + (o.amountConfirmed ?? 0), 0),
    pending: pending.reduce((s, o) => s + o.amountEstimated, 0),
    nextObligation: nextObligation?.name ?? "—",
    nextObligationAmount: nextObligation?.amountEstimated ?? 0,
    nextObligationDue: nextObligation?.dueDate,
    estimatedVat: ivaEstimado,
    estimatedSocialSecurity: 12400,
    estimatedWithholdings: 3200,
    accumulatedYear: obligations.reduce((s, o) => s + (o.amountConfirmed ?? o.amountEstimated), 0),
    overdueCount: overdue.length,
    upcoming7Count: upcoming7.length,
    upcoming30Count: upcoming30.length,
    ivaLiquidado,
    ivaDedutivel,
    ivaEstimado,
    ivaLabel: ivaEstimado > 0 ? "IVA estimado a pagar" : "IVA estimado a recuperar ou reportar",
  });
});
