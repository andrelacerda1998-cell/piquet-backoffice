import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { CONTRACT_TYPES, EMPLOYMENT_STATUSES } from "../../_lib/employees";

// Patch camelCase (frontend) → coluna.
const WRITABLE: Record<string, string> = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
  jobTitle: "job_title",
  department: "department",
  contractType: "contract_type",
  employmentStatus: "employment_status",
  startDate: "start_date",
  endDate: "end_date",
  grossMonthlySalary: "gross_monthly_salary",
  annualSalaryPayments: "annual_salary_payments",
  mealAllowanceMonthly: "meal_allowance_monthly",
  monthlyCompanyCost: "monthly_company_cost",
  notes: "notes",
};

/** PUT /api/employees/:id — atualiza um colaborador (incl. desativar). */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(WRITABLE)) {
    if (key in body) patch[col] = body[key] === "" ? null : body[key];
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);
  if ("contract_type" in patch && !CONTRACT_TYPES.includes(String(patch.contract_type))) return apiErr("Tipo de contrato inválido.", 400);
  if ("employment_status" in patch && !EMPLOYMENT_STATUSES.includes(String(patch.employment_status))) return apiErr("Estado inválido.", 400);
  if ("gross_monthly_salary" in patch && !(Number(patch.gross_monthly_salary) > 0)) return apiErr("Salário inválido.", 400);
  // null limpa o custo manual (volta ao cálculo automático); se vier valor, tem de ser > 0.
  if ("monthly_company_cost" in patch && patch.monthly_company_cost != null && !(Number(patch.monthly_company_cost) > 0)) {
    return apiErr("Custo mensal manual inválido.", 400);
  }

  const { data, error } = await supabaseAdmin()
    .from("employees")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Colaborador não encontrado.", 404);
  const e = rowToEmployee(data as EmployeeRow);
  return apiOk({ ...e, cost: computeEmployeeCost(e) });
});

/** DELETE /api/employees/:id — remove um colaborador (registos errados). */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("employees").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
