import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToCustomer, customerSortColumn, type CustomerRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../_lib/handler";

/** GET /api/customers — lista paginada (vista customers_enriched). */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 20)));
  const search = q.get("search")?.trim();
  const segment = q.get("segment")?.trim();
  const sort = q.get("sort") ?? undefined;
  const dir = q.get("dir") === "asc" ? "asc" : "desc";

  const admin = supabaseAdmin();
  let query = admin.from("customers_enriched").select("*", { count: "exact" });
  if (segment) query = query.eq("status", segment);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  query = query
    .order(customerSortColumn(sort), { ascending: dir === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CustomerRow[];
  const total = count ?? rows.length;
  return apiOk({
    data: rows.map(rowToCustomer),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});
