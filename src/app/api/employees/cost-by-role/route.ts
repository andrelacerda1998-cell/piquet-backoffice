import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/employees/cost-by-role — custo mensal por função. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("employees").select("*");
  if (error) throw new Error(error.message);
  const byRole: Record<string, number> = {};
  for (const r of (data ?? []) as EmployeeRow[]) {
    const e = rowToEmployee(r);
    byRole[e.jobTitle] = (byRole[e.jobTitle] ?? 0) + computeEmployeeCost(e).averageMonthlyCost;
  }
  return apiOk(Object.entries(byRole).map(([name, value]) => ({ name, value: Math.round(value) })));
});
