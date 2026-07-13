import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { calculateBurnRate, calculateRunway, calculatePiquetRevenueWithoutVat } from "@/lib/calculations";
import { DEFAULT_TAX_CONFIG } from "@/config/dashboard";
import { apiOk, withStaff } from "../../_lib/handler";
import { completedQuery, parseFinanceFilters } from "../../_lib/finance";

interface Completed { piquet_revenue: number; total_customer_value: number; technician_value: number; invoice_status: string }

/** GET /api/finance/summary — resumo financeiro (serviços + opex de equipa + impostos). */
export const GET = withStaff(async (req) => {
  const f = parseFinanceFilters(new URL(req.url));
  const admin = supabaseAdmin();

  const [completedRes, empRes, taxRes, cancelRes, refundRes] = await Promise.all([
    completedQuery("piquet_revenue, total_customer_value, technician_value, invoice_status", f),
    admin.from("employees").select("*"),
    admin.from("tax_obligations").select("amount_estimated, status"),
    admin.from("services").select("id", { count: "exact", head: true }).or("status.eq.cancelado_cliente,status.eq.cancelado_tecnico"),
    admin.from("services").select("total_customer_value").eq("status", "reembolsado"),
  ]);
  if (completedRes.error) throw new Error(completedRes.error.message);
  if (empRes.error) throw new Error(empRes.error.message);

  const completed = (completedRes.data ?? []) as Completed[];
  const piquetRevenue = completed.reduce((s, r) => s + Number(r.piquet_revenue), 0);
  const totalServiceValue = completed.reduce((s, r) => s + Number(r.total_customer_value), 0);
  const technicianOwed = completed.reduce((s, r) => s + Number(r.technician_value), 0);

  const teamCosts = ((empRes.data ?? []) as EmployeeRow[]).reduce((s, r) => s + computeEmployeeCost(rowToEmployee(r)).averageMonthlyCost, 0);
  const estimatedTaxes = ((taxRes.data ?? []) as { amount_estimated: number; status: string }[])
    .filter((t) => t.status !== "pago")
    .reduce((s, t) => s + Number(t.amount_estimated), 0);
  const refunds = ((refundRes.data ?? []) as { total_customer_value: number }[]).reduce((s, r) => s + Number(r.total_customer_value), 0);

  const vatRate = DEFAULT_TAX_CONFIG.vatRate;
  const operatingCosts = teamCosts + 4500;
  const burnRate = calculateBurnRate(operatingCosts + 3000, piquetRevenue);
  const currentBalance = 185000;
  const revenueWithoutVat = calculatePiquetRevenueWithoutVat(piquetRevenue, vatRate);

  return apiOk({
    totalServiceValue,
    piquetRevenue,
    piquetRevenueWithoutVat: revenueWithoutVat,
    vat: piquetRevenue - revenueWithoutVat,
    technicianOwed,
    technicianPaid: technicianOwed * 0.88,
    pendingPayments: technicianOwed * 0.12,
    refunds,
    cancellations: cancelRes.count ?? 0,
    invoicesIssued: completed.filter((s) => s.invoice_status === "emitida").length,
    invoicesWithError: completed.filter((s) => s.invoice_status === "com_erro").length,
    operatingCosts,
    teamCosts,
    estimatedTaxes,
    estimatedMonthlyResult: piquetRevenue - operatingCosts - 3000,
    estimatedAnnualResult: (piquetRevenue - operatingCosts - 3000) * 12,
    averageMarginPerService: completed.length ? piquetRevenue / completed.length : 0,
    burnRate,
    runwayMonths: calculateRunway(currentBalance, burnRate),
    currentBalance,
    projectedBalance: currentBalance + piquetRevenue - operatingCosts,
  });
});
