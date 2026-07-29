import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

/**
 * GET /api/marketing/leads — leads reais recebidas do formulário da landing
 * (tabela `leads`, escrita pelo POST público /api/leads). Devolve no formato
 * `Lead` que a página de Marketing já consome.
 */

interface Row {
  id: string; name: string; email: string; phone: string; city: string;
  message: string; source: string; stage: string; created_at: string;
  quote_value: number | null; technician_value: number | null; technician_name: string | null;
  category_id: string | null; execution_date: string | null; rating: number | null; service_id: string | null;
}

const SELECT = "id, name, email, phone, city, message, source, stage, created_at, quote_value, technician_value, technician_name, category_id, execution_date, rating, service_id";

// Estados do pipeline do CRM (pedido de serviço).
const STAGES = ["nao_iniciado", "orcamento_enviado", "orcamento_aceite", "recusado", "concluido"] as const;
// Compatibilidade com estados antigos de marketing, caso existam linhas legadas.
const LEGACY: Record<string, (typeof STAGES)[number]> = {
  novo: "nao_iniciado", contactado: "orcamento_enviado", qualificado: "orcamento_aceite",
  convertido: "concluido", perdido: "recusado",
};

/** Linha da BD → forma `Lead` que a página de Marketing consome. */
function toLead(r: Row) {
  return {
    id: r.id,
    // Nome pode vir vazio do formulário — cai para o contacto que existir.
    name: r.name || r.phone || r.email,
    phone: r.phone || "",
    source: r.source || "website",
    city: r.city || "—",
    message: r.message || "",
    stage: (STAGES as readonly string[]).includes(r.stage)
      ? (r.stage as (typeof STAGES)[number])
      : (LEGACY[r.stage] ?? "nao_iniciado"),
    quoteValue: r.quote_value != null ? Number(r.quote_value) : null,
    technicianValue: r.technician_value != null ? Number(r.technician_value) : null,
    technicianName: r.technician_name || "",
    categoryId: r.category_id || "",
    executionDate: r.execution_date || "",
    rating: r.rating != null ? Number(r.rating) : null,
    serviceId: r.service_id || null,
    value: 0, // Sem valor estimado real — 0 em vez de inventado.
    createdAt: r.created_at,
  };
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v : "").trim().slice(0, max);

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return apiOk(((data ?? []) as Row[]).map(toLead));
});

/**
 * POST /api/marketing/leads — registo MANUAL de um pedido no CRM (staff). Serve
 * os pedidos que chegam pela app do WhatsApp (sem API), metidos à mão. Entra
 * como "Não iniciado".
 */
export const POST = withStaff(async (req) => {
  const b = (await req.json()) as Record<string, unknown>;
  const row = {
    name: clip(b.name, 200),
    phone: clip(b.phone, 50),
    city: clip(b.city, 100),
    message: clip(b.message, 2000),
    source: clip(b.source, 100) || "whatsapp",
    stage: "nao_iniciado",
  };
  if (!row.name && !row.phone) return apiErr("Indica pelo menos o nome ou o telefone.", 400);

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .insert(row)
    .select(SELECT)
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toLead(data as Row), 201);
});
