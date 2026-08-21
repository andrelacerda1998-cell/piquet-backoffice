import { supabaseAdmin } from "@/lib/supabase/server";
import { custosFixosMensais } from "@/lib/custosFixos";
import { calcularResultado } from "@/lib/resultado";
import { mesesNoIntervalo } from "@/lib/periodo";
import { getDateRangeFromPreset } from "@/lib/filters";
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

  const [completedRes, empRes, taxRes, cancelRes, refundRes, custosRes, pagoRes] = await Promise.all([
    completedQuery("piquet_revenue, total_customer_value, technician_value, invoice_status", f),
    admin.from("employees").select("*"),
    admin.from("tax_obligations").select("amount_estimated, status"),
    admin.from("services").select("id", { count: "exact", head: true }).or("status.eq.cancelado_cliente,status.eq.cancelado_tecnico"),
    admin.from("services").select("total_customer_value").eq("status", "reembolsado"),
    // Custo real da empresa (faturas de fornecedores) e o que já foi pago aos
    // técnicos — ambos substituem números que antes eram constantes no código.
    admin.from("company_invoices").select("amount, issue_date"),
    admin.from("technician_payout_records").select("amount"),
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

  /**
   * Custos fixos: equipa (real, de `employees`) + média das faturas de custo
   * (real, de `company_invoices`). Eram `+ 4500` e `+ 3000` — duas constantes
   * sem fonte que entravam no resultado, no burn rate e no runway.
   */
  const custos = custosFixosMensais(
    (custosRes.data ?? []) as Array<{ amount: number | null; issue_date: string | null }>,
    Date.now(),
  );
  const operatingCosts = teamCosts + custos.mediaMensal;

  /**
   * Saldo em conta: NÃO existe fonte no backoffice — não há ligação bancária
   * nem registo de tesouraria. Era a constante 185 000 €, e dela dependiam o
   * "Saldo previsto" e o "Runway", que assim eram ficção com ar de rigor.
   * Fica `null` e o ecrã diz que falta a fonte.
   */
  const currentBalance: number | null = null;
  const revenueWithoutVat = calculatePiquetRevenueWithoutVat(piquetRevenue, vatRate);

  /**
   * Os custos são MENSAIS; a receita vem do período escolhido no filtro. Antes
   * subtraía-se um mês de custos a (por exemplo) oito meses de receita, e
   * multiplicava-se isso por 12 para o "anual" — erro de ordem de grandeza,
   * com o sinal a poder inverter-se. Agora repartem-se os custos pelos meses
   * que o período tem de facto. Ver src/lib/resultado.ts.
   */
  const { start, end } = getDateRangeFromPreset(f.period ?? "ultimos_30_dias");
  const meses = mesesNoIntervalo(start, end);
  const opexMensal = operatingCosts;
  const res = calcularResultado(piquetRevenue, opexMensal, meses);
  // Burn rate é, por definição, mensal: usa a receita média por mês.
  const technicianPaid = ((pagoRes.data ?? []) as Array<{ amount: number | null }>)
    .reduce((s2, r) => s2 + (Number(r.amount) || 0), 0);
  const receitaMensalMedia = meses > 0 ? piquetRevenue / meses : piquetRevenue;
  const burnRate = calculateBurnRate(opexMensal, receitaMensalMedia);

  return apiOk({
    totalServiceValue,
    piquetRevenue,
    piquetRevenueWithoutVat: revenueWithoutVat,
    vat: piquetRevenue - revenueWithoutVat,
    technicianOwed,
    // Pago = registos reais de pagamento (technician_payout_records); o
    // pendente é o que falta do devido. Antes era uma repartição fixa 88/12
    // que não correspondia a pagamento nenhum.
    technicianPaid,
    pendingPayments: Math.max(technicianOwed - technicianPaid, 0),
    refunds,
    cancellations: cancelRes.count ?? 0,
    invoicesIssued: completed.filter((s) => s.invoice_status === "emitida").length,
    invoicesWithError: completed.filter((s) => s.invoice_status === "com_erro").length,
    operatingCosts,
    teamCosts,
    estimatedTaxes,
    estimatedMonthlyResult: res.resultadoMensalMedio,
    estimatedAnnualResult: res.resultadoAnualProjetado,
    /** Resultado do período escolhido (sem normalizar) e quantos meses tem. */
    periodResult: res.resultadoDoPeriodo,
    periodMonths: res.meses,
    averageMarginPerService: completed.length ? piquetRevenue / completed.length : 0,
    burnRate,
    runwayMonths: currentBalance === null ? null : calculateRunway(currentBalance, burnRate),
    currentBalance,
    // Sem saldo real, não há saldo previsto nem runway possíveis.
    projectedBalance: currentBalance === null ? null : currentBalance + res.resultadoDoPeriodo,
    /** Quantos meses de faturas sustentam a média de custos (0 = sem histórico). */
    fixedCostsMonths: custos.mesesConsiderados,
    fixedCostsMonthly: custos.mediaMensal,
  });
});
