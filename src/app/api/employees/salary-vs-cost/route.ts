import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/employees/salary-vs-cost — salário bruto vs custo total (top 10). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("employees").select("*").limit(10);
  if (error) throw new Error(error.message);
  return apiOk(
    ((data ?? []) as EmployeeRow[]).map((r) => {
      const e = rowToEmployee(r);
      return { name: e.fullName.split(" ")[0], salario: e.grossMonthlySalary, custoTotal: Math.round(computeEmployeeCost(e).averageMonthlyCost) };
    })
  );
});
