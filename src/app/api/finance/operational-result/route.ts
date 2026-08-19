import { supabaseAdmin } from "@/lib/supabase/server";
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
  const [servicos, empRes] = await Promise.all([
    fetchAll<Row>(admin.from("services").select("completed_at, requested_at, piquet_revenue").eq("status", "concluido")),
    admin.from("employees").select("*"),
  ]);
  if (empRes.error) throw new Error(empRes.error.message);

  const monthlyTeamCost = ((empRes.data ?? []) as EmployeeRow[]).reduce((s, r) => s + computeEmployeeCost(rowToEmployee(r)).averageMonthlyCost, 0);
  const fixedOpex = monthlyTeamCost + 4500 + 3000;

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
