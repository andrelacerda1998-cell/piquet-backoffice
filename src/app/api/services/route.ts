import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToService, serviceSortColumn, embedName, type ServiceRow } from "@/lib/supabase/adapters";
import { getDateRangeFromPreset } from "@/lib/filters";
import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { DEFAULT_TAX_CONFIG } from "@/config/dashboard";
import type { PeriodPreset } from "@/types";

const COMMISSION = 0.25; // margem fixa da Piquet (o técnico fica com 75%)

// Nested embed devolvido pelo Supabase para os nomes por relação.
interface EmbeddedServiceRow extends ServiceRow {
  customer?: { name: string } | null;
  technician?: { name: string } | null;
  category?: { name: string } | null;
}

function flatten(r: EmbeddedServiceRow): ServiceRow {
  return {
    ...r,
    // Prefere o nome por relação (reservas reais); cai no nome guardado à mão
    // (serviços concluídos registados manualmente, sem FK).
    customer_name: embedName(r.customer) ?? r.customer_name ?? null,
    technician_name: embedName(r.technician) ?? r.technician_name ?? null,
    category_name: embedName(r.category) ?? r.category_name ?? null,
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

/**
 * POST /api/services — regista um serviço CONCLUÍDO à mão (ex.: um trabalho
 * feito por telefone/fora da app). O foco é o registo histórico: técnico,
 * cliente, categoria, tipo, valor pago e avaliação. A comissão da Piquet (25%)
 * e o valor do técnico (75%) são derivados do valor pago — não se pedem.
 *
 * Cliente e técnico entram por nome (as tabelas próprias estão vazias até o
 * backend de reservas ligar) e guardam-se nas colunas manuais.
 */
export const POST = withStaff(async (req) => {
  const b = (await req.json()) as {
    customerName?: string; technicianName?: string; categoryId?: string;
    serviceName?: string; city?: string; amountPaid?: number;
    rating?: number; completedAt?: string; hasComplaint?: boolean;
  };

  const amount = Number(b.amountPaid);
  if (!b.serviceName?.trim()) return apiErr("Indica o tipo de serviço.", 400);
  if (!b.technicianName?.trim()) return apiErr("Indica o técnico que executou.", 400);
  if (!(amount >= 0)) return apiErr("Indica um valor pago válido.", 400);

  const completedIso = b.completedAt ? new Date(b.completedAt).toISOString() : new Date().toISOString();
  // O técnico fica com 75%. `piquet_revenue` é uma coluna GERADA
  // (total − technician_value) — não se insere.
  const technicianValue = amount * (1 - COMMISSION);
  // IVA contido no valor pago (23%).
  const vat = amount - amount / (1 + DEFAULT_TAX_CONFIG.vatRate);
  const rating = b.rating != null ? Math.min(5, Math.max(1, Number(b.rating))) : null;

  const row = {
    id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    customer_name: b.customerName?.trim() || null,
    technician_name: b.technicianName.trim(),
    category_id: b.categoryId ?? null,
    service_name: b.serviceName.trim(),
    city: b.city ?? null,
    location: b.city ?? null,
    source: "manual",
    status: "concluido",
    requested_at: completedIso,
    scheduled_at: completedIso,
    completed_at: completedIso,
    total_customer_value: amount,
    technician_value: technicianValue,
    vat_value: vat,
    payment_status: "pago",
    invoice_status: "emitida",
    rating,
    has_complaint: Boolean(b.hasComplaint),
    internal_notes: [] as string[],
  };

  const { error } = await supabaseAdmin().from("services").insert(row);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: row.id }, 201);
});
