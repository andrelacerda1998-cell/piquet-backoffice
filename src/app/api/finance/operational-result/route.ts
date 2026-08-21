import { supabaseAdmin } from "@/lib/supabase/server";
import { custosFixosMensais } from "@/lib/custosFixos";
import { fetchAll } from "@/lib/fetchAll";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../../_lib/handler";

interface Row { completed_at: string | null; requested_at: string; piquet_revenue: number }

/**
 * GET /api/finance/operational-result — resultado operacional por mês
 * (receita Piquet do mês − opex de equipa − custos fixos). Derivação real,
 * substitui o mock sintético (usa a nova tabela `employees`).
 */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  // Paginado: o PostgREST corta em 1000 linhas, e sem `.order()` as que
  // sobravam eram arbitrárias — o gráfico perdia meses inteiros sem avisar.
  const [servicos, empRes, custosRes] = await Promise.all([
    fetchAll<Row>(admin.from("services").select("completed_at, requested_at, piquet_revenue").eq("status", "concluido")),
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

  const byMonth: Record<string, number> = {};
  for (const s of servicos) {
    const m = (s.completed_at ?? s.requested_at).slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + Number(s.piquet_revenue);
  }
  return apiOk(
    Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, revenue]) => ({ name, value: Math.round(revenue - fixedOpex) }))
  );
});
