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
