import { supabaseAdmin } from "@/lib/supabase/server";
import { custosFixosMensais } from "@/lib/custosFixos";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../../_lib/handler";
import { gmvPorMes, lerPagamentos } from "../../_lib/gmv";

/**
 * GET /api/finance/operational-result — resultado operacional por mês
 * (receita Piquet do mês − opex de equipa − custos fixos). A receita é a
 * comissão do GMV do mês (ver _lib/gmv.ts), a mesma do resto do Financeiro.
 */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  // Paginado: o PostgREST corta em 1000 linhas, e sem `.order()` as que
  // sobravam eram arbitrárias — o gráfico perdia meses inteiros sem avisar.
  const [pagamentos, empRes, custosRes] = await Promise.all([
    lerPagamentos(),
    admin.from("employees").select("*"),
    admin.from("company_invoices").select("amount, issue_date"),
  ]);
  if (empRes.error) throw new Error(empRes.error.message);

  const monthlyTeamCost = ((empRes.data ?? []) as EmployeeRow[]).reduce((s, r) => s + computeEmployeeCost(rowToEmployee(r)).averageMonthlyCost, 0);
  // Custos fixos = equipa (real) + média das faturas de fornecedores (real).
  // Eram `+ 4500 + 3000`: duas constantes sem fonte que deslocavam a linha
  // toda do resultado operacional.
  const custos = custosFixosMensais(
    (custosRes.data ?? []) as Array<{ amount: number | null; issue_date: string | null }>,
    Date.now(),
  );
  const fixedOpex = monthlyTeamCost + custos.mediaMensal;

  return apiOk(
    gmvPorMes(pagamentos).map((m) => ({ name: m.mes, value: Math.round(m.commission - fixedOpex) })),
  );
});
