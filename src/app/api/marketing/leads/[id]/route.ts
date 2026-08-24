import { supabaseAdmin } from "@/lib/supabase/server";
import { isLossReason } from "@/lib/leadLossReasons";
import { isMissingColumn } from "@/lib/missingColumn";
import { isLeadStage, LEAD_STAGE_IDS } from "@/lib/leadStages";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { upsertCustomerByName, upsertTechnicianByName, syncTechnicianCategories } from "../../../_lib/entities";
import { DEFAULT_TAX_CONFIG } from "@/config/dashboard";

// Estados válidos: fonte única em src/lib/leadStages.ts.

// Patch camelCase (frontend) → coluna da tabela `leads`.
const WRITABLE: Record<string, string> = {
  name: "name",
  phone: "phone",
  city: "city",
  message: "message",
  stage: "stage",
  technicianName: "technician_name",
  categoryId: "category_id",
  quoteValue: "quote_value",
  technicianValue: "technician_value",
  executionDate: "execution_date",
  rating: "rating",
  notes: "notes",
  lossReason: "loss_reason",
  lossNote: "loss_note",
};

interface LeadRow {
  id: string; name: string; phone: string; city: string; message: string;
  stage: string; technician_name: string | null; category_id: string | null;
  quote_value: number | null; technician_value: number | null;
  execution_date: string | null; rating: number | null; service_id: string | null;
}

/**
 * Cria um serviço CONCLUÍDO em Operações a partir do pedido (quando este é
 * marcado "Concluído"). Liga cliente e técnico (reutilizando os registos),
 * para o serviço contar no GMV, Técnicos e Clientes. Devolve o id do serviço.
 * `piquet_revenue` é coluna GERADA — não se insere.
 */
async function createServiceFromLead(admin: ReturnType<typeof supabaseAdmin>, lead: LeadRow): Promise<string> {
  const total = Number(lead.quote_value) || 0;
  const techValue = lead.technician_value != null ? Number(lead.technician_value) : total * 0.75;
  const completedIso = lead.execution_date ? new Date(lead.execution_date).toISOString() : new Date().toISOString();
  const vat = total - total / (1 + DEFAULT_TAX_CONFIG.vatRate);

  const customerId = await upsertCustomerByName(admin, lead.name, lead.city);
  const technicianId = await upsertTechnicianByName(admin, lead.technician_name, lead.city, lead.category_id);

  const row = {
    id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    customer_id: customerId,
    technician_id: technicianId,
    customer_name: lead.name || null,
    technician_name: lead.technician_name || null,
    category_id: lead.category_id ?? null,
    service_name: (lead.message || "Serviço").slice(0, 200),
    city: lead.city || null,
    location: lead.city || null,
    source: "crm",
    status: "concluido",
    requested_at: completedIso,
    scheduled_at: completedIso,
    completed_at: completedIso,
    total_customer_value: total,
    technician_value: techValue,
    vat_value: vat,
    payment_status: "pago",
    invoice_status: "emitida",
    rating: lead.rating != null ? Math.min(5, Math.max(1, Number(lead.rating))) : null,
    has_complaint: false,
    internal_notes: [] as string[],
  };
  const { error } = await admin.from("services").insert(row);
  if (error) throw new Error(error.message);
  await syncTechnicianCategories(admin, technicianId);
  return row.id;
}

