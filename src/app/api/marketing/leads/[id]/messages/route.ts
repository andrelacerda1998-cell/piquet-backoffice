import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { WHATSAPP_ENABLED, dentroDaJanela, enviarTextoWhatsapp, enviarModeloLead, MODELO_LEAD } from "@/lib/whatsapp";
import { fone9 } from "@/lib/telefone";
import { extrairDadosLead, primeiroNome } from "@/lib/leadReply";
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
  // Pelos últimos 9 dígitos: o mesmo número aparece com e sem indicativo,
  // conforme tenha entrado pela landing ou pela Meta.
  const p9 = fone9(phone);
  let query = db.from("whatsapp_messages").select("*").order("created_at", { ascending: true });
  query = p9 ? query.or(`lead_id.eq.${params.id},phone9.eq.${p9}`) : query.eq("lead_id", params.id);

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
  const b = (await req.json().catch(() => null)) as { body?: string; modelo?: boolean } | null;
  const modelo = b?.modelo === true;
  const body = (b?.body ?? "").trim();
  if (!modelo) {
    if (!body) return apiErr("Escreve a mensagem antes de enviar.");
    if (body.length > 4000) return apiErr("Mensagem demasiado longa (máx. 4000 caracteres).");
  }

  if (!WHATSAPP_ENABLED) {
    return apiErr("O envio pelo WhatsApp ainda não está ligado. Faltam as chaves da Meta na Vercel.", 501);
  }

  const db = supabaseAdmin();
  const { data: lead, error: leadErr } = await db
    .from("leads").select("id, phone, name, message").eq("id", params.id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);
  const dadosLead = lead as { phone: string; name: string; message: string };
  const phone = dadosLead.phone || "";
  if (!phone) return apiErr("Este pedido não tem telefone para onde enviar.");

  // Janela de 24h: lê-se a última entrada do próprio histórico.
  const { data: hist } = await db.from("whatsapp_messages")
    .select("direction, created_at").or(`lead_id.eq.${params.id},phone9.eq.${fone9(phone)}`)
    .order("created_at", { ascending: true });
  const aberta = dentroDaJanela(ultimaEntrada((hist ?? []) as MsgRow[]), Date.now());
  /*
    Fora das 24h só passa o modelo aprovado -- e passa mesmo.

    É a regra da Meta, e o modelo `pedido_recebido_piquet` existe precisamente
    para a cumprir: é ele que reabre a janela. Antes, o ecrã dizia que não dava
    para escrever e mandava a pessoa para o WhatsApp do telemóvel, mesmo quando
    o envio automático tinha falhado e o cliente estava à espera de resposta.
    Dizer "não dá" quando dá é pior do que não ter o botão.
  */
  if (!aberta && !modelo) {
    return apiErr(
      "Passaram mais de 24h desde a última mensagem do cliente. Usa a confirmação por modelo para reabrir a conversa.",
      409,
    );
  }

  // Envia primeiro; só se a Meta aceitar é que se grava — assim a conversa não
  // mostra como enviada uma mensagem que afinal não saiu.
  let waMessageId = "";
  let corpo = body;
  try {
    if (modelo) {
      const dados = extrairDadosLead(dadosLead.message || "", dadosLead.name || "");
      const primeiro = primeiroNome(dados.nome || dadosLead.name || "");
      if (!primeiro) {
        return apiErr("O modelo precisa do primeiro nome do cliente. Edita o pedido e preenche o nome.", 422);
      }
      const local = dados.localizacao.trim();
      const servico = dados.servico.trim() || "assistência";
      const pedido = local ? `${servico} em ${local}` : servico;
      const env = await enviarModeloLead(phone, primeiro, pedido);
      waMessageId = env.waMessageId;
      // O que o cliente leu. Só se cai na etiqueta quando não se consegue ler
      // o modelo aprovado na Meta.
      corpo = env.texto || `[modelo ${MODELO_LEAD.nome}] ${primeiro} · ${pedido}`;
    } else {
      ({ waMessageId } = await enviarTextoWhatsapp(phone, body));
    }
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Falha ao enviar pelo WhatsApp.", 502);
  }

  const { data: guardada, error: insErr } = await db.from("whatsapp_messages").insert({
    lead_id: params.id,
    phone,
    direction: "out",
    body: corpo,
    wa_message_id: waMessageId || null,
    status: "sent",
    sent_by: staff.email,
  }).select("*").single();
  if (insErr) throw new Error(insErr.message);

  return apiOk(toDTO(guardada as MsgRow));
});
