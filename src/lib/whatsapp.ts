import "server-only";

/**
 * Ligação ao WhatsApp Business (Meta Cloud API).
 *
 * Só ENVIA quando as chaves estiverem configuradas na Vercel — até lá, o
 * backoffice mostra a conversa recebida e diz honestamente que o envio ainda
 * não está ligado, em vez de fingir que mandou.
 *
 * Duas regras da Meta que o resto do código respeita:
 *  - Janela de 24h: só se pode responder em texto livre nas 24h desde a última
 *    mensagem do cliente. Fora disso, só mensagens-modelo aprovadas (pagas).
 *  - O número tem de ser dedicado à API (não serve na app normal em paralelo).
 */

import { normalizarTelefone } from "./whatsappWindow";
export { dentroDaJanela, normalizarTelefone, JANELA_RESPOSTA_MS } from "./whatsappWindow";

// Versão da Graph API. Sobe-se aqui quando a Meta descontinuar a atual.
const GRAPH_VERSION = "v21.0";

/** Há chaves para enviar? Sem elas, o backoffice só recebe. */
export const WHATSAPP_ENABLED = Boolean(
  process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
);

/**
 * Envia uma mensagem de texto pelo WhatsApp. Devolve o id da Meta para casar
 * com os updates de estado. Lança se a API recusar — o chamador guarda o erro
 * na conversa, para ficar à vista qual mensagem não saiu e porquê.
 */
export async function enviarTextoWhatsapp(phone: string, body: string): Promise<{ waMessageId: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp não configurado.");

  const to = normalizarTelefone(phone);
  if (!to) throw new Error("Telefone do contacto em falta ou inválido.");

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `A Meta recusou o envio (HTTP ${res.status}).`);
  }
  return { waMessageId: data.messages?.[0]?.id ?? "" };
}

/**
 * Estado do número na Meta: nome a mostrar, se já foi aprovado, qualidade e
 * limite de envio.
 *
 * Lê-se do nó do PRÓPRIO número (`GET /{phone_number_id}`) e não da conta
 * WhatsApp Business. É a diferença que torna isto possível sem configurar mais
 * nada: o `WHATSAPP_PHONE_NUMBER_ID` já existe, o id da WABA não — e este nó
 * devolve na mesma o `name_status`, que é a resposta a "já aprovaram o nome?".
 */
export interface EstadoNumeroWhatsapp {
  displayPhoneNumber: string | null;
  /** Nome que os clientes veem (ex.: "Piquet"). */
  verifiedName: string | null;
  /**
   * APPROVED · PENDING_REVIEW · DECLINED · EXPIRED · NONE — o estado da revisão
   * do nome. Enquanto não for APPROVED, o cliente vê o número em vez do nome.
   */
  nameStatus: string | null;
  qualityRating: string | null;
  /** Quantas conversas novas por dia a Meta permite iniciar. */
  messagingLimit: string | null;
  verificationStatus: string | null;
}

export async function estadoNumeroWhatsapp(): Promise<EstadoNumeroWhatsapp> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp não configurado.");

  const campos = [
    "display_phone_number",
    "verified_name",
    "name_status",
    "quality_rating",
    "messaging_limit_tier",
    "code_verification_status",
  ].join(",");

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=${campos}&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as Record<string, string> & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Meta devolveu ${res.status}`);

  return {
    displayPhoneNumber: json.display_phone_number ?? null,
    verifiedName: json.verified_name ?? null,
    nameStatus: json.name_status ?? null,
    qualityRating: json.quality_rating ?? null,
    messagingLimit: json.messaging_limit_tier ?? null,
    verificationStatus: json.code_verification_status ?? null,
  };
}