/** PUT /api/marketing/leads/:id — edita o pedido e, ao concluir, cria o serviço. */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(WRITABLE)) {
    if (key in body) patch[col] = body[key] === "" ? null : body[key];
  }
  if (Object.keys(patch).length === 0) return apiErr("Nada para atualizar.", 400);
  if ("stage" in patch && !isLeadStage(patch.stage)) {
    return apiErr(`Estado inválido. Usa um de: ${LEAD_STAGE_IDS.join(", ")}.`, 400);
  }
  if ("loss_reason" in patch && patch.loss_reason != null && !isLossReason(patch.loss_reason)) {
    return apiErr("Motivo de perda inválido.", 400);
  }

  const admin = supabaseAdmin();
  const { data: current, error: readErr } = await admin
    .from("leads")
    .select("id, name, phone, city, message, stage, technician_name, category_id, quote_value, technician_value, execution_date, rating, service_id")
    .eq("id", params.id)
    .single();
  if (readErr || !current) return apiErr("Pedido não encontrado.", 404);
  const lead = current as LeadRow;

  // Valores efetivos após o patch (para validar e para criar o serviço).
  const merged = { ...lead } as LeadRow & Record<string, unknown>;
  for (const [col, val] of Object.entries(patch)) merged[col] = val;

  // Coerência valor/margem: o valor do técnico não pode exceder o orçamento.
  if (merged.quote_value != null && merged.technician_value != null) {
    const total = Number(merged.quote_value), tech = Number(merged.technician_value);
    if (!(tech >= 0 && tech <= total)) {
      return apiErr("A margem da Piquet tem de estar entre 0 e o valor do orçamento.", 400);
    }
  }

  // Transição para "Concluído": cria o serviço em Operações (uma só vez).
  const concluding = patch.stage === "concluido" && lead.stage !== "concluido" && !lead.service_id;
  if (patch.stage === "concluido" || concluding) {
    if (!merged.technician_name?.trim()) return apiErr("Indica o técnico antes de concluir o pedido.", 400);
    if (!(Number(merged.quote_value) >= 0) || merged.quote_value == null) {
      return apiErr("Indica o valor do orçamento antes de concluir o pedido.", 400);
    }
  }
  if (concluding) {
    patch.service_id = await createServiceFromLead(admin, merged);
  }

  /**
   * Reembolso: o serviço que este pedido gerou em Operações tem de deixar de
   * contar como receita. Sem isto, o CRM dizia "Reembolsado" e o Financeiro
   * continuava a somar o serviço como concluído — dois ecrãs a contar
   * histórias diferentes sobre o mesmo dinheiro.
   */
  if (patch.stage === "reembolsado" && lead.stage !== "reembolsado" && lead.service_id) {
    const { error: svcErr } = await admin
      .from("services")
      .update({ status: "reembolsado" })
      .eq("id", lead.service_id);
    // Não bloqueia a mudança de estado do pedido: o reembolso é um facto, e
    // falhar aqui não deve impedir o registo — mas fica no log do servidor.
    if (svcErr) console.error("[leads] falha ao reembolsar o serviço", lead.service_id, svcErr.message);
  }

  /**
   * Colunas acrescentadas por migrações recentes. Enquanto uma delas não
   * existir na base de dados, guarda-se TUDO O RESTO em vez de rejeitar a
   * edição inteira.
   *
   * Isto já existia, mas só para `notes` — e por isso marcar um pedido como
   * "Recusado" rebentava por causa de `loss_note`: perdia-se a mudança de
   * estado, que é o essencial, por causa do motivo, que é o acessório. Agora é
   * genérico: tenta-se, e a cada coluna em falta larga-se essa e repete-se.
   */
  const OPCIONAIS: Array<{ coluna: string; migracao: string }> = [
    { coluna: "notes", migracao: "20260820120000_leads_notes.sql" },
    { coluna: "loss_reason", migracao: "20260824100000_leads_loss_reason.sql" },
    { coluna: "loss_note", migracao: "20260824100000_leads_loss_reason.sql" },
  ];

  const porGravar = { ...patch };
  const emFalta: string[] = [];
  let error: { message: string } | null = null;

  // No máximo uma tentativa por coluna opcional, mais a inicial — o ciclo
  // termina sempre, mesmo que o erro devolvido seja inesperado.
  for (let i = 0; i <= OPCIONAIS.length; i++) {
    if (Object.keys(porGravar).length === 0) { error = null; break; }
    ({ error } = await admin.from("leads").update(porGravar).eq("id", params.id));
    if (!error) break;
    const falha = OPCIONAIS.find((o) => o.coluna in porGravar && isMissingColumn(error, o.coluna));
    if (!falha) break;
    delete porGravar[falha.coluna];
    emFalta.push(falha.coluna);
  }

  if (!error && emFalta.length > 0) {
    const migracoes = [...new Set(OPCIONAIS.filter((o) => emFalta.includes(o.coluna)).map((o) => o.migracao))];
    return apiOk({
      id: params.id,
      serviceId: patch.service_id ?? lead.service_id ?? null,
      // O resto foi guardado; dizer o que ficou por guardar e como resolver.
      aviso: `Guardado, exceto: ${emFalta.join(", ")}. Falta aplicar ${migracoes.join(" e ")}.`,
    });
  }
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id, serviceId: patch.service_id ?? lead.service_id ?? null });
});

/**
 * DELETE /api/marketing/leads/:id — elimina o pedido do CRM. Um serviço já
 * criado em Operações (quando o pedido foi concluído) NÃO é afetado — são
 * registos independentes.
 */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("leads").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
