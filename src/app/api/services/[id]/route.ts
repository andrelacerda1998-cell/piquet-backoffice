import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToService, embedName, type ServiceRow } from "@/lib/supabase/adapters";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

const SELECT = "*, customer:customers(name), technician:technicians(name), category:categories(name)";

interface EmbeddedRow extends ServiceRow {
  customer?: { name: string } | null;
  technician?: { name: string } | null;
  category?: { name: string } | null;
}

function flatten(r: EmbeddedRow): ServiceRow {
  return { ...r, customer_name: embedName(r.customer), technician_name: embedName(r.technician), category_name: embedName(r.category) };
}

// Patch camelCase (frontend) → coluna. Só campos permitidos são escritos.
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
  const { data, error } = await admin.from("services").update(patch).eq("id", params.id).select(SELECT).single();
  if (error) return apiErr(error.message, 400);
  if (!data) return apiErr("Serviço não encontrado.", 404);
  return apiOk(rowToService(flatten(data as EmbeddedRow)));
});
