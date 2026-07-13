import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToTechnician, technicianSortColumn, type TechnicianRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../_lib/handler";

/** GET /api/technicians — lista paginada (vista technicians_enriched). */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 20)));
  const search = q.get("search")?.trim();
  const status = q.get("status")?.trim();
  const sort = q.get("sort") ?? undefined;
  const dir = q.get("dir") === "asc" ? "asc" : "desc";

  const admin = supabaseAdmin();
  let query = admin.from("technicians_enriched").select("*", { count: "exact" });
  if (status) query = query.eq("status", status);
  // Pesquisa por nome (a pesquisa por categoria far-se-á quando houver índice GIN).
  if (search) query = query.ilike("name", `%${search}%`);
  query = query
    .order(technicianSortColumn(sort), { ascending: dir === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TechnicianRow[];
  const total = count ?? rows.length;
  return apiOk({
    data: rows.map(rowToTechnician),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});
