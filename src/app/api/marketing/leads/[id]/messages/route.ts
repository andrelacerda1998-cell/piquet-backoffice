import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { WHATSAPP_ENABLED, dentroDaJanela, enviarTextoWhatsapp } from "@/lib/whatsapp";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

interface MsgRow {
  id: string; direction: "in" | "out"; body: string;
  status: string; error: string; sent_by: string; created_at: string;
}

function toDTO(r: MsgRow) {
  return {
    id: r.id, direction: r.direction, body: r.body,
    status: r.status, error: r.error, sentBy: r.sent_by, createdAt: r.created_at,
  };
}

/** Última mensagem DE ENTRADA — define se a janela de 24h ainda está aberta. */
function ultimaEntrada(msgs: MsgRow[]): string | null {
  const ins = msgs.filter((m) => m.direction === "in");
  return ins.length ? ins[ins.length - 1].created_at : null;
}

/**
 * GET — a conversa de WhatsApp de uma lead, mais o estado do canal:
 * `configured` (há chaves para enviar?) e `windowOpen` (ainda se pode responder
 * em texto livre?). O ecrã usa os dois para saber se o campo de resposta fica
 * ativo e o que explicar quando não fica.
 */
export const GET = withStaff(async (_req, { params }) => {
  const db = supabaseAdmin();
  const { data: lead, error: leadErr } = await db
    .from("leads").select("id, phone").eq("id", params.id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);

  // Mensagens ligadas pela lead OU pelo telefone (mensagens antigas do mesmo
  // número que ainda não estavam associadas a esta lead).
  const phone = (lead as { phone: string }).phone || "";
  let query = db.from("whatsapp_messages").select("*").order("created_at", { ascending: true });
  query = phone ? query.or(`lead_id.eq.${params.id},phone.eq.${phone}`) : query.eq("lead_id", params.id);

  const { data, error } = await query;
  if (error) {
    // Sem a migração, não há conversa — mas o resto do ecrã continua a abrir.
    if (isMissingTable(error, "whatsapp_messages")) {
      return apiOk({ messages: [], configured: WHATSAPP_ENABLED, windowOpen: false, migrated: false });
    }
    throw new Error(error.message);
  }

  const msgs = (data ?? []) as MsgRow[];
  return apiOk({
    messages: msgs.map(toDTO),
    configured: WHATSAPP_ENABLED,
    windowOpen: dentroDaJanela(ultimaEntrada(msgs), Date.now()),
    migrated: true,
  });
});

/**
 * POST — responder ao cliente pelo WhatsApp.
 *
 * Recusa cedo e com clareza em vez de fingir: sem chaves (`configured`) diz que
 * o canal não está ligado; fora das 24h diz que só com mensagem-modelo. Só
 * quando pode mesmo é que chama a Meta e guarda a mensagem enviada.
 */
export const POST = withStaff(async (req, { params, staff }) => {
  const b = (await req.json().catch(() => null)) as { body?: string } | null;
  const body = (b?.body ?? "").trim();
  if (!body) return apiErr("Escreve a mensagem antes de enviar.");
  if (body.length > 4000) return apiErr("Mensagem demasiado longa (máx. 4000 caracteres).");

  if (!WHATSAPP_ENABLED) {
    return apiErr("O envio pelo WhatsApp ainda não está ligado. Faltam as chaves da Meta na Vercel.", 501);
  }

  const db = supabaseAdmin();
  const { data: lead, error: leadErr } = await db
    .from("leads").select("id, phone").eq("id", params.id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);
  const phone = (lead as { phone: string }).phone || "";
  if (!phone) return apiErr("Este pedido não tem telefone para onde enviar.");

  // Janela de 24h: lê-se a última entrada do próprio histórico.
  const { data: hist } = await db.from("whatsapp_messages")
    .select("direction, created_at").or(`lead_id.eq.${params.id},phone.eq.${phone}`)
    .order("created_at", { ascending: true });
  const aberta = dentroDaJanela(ultimaEntrada((hist ?? []) as MsgRow[]), Date.now());
  if (!aberta) {
    return apiErr(
      "Passaram mais de 24h desde a última mensagem do cliente. O WhatsApp só permite reabrir com uma mensagem-modelo aprovada pela Meta.",
      409,
    );
  }

  // Envia primeiro; só se a Meta aceitar é que se grava — assim a conversa não
  // mostra como enviada uma mensagem que afinal não saiu.
  let waMessageId = "";
  try {
    ({ waMessageId } = await enviarTextoWhatsapp(phone, body));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Falha ao enviar pelo WhatsApp.", 502);
  }

  const { data: guardada, error: insErr } = await db.from("whatsapp_messages").insert({
    lead_id: params.id,
    phone,
    direction: "out",
    body,
    wa_message_id: waMessageId || null,
    status: "sent",
    sent_by: staff.email,
  }).select("*").single();
  if (insErr) throw new Error(insErr.message);

  return apiOk(toDTO(guardada as MsgRow));
});
