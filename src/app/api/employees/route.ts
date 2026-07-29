import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, employeeSortColumn, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { CONTRACT_TYPES } from "../_lib/employees";

/** GET /api/employees — lista paginada com custo total calculado por colaborador. */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 20)));
  const search = q.get("search")?.trim();
  const sort = q.get("sort") ?? undefined;
  const dir = q.get("dir") === "asc" ? "asc" : "desc";

  let query = supabaseAdmin().from("employees").select("*", { count: "exact" });
  if (search) query = query.or(`full_name.ilike.%${search}%,job_title.ilike.%${search}%`);
  query = query.order(employeeSortColumn(sort), { ascending: dir === "asc" }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EmployeeRow[];
  const total = count ?? rows.length;
  return apiOk({
    data: rows.map((r) => {
      const e = rowToEmployee(r);
      return { ...e, cost: computeEmployeeCost(e) };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

/** POST /api/employees — regista um colaborador (o resto dos custos tem defaults PT na tabela). */
export const POST = withStaff(async (req) => {
  const b = (await req.json()) as {
    fullName?: string; email?: string; phone?: string; jobTitle?: string; department?: string;
    contractType?: string; grossMonthlySalary?: number; annualSalaryPayments?: number;
    mealAllowanceMonthly?: number; monthlyCompanyCost?: number | null; startDate?: string; notes?: string;
  };
  if (!b.fullName?.trim()) return apiErr("Indica o nome do colaborador.", 400);
  const salary = Number(b.grossMonthlySalary);
  if (!(salary > 0)) return apiErr("Indica o salário bruto mensal.", 400);
  if (!b.startDate) return apiErr("Indica o início do contrato.", 400);
  const contractType = b.contractType && CONTRACT_TYPES.includes(b.contractType) ? b.contractType : "sem_termo";

  const id = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const insert: Record<string, unknown> = {
    id,
    full_name: b.fullName.trim(),
    email: b.email?.trim() || null,
    phone: b.phone?.trim() || null,
    job_title: b.jobTitle?.trim() || null,
    department: b.department?.trim() || null,
    contract_type: contractType,
    gross_monthly_salary: salary,
    start_date: b.startDate,
    notes: b.notes?.trim() || null,
  };
  if (b.annualSalaryPayments != null) insert.annual_salary_payments = Number(b.annualSalaryPayments);
  if (b.mealAllowanceMonthly != null) insert.meal_allowance_monthly = Number(b.mealAllowanceMonthly);
  if (b.monthlyCompanyCost != null) {
    const c = Number(b.monthlyCompanyCost);
    if (!(c > 0)) return apiErr("Custo mensal manual inválido.", 400);
    insert.monthly_company_cost = c;
  }

  const { data, error } = await supabaseAdmin().from("employees").insert(insert).select("*").single();
  if (error) return apiErr(error.message, 400);
  const e = rowToEmployee(data as EmployeeRow);
  return apiOk({ ...e, cost: computeEmployeeCost(e) }, 201);
});
