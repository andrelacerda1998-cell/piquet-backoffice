import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToService, serviceSortColumn, embedName, type ServiceRow } from "@/lib/supabase/adapters";
import { getDateRangeFromPreset } from "@/lib/filters";
import { apiOk, withStaff } from "../_lib/handler";
import type { PeriodPreset } from "@/types";

// Nested embed devolvido pelo Supabase para os nomes por relação.
interface EmbeddedServiceRow extends ServiceRow {
  customer?: { name: string } | null;
  technician?: { name: string } | null;
  category?: { name: string } | null;
}

function flatten(r: EmbeddedServiceRow): ServiceRow {
  return {
    ...r,
    customer_name: embedName(r.customer),
    technician_name: embedName(r.technician),
    category_name: embedName(r.category),
  };
}

/** GET /api/services — lista paginada com filtros/ordenação server-side. */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 20)));
  const search = q.get("search")?.trim();
  const categoryId = q.get("categoryId")?.trim();
  const city = q.get("city")?.trim();
  const status = q.get("status")?.trim();
  const period = q.get("period") as PeriodPreset | null;
  const sort = q.get("sort") ?? undefined;
  const dir = q.get("dir") === "asc" ? "asc" : "desc";

  const admin = supabaseAdmin();
  let query = admin
    .from("services")
    .select(
      "*, customer:customers(name), technician:technicians(name), category:categories(name)",
      { count: "exact" }
    );

  if (categoryId) query = query.eq("category_id", categoryId);
  if (city) query = query.eq("city", city);
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("service_name", `%${search}%`);
  if (period && period !== "personalizado") {
    const { start, end } = getDateRangeFromPreset(period);
    query = query.gte("requested_at", start.toISOString()).lte("requested_at", end.toISOString());
  }

  query = query
    .order(serviceSortColumn(sort), { ascending: dir === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as EmbeddedServiceRow[];
  const total = count ?? rows.length;
  return apiOk({
    data: rows.map((r) => rowToService(flatten(r))),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});
