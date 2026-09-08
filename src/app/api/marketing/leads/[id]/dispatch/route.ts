import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { WHATSAPP_ENABLED, enviarModeloTecnico } from "@/lib/whatsapp";
import { extrairDadosLead } from "@/lib/leadReply";
import { fone9, type Difusao, type EstadoDifusao } from "@/lib/despacho";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import type { AdminVendorsData } from "@/app/api/technicians/route";

/**
 * Difusão de um pedido à comunidade de técnicos.
 *
 * GET  — quem foi perguntado sobre esta lead e o que respondeu.
 * POST — pergunta a um conjunto de técnicos, pelo WhatsApp, ao mesmo tempo.
 *
 * O staff escolhe depois entre quem aceitou (POST /assign). Não é o primeiro a
 * responder que fica: numa rede pequena, quem tem o telemóvel na mão não é
 * necessariamente quem está mais perto nem quem trabalha melhor.
 */

interface DispatchRow {
  id: string; technician_id: string; technician_name: string; phone: string;
  status: EstadoDifusao; error: string; responded_at: string | null; created_at: string;
}

function toDTO(r: DispatchRow): Difusao {
  return {
    id: r.id,
    technicianId: r.technician_id,
    technicianName: r.technician_name,
    phone: r.phone,
    status: r.status,
    error: r.error,
    respondedAt: r.responded_at,
    createdAt: r.created_at,
  };
}

export const GET = withStaff(async (_req, { params }) => {
  const { data, error } = await supabaseAdmin()
    .from("lead_dispatches").select("*")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    // Sem a migração o ecrã continua a abrir, apenas sem difusões.
    if (isMissingTable(error, "lead_dispatches")) return apiOk({ dispatches: [], migrated: false });
    throw new Error(error.message);
  }
  return apiOk({ dispatches: ((data ?? []) as DispatchRow[]).map(toDTO), migrated: true });
});

export const POST = withStaff(async (req, { params }) => {
  const b = (await req.json().catch(() => null)) as { technicianIds?: string[] } | null;
  const ids = (b?.technicianIds ?? []).map(String).filter(Boolean);
  if (ids.length === 0) return apiErr("Escolhe pelo menos um técnico.");
  if (ids.length > 30) return apiErr("Envia a no máximo 30 técnicos de cada vez.");

  if (!WHATSAPP_ENABLED) {
    return apiErr("O envio pelo WhatsApp ainda não está ligado. Faltam as chaves da Meta na Vercel.", 501);
  }

  const db = supabaseAdmin();
  const { data: lead, error: leadErr } = await db
    .from("leads").select("id, name, city, message").eq("id", params.id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);
  const l = lead as { name: string; city: string; message: string };

  /*
    O texto do pedido sai da própria lead, não de campos escritos à mão: é o
    que o cliente disse. Sem serviço identificado vai "assistência" -- vago,
    mas honesto, e o técnico pergunta.
  */
  const dados = extrairDadosLead(l.message || "", l.name || "");
  const local = (dados.localizacao || l.city || "").trim();
  const servico = dados.servico.trim() || "assistencia";
  const pedido = local ? `${servico} em ${local}` : servico;
  const urgencia = dados.urgencia?.trim() || "Normal";

  /*
    Nome e telefone vêm do Laravel no momento do envio, nunca do que o browser
    mandou: quem escolhe no ecrã escolhe ids, e um id trocado não pode virar
    uma mensagem para um número arbitrário.
  */
  let vendors: AdminVendorsData["items"] = [];
  try {
    const r = await laravelAdminRequest<AdminVendorsData>("/v1/admin/vendors?per_page=500");
    vendors = r.items ?? [];
  } catch {
    return apiErr("Não foi possível ler a lista de técnicos para obter os contactos.", 502);
  }

  const escolhidos = vendors.filter((v) => ids.includes(String(v.id)));
  if (escolhidos.length === 0) return apiErr("Nenhum dos técnicos escolhidos foi encontrado.", 404);

  const semTelefone = escolhidos.filter((v) => !fone9(v.phone_number || ""));
  const contactaveis = escolhidos.filter((v) => fone9(v.phone_number || ""));

  const resultados: Difusao[] = [];
  for (const v of contactaveis) {
    const phone = (v.phone_number || "").trim();
    let status: EstadoDifusao = "enviado";
    let erro = "";
    let waMessageId = "";
    try {
      ({ waMessageId } = await enviarModeloTecnico(phone, pedido, urgencia));
    } catch (e) {
      // Uma falha num técnico não pode travar os outros: o objectivo é que o
      // pedido chegue ao máximo de gente possível, não que o lote seja perfeito.
      status = "falhou";
      erro = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    }

    const { data: guardada, error: insErr } = await db.from("lead_dispatches").upsert({
      lead_id: params.id,
      technician_id: String(v.id),
      technician_name: v.name || "",
      phone,
      status,
      error: erro,
      wa_message_id: waMessageId || null,
    }, { onConflict: "lead_id,technician_id" }).select("*").single();
    if (insErr) {
      if (isMissingTable(insErr, "lead_dispatches")) {
        return apiErr("A tabela das difusões ainda não existe nesta base de dados.", 501);
      }
      throw new Error(insErr.message);
    }
    resultados.push(toDTO(guardada as DispatchRow));
  }

  return apiOk({
    dispatches: resultados,
    enviadas: resultados.filter((d) => d.status === "enviado").length,
    falhadas: resultados.filter((d) => d.status === "falhou").length,
    semTelefone: semTelefone.map((v) => v.name || String(v.id)),
  });
});
