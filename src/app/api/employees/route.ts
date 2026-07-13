import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToEmployee, employeeSortColumn, type EmployeeRow } from "@/lib/supabase/adapters";
import { computeEmployeeCost } from "@/services/employeesService";
import { apiOk, withStaff } from "../_lib/handler";

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
