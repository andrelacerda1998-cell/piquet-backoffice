import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { WHATSAPP_ENABLED, dentroDaJanela, enviarTextoWhatsapp } from "@/lib/whatsapp";
import { fone9 } from "@/lib/telefone";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";

/**
 * Conversa de WhatsApp com um técnico.
 *
 * Separada da do cliente de propósito. Antes, uma mensagem de um técnico só
 * podia existir agarrada a uma lead -- e por isso entrava no CRM como se fosse
 * um pedido de serviço. Aqui pertence a quem a escreveu.
 *
 * A janela das 24h aplica-se na mesma: é regra da Meta, não nossa. Fora dela,
 * o pedido difundido (que é modelo) é o que reabre a conversa.
 */

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

function ultimaEntrada(msgs: MsgRow[]): string | null {
  const ins = msgs.filter((m) => m.direction === "in");
  return ins.length ? ins[ins.length - 1].created_at : null;
}

export const GET = withStaff(async (_req, { params }) => {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("whatsapp_messages").select("*")
    .eq("technician_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
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

export const POST = withStaff(async (req, { params, staff }) => {
  const b = (await req.json().catch(() => null)) as { body?: string } | null;
  const body = (b?.body ?? "").trim();
  if (!body) return apiErr("Escreve a mensagem antes de enviar.");
  if (body.length > 4000) return apiErr("Mensagem demasiado longa (máx. 4000 caracteres).");

  if (!WHATSAPP_ENABLED) {
    return apiErr("O envio pelo WhatsApp ainda não está ligado. Faltam as chaves da Meta na Vercel.", 501);
  }

  const db = supabaseAdmin();

  /*
    O número vem da cópia local dos técnicos, não do que o browser mandou --
    o mesmo cuidado do despacho: um id trocado não pode virar uma mensagem
    para um número arbitrário.
  */
  const { data: contacto } = await db
    .from("technician_phones").select("phone9").eq("technician_id", params.id).maybeSingle();
  const phone9 = (contacto as { phone9: string } | null)?.phone9 || "";
  if (!phone9) {
    return apiErr("Este técnico não tem telefone conhecido. Abre o Despacho uma vez para actualizar a lista.", 404);
  }

  const { data: hist } = await db.from("whatsapp_messages")
    .select("direction, created_at").eq("technician_id", params.id)
    .order("created_at", { ascending: true });
  if (!dentroDaJanela(ultimaEntrada((hist ?? []) as MsgRow[]), Date.now())) {
    return apiErr(
      "Passaram mais de 24h desde a última mensagem deste técnico. Só um pedido difundido reabre a conversa.",
      409,
    );
  }

  let waMessageId = "";
  try {
    ({ waMessageId } = await enviarTextoWhatsapp(phone9, body));
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Falha ao enviar pelo WhatsApp.", 502);
  }

  const { data: guardada, error: insErr } = await db.from("whatsapp_messages").insert({
    technician_id: params.id,
    phone: fone9(phone9),
    direction: "out",
    body,
    wa_message_id: waMessageId || null,
    status: "sent",
    sent_by: staff.email,
  }).select("*").single();
  if (insErr) throw new Error(insErr.message);

  return apiOk(toDTO(guardada as MsgRow));
});
