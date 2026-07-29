import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost, effectiveMonthlyCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/employees/dashboard — métricas de equipa e custo. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("employees").select("*");
  if (error) throw new Error(error.message);
  const employees = ((data ?? []) as EmployeeRow[]).map(rowToEmployee);
  const active = employees.filter((e) => e.employmentStatus === "ativo");

  // Custo mensal efetivo: o manual (monthly_company_cost) ganha ao calculado.
  const monthly = employees.map((e) => {
    const cost = computeEmployeeCost(e);
    return { e, cost, monthlyCost: effectiveMonthlyCost(e, cost) };
  });
  const monthlyCost = monthly.reduce((s, m) => s + m.monthlyCost, 0);
  const annualCost = monthly.reduce(
    (s, m) => s + (m.e.monthlyCompanyCost && m.e.monthlyCompanyCost > 0 ? m.e.monthlyCompanyCost * 12 : m.cost.totalAnnualCost),
    0
  );
  const grossSalaries = active.reduce((s, e) => s + e.grossMonthlySalary, 0);
  const socialSecurity = monthly.reduce((s, m) => s + m.cost.employerSocialSecurity / 12, 0);

  const byDepartment: Record<string, number> = {};
  const byContract: Record<string, number> = {};
  monthly.forEach(({ e, monthlyCost: mc }) => {
    byDepartment[e.department] = (byDepartment[e.department] ?? 0) + mc;
    byContract[e.contractType] = (byContract[e.contractType] ?? 0) + mc;
  });

  // Derivado dos contratos (nada inventado): contratações/saídas do mês corrente.
  const ym = new Date().toISOString().slice(0, 7);
  const newHires = employees.filter((e) => e.startDate?.slice(0, 7) === ym).length;
  const departures = employees.filter((e) => e.endDate?.slice(0, 7) === ym).length;

  return apiOk({
    totalEmployees: employees.length,
    activeEmployees: active.length,
    monthlyTeamCost: monthlyCost,
    annualTeamCost: annualCost,
    grossSalariesMonthly: grossSalaries,
    socialSecurityMonthly: socialSecurity,
    averageCostPerEmployee: monthlyCost / (active.length || 1),
    costByDepartment: Object.entries(byDepartment).map(([name, value]) => ({ name, value: Math.round(value) })),
    costByContract: Object.entries(byContract).map(([name, value]) => ({ name, value: Math.round(value) })),
    newHires,
    departures,
    openPositions: 0,
  });
});
