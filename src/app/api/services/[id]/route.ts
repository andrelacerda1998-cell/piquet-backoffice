import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToService, embedName, type ServiceRow } from "@/lib/supabase/adapters";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { upsertCustomerByName, upsertTechnicianByName, syncTechnicianCategories } from "../../_lib/entities";

const SELECT = "*, customer:customers(name), technician:technicians(name), category:categories(name)";

interface EmbeddedRow extends ServiceRow {
  customer?: { name: string } | null;
  technician?: { name: string } | null;
  category?: { name: string } | null;
}

function flatten(r: EmbeddedRow): ServiceRow {
  // Prefere o nome por relação; cai no nome guardado à mão (registo manual).
  return {
    ...r,
    customer_name: embedName(r.customer) ?? r.customer_name ?? null,
    technician_name: embedName(r.technician) ?? r.technician_name ?? null,
    category_name: embedName(r.category) ?? r.category_name ?? null,
  };
}

// Patch camelCase (frontend) → coluna. Só campos permitidos são escritos.
// Inclui os campos do registo manual, para editar serviços concluídos.
const WRITABLE: Record<string, string> = {
  status: "status",
  scheduledAt: "scheduled_at",
  startedAt: "started_at",
  completedAt: "completed_at",
  technicianId: "technician_id",
  paymentStatus: "payment_status",
  invoiceStatus: "invoice_status",
  cancellationReason: "cancellation_reason",
  rating: "rating",
  internalNotes: "internal_notes",
  // Registo manual (editável)
  customerName: "customer_name",
  technicianName: "technician_name",
  categoryId: "category_id",
  serviceName: "service_name",
  city: "city",
  totalCustomerValue: "total_customer_value",
  technicianValue: "technician_value",
  hasComplaint: "has_complaint",
};

/** GET /api/services/:id */
export const GET = withStaff(async (_req, { params }) => {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("services").select(SELECT).eq("id", params.id).single();
  if (error || !data) return apiErr("Serviço não encontrado.", 404);
  return apiOk(rowToService(flatten(data as EmbeddedRow)));
});

/** PUT /api/services/:id — write-back de estado/agendamento/técnico/etc. */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(WRITABLE)) {
    if (key in body) patch[col] = body[key];
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);

  const admin = supabaseAdmin();
  // Técnico atual (antes da edição), para re-sincronizar as categorias se a
  // categoria ou o técnico mudarem.
  const { data: before } = await admin.from("services").select("technician_id").eq("id", params.id).single();
  const prevTechId = (before as { technician_id: string | null } | null)?.technician_id ?? null;

  // Se o nome do cliente/técnico for editado, cria/reutiliza o registo e
  // atualiza a FK — mantém as abas Clientes/Técnicos coerentes.
  const cityForEntity = (typeof body.city === "string" ? body.city : null);
  if (typeof body.customerName === "string") {
    patch.customer_id = await upsertCustomerByName(admin, body.customerName, cityForEntity);
  }
  if (typeof body.technicianName === "string") {
    const catId = typeof body.categoryId === "string" ? body.categoryId : null;
    patch.technician_id = await upsertTechnicianByName(admin, body.technicianName, cityForEntity, catId);
  }

  // Coerência valor/comissão: o valor do técnico não pode exceder o valor pago
  // (piquet_revenue é GERADA de total − técnico e clampava a 0 em silêncio).
  if ("technician_value" in patch || "total_customer_value" in patch) {
    const total = Number(patch.total_customer_value ?? body.currentTotal);
    const tech = Number(patch.technician_value);
    if ("technician_value" in patch && Number.isFinite(total) && !(tech >= 0 && tech <= total)) {
      return apiErr("O valor do técnico tem de estar entre 0 e o valor pago.", 400);
    }
  }

  const { data, error } = await admin.from("services").update(patch).eq("id", params.id).select(SELECT).single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Serviço não encontrado.", 404);

  // Re-sincroniza as categorias do técnico novo e do antigo (se mudou), para
  // não ficarem categorias antigas presas após editar a categoria do serviço.
  const newTechId = (data as ServiceRow).technician_id ?? null;
  const toSync = new Set([prevTechId, newTechId].filter(Boolean) as string[]);
  for (const id of toSync) await syncTechnicianCategories(admin, id);

  return apiOk(rowToService(flatten(data as EmbeddedRow)));
});
