import { supabaseAdmin } from "@/lib/supabase/server";
import { normalizeLeadStage } from "@/lib/leadStages";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { resolveCategoryId, categoryFromMessage } from "@/lib/categories";

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

// Estados do funil: fonte única em src/lib/leadStages.ts (leitura, escrita e
// interface partilham a mesma lista — foi terem-se separado que fez o estado
// "reembolsado" voltar a aparecer como "Novo").

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
    stage: normalizeLeadStage(r.stage),
    quoteValue: r.quote_value != null ? Number(r.quote_value) : null,
    technicianValue: r.technician_value != null ? Number(r.technician_value) : null,
    technicianName: r.technician_name || "",
    // Categoria: o campo próprio, ou (fallback) extraída da mensagem "Serviço: X".
    categoryId: r.category_id || categoryFromMessage(r.message),
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
  const categoryId = resolveCategoryId(b.category ?? b.categoryId ?? b.category_id ?? b.service);
  const row: Record<string, string> = {
    name: clip(b.name, 200),
    phone: clip(b.phone, 50),
    city: clip(b.city, 100),
    message: clip(b.message, 2000),
    source: clip(b.source, 100) || "whatsapp",
    stage: "nao_iniciado",
  };
  if (categoryId) row.category_id = categoryId;
  if (!row.name && !row.phone) return apiErr("Indica pelo menos o nome ou o telefone.", 400);

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .insert(row)
    .select(SELECT)
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toLead(data as Row), 201);
});
