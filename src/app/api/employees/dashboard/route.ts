import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/employees/dashboard — métricas de equipa e custo (mesma lógica do mock). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("employees").select("*");
  if (error) throw new Error(error.message);
  const employees = ((data ?? []) as EmployeeRow[]).map(rowToEmployee);
  const costs = employees.map((e) => computeEmployeeCost(e));
  const active = employees.filter((e) => e.employmentStatus === "ativo");

  const monthlyCost = costs.reduce((s, c) => s + c.averageMonthlyCost, 0);
  const annualCost = costs.reduce((s, c) => s + c.totalAnnualCost, 0);
  const grossSalaries = active.reduce((s, e) => s + e.grossMonthlySalary, 0);
  const socialSecurity = costs.reduce((s, c) => s + c.employerSocialSecurity / 12, 0);

  const byDepartment: Record<string, number> = {};
  const byContract: Record<string, number> = {};
  employees.forEach((e) => {
    const c = computeEmployeeCost(e);
    byDepartment[e.department] = (byDepartment[e.department] ?? 0) + c.averageMonthlyCost;
    byContract[e.contractType] = (byContract[e.contractType] ?? 0) + c.averageMonthlyCost;
  });

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
    newHires: 2,
    departures: 1,
    openPositions: 3,
  });
});
