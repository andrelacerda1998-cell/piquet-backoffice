import { supabaseAdmin } from "@/lib/supabase/server";
import { serviceSortColumn, embedName } from "@/lib/supabase/adapters";
import { getDateRangeFromPreset } from "@/lib/filters";
import { apiOk, withStaff } from "../../_lib/handler";
import type { PeriodPreset } from "@/types";

interface Row {
  id: string;
  service_name: string;
  total_customer_value: number;
  technician_value: number;
  piquet_revenue: number;
  vat_value: number;
  payment_status: string;
  invoice_status: string;
  completed_at: string | null;
  customer: { name: string } | null;
  technician: { name: string } | null;
}

const SELECT =
  "id, service_name, total_customer_value, technician_value, piquet_revenue, vat_value, payment_status, invoice_status, completed_at, customer:customers(name), technician:technicians(name)";

// Campos do frontend → coluna, para a tabela de faturação por serviço.
const SORT: Record<string, string> = {
  totalCustomerValue: "total_customer_value",
  technicianValue: "technician_value",
  piquetRevenue: "piquet_revenue",
  completedAt: "completed_at",
};

/** GET /api/finance/by-service — serviços concluídos (paginado) para a Faturação por serviço. */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 20)));
  const categoryId = q.get("categoryId")?.trim();
  const city = q.get("city")?.trim();
  const period = q.get("period") as PeriodPreset | null;
  const sortField = q.get("sort") ?? undefined;
  const dir = q.get("dir") === "asc" ? "asc" : "desc";
  const sortCol = (sortField && SORT[sortField]) || serviceSortColumn(sortField);

  let query = supabaseAdmin().from("services").select(SELECT, { count: "exact" }).eq("status", "concluido");
  if (categoryId) query = query.eq("category_id", categoryId);
  if (city) query = query.eq("city", city);
  if (period && period !== "personalizado") {
    const { start, end } = getDateRangeFromPreset(period);
    query = query.gte("requested_at", start.toISOString()).lte("requested_at", end.toISOString());
  }
  query = query.order(sortCol, { ascending: dir === "asc" }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? rows.length;
  return apiOk({
    data: rows.map((s) => ({
      id: s.id,
      serviceName: s.service_name,
      customerName: embedName(s.customer) ?? "—",
      technicianName: embedName(s.technician) ?? "—",
      totalCustomerValue: Number(s.total_customer_value) || 0,
      technicianValue: Number(s.technician_value) || 0,
      piquetRevenue: Number(s.piquet_revenue) || 0,
      vat: Number(s.vat_value) || 0,
      paymentStatus: s.payment_status,
      invoiceStatus: s.invoice_status,
      completedAt: s.completed_at,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});
