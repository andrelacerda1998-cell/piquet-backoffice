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

/**
 * Conta WhatsApp Business (WABA) da Piquet.
 *
 * Não é uma credencial — é um identificador público da conta; sem o token não
 * dá para fazer nada com ele, por isso pode viver no código. Está aqui, e não
 * só no ambiente, porque não existe caminho na Graph API do
 * `phone_number_id` para a WABA: sem este número escrito, a única forma de o
 * obter é ir à consola do Facebook copiá-lo à mão.
 * A variável de ambiente, se existir, ganha.
 */
export const WHATSAPP_WABA_ID = process.env.WHATSAPP_WABA_ID || "1730246919105992";

export interface ModeloWhatsapp {
  id: string;
  name: string;
  /** APPROVED · PENDING · REJECTED · PAUSED · DISABLED */
  status: string;
  category: string | null;
  language: string | null;
  /** Porque foi recusado (a Meta manda "NONE" quando não há recusa). */
  rejectedReason: string | null;
  /** Texto do corpo, com os `{{n}}` por substituir. "" quando não vier. */
  corpo: string;
  /**
   * Dá para editar agora?
   *
   * A Meta só deixa editar modelos aprovados, recusados ou pausados -- um
   * modelo em revisão está a ser lido por alguém do lado deles. Vem calculado
   * daqui para o ecrã não ter de conhecer a regra.
   */
  editavel: boolean;
}

/**
 * Modelos de mensagem da conta. São o que permite ESCREVER PRIMEIRO a um
 * cliente — sem um modelo aprovado, o WhatsApp só deixa responder nas 24h
 * seguintes a uma mensagem dele, e as leads da landing nunca escrevem.
 */
export async function modelosWhatsapp(): Promise<ModeloWhatsapp[]> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WhatsApp não configurado.");

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_WABA_ID}/message_templates` +
      `?fields=name,status,category,language,rejected_reason,components&limit=50&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as {
    data?: {
      id: string; name: string; status: string; category?: string; language?: string;
      rejected_reason?: string; components?: { type: string; text?: string }[];
    }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || `Meta devolveu ${res.status}`);

  return (json.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    category: t.category ?? null,
    language: t.language ?? null,
    // "NONE" é a forma da Meta dizer "não foi recusado" — vira null para não
    // aparecer um motivo de recusa em modelos que estão bem.
    rejectedReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
    corpo: t.components?.find((c) => c.type === "BODY")?.text ?? "",
    editavel: ["APPROVED", "REJECTED", "PAUSED"].includes((t.status || "").toUpperCase()),
  }));
}

/**
 * Modelo aprovado que permite ESCREVER PRIMEIRO a um cliente.
 *
 * Sem um modelo, o WhatsApp só deixa responder nas 24h seguintes a uma
 * mensagem do cliente — e as leads da landing nunca escrevem, porque o
 * formulário deixou de as encaminhar para o WhatsApp. É isto que repõe a
 * resposta automática que existia antes.
 *
 * `{{1}}` = primeiro nome · `{{2}}` = serviço (+ localização, quando há).
 */
export const MODELO_LEAD = { nome: "pedido_recebido_piquet", idioma: "pt_PT" } as const;

/**
 * Modelo que leva um pedido à comunidade de técnicos.
 *
 * Também tem de ser modelo, e pela mesma razão do outro: o técnico não escreveu
 * primeiro, por isso a janela das 24h está fechada. A diferença é o destinatário
 * -- este vai para dentro da rede, não para o cliente.
 *
 * `{{1}}` = pedido (serviço + localização) · `{{2}}` = urgência.
 *
 * O corpo pede uma resposta em palavra, não um botão: botões obrigam a modelo
 * com componentes interactivos e a app do WhatsApp de negócio de cada técnico,
 * e um técnico a conduzir responde "sim" mais depressa do que encontra um botão.
 */
export const MODELO_TECNICO = { nome: "pedido_tecnico_piquet", idioma: "pt_PT" } as const;

export const CORPO_MODELO_TECNICO =
  "Novo pedido na Piquet: {{1}}.\n" +
  "Urgencia: {{2}}.\n\n" +
  "Se puder aceitar, responda SIM a esta mensagem. Se nao puder, responda NAO.\n" +
  "O primeiro a responder nao fica automaticamente com o servico -- a Piquet " +
  "confirma consigo antes de o atribuir.";

/**
 * Cria o modelo dos técnicos na conta da Meta e deixa-o em aprovação.
 *
 * Está no código, e não num passo-a-passo na consola, porque o texto tem de
 * bater certo com o que o webhook sabe interpretar: quem lê "responda SIM" é o
 * `interpretarResposta`. Separar as duas coisas era garantir que um dia alguém
 * mudava o texto e as respostas deixavam de ser lidas, sem nada a avisar.
 */
export async function criarModeloTecnico(): Promise<{ id: string; status: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WhatsApp não configurado.");

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_WABA_ID}/message_templates`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: MODELO_TECNICO.nome,
        language: MODELO_TECNICO.idioma,
        // UTILITY e não MARKETING: é um aviso operacional a quem já trabalha
        // com a Piquet, não angariação. A Meta cobra menos e aprova mais.
        category: "UTILITY",
        components: [
          {
            type: "BODY",
            text: CORPO_MODELO_TECNICO,
            example: { body_text: [["Canalizacao em Lisboa", "Normal (proximos dias)"]] },
          },
        ],
      }),
    },
  );
  const json = (await res.json()) as { id?: string; status?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Meta devolveu ${res.status}`);
  return { id: json.id ?? "", status: json.status ?? "PENDING" };
}

/**
 * Envia o pedido a um técnico. Devolve o id da Meta para se poder casar
 * depois o estado (entregue/lida) com esta difusão.
 */
export async function enviarModeloTecnico(
  to: string,
  pedido: string,
  urgencia: string,
): Promise<{ waMessageId: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp não configurado.");
  if (!pedido.trim() || !urgencia.trim()) throw new Error("Modelo exige pedido e urgência.");

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizarTelefone(to),
      type: "template",
      template: {
        name: MODELO_TECNICO.nome,
        language: { code: MODELO_TECNICO.idioma },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: pedido.trim() },
            { type: "text", text: urgencia.trim() },
          ],
        }],
      },
    }),
  });
  const json = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Meta devolveu ${res.status}`);
  return { waMessageId: json.messages?.[0]?.id ?? "" };
}

/**
 * Corpo aprovado do modelo, com os parâmetros já substituídos.
 *
 * Serve para guardar no histórico o que o cliente leu, e não uma etiqueta
 * interna: quem abre a lead precisa de saber o que já lhe foi dito antes de
 * escrever a seguir. O texto vive na Meta (é lá que é aprovado e editado),
 * por isso lê-se de lá em vez de o duplicar aqui e arriscar que divirja.
 *
 * Uma falha nisto não pode travar o envio -- devolve null e o chamador guarda
 * o que souber. A mensagem já saiu; o que está em causa é só como se mostra.
 */
let corpoModeloCache: string | null = null;

async function corpoModeloLead(primeiroNome: string, pedido: string): Promise<string | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;
  try {
    if (corpoModeloCache === null) {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_WABA_ID}/message_templates` +
          `?fields=name,components&name=${MODELO_LEAD.nome}&limit=5&access_token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: { name: string; components?: { type: string; text?: string }[] }[];
      };
      if (!res.ok) return null;
      const modelo = (json.data ?? []).find((t) => t.name === MODELO_LEAD.nome);
      const corpo = modelo?.components?.find((c) => c.type === "BODY")?.text;
      if (!corpo) return null;
      corpoModeloCache = corpo;
    }
    return corpoModeloCache
      .replace(/\{\{\s*1\s*\}\}/g, primeiroNome.trim())
      .replace(/\{\{\s*2\s*\}\}/g, pedido.trim());
  } catch {
    return null;
  }
}

/**
 * Envia o modelo. Os parâmetros NUNCA podem ir vazios — a Meta rejeita o
 * pedido —, por isso é o chamador que garante que ambos têm conteúdo.
 *
 * Devolve também o texto que o cliente recebeu, quando se consegue ler o
 * modelo aprovado, para o histórico mostrar a mensagem e não uma referência.
 */
export async function enviarModeloLead(
  to: string,
  primeiroNome: string,
  pedido: string,
): Promise<{ waMessageId: string; texto: string | null }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp não configurado.");
  if (!primeiroNome.trim() || !pedido.trim()) {
    throw new Error("Modelo exige nome e pedido preenchidos.");
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizarTelefone(to),
      type: "template",
      template: {
        name: MODELO_LEAD.nome,
        language: { code: MODELO_LEAD.idioma },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: primeiroNome.trim() },
            { type: "text", text: pedido.trim() },
          ],
        }],
      },
    }),
  });
  const json = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Meta devolveu ${res.status}`);
  // Só depois de a mensagem sair: se a leitura do modelo falhar, já não muda
  // nada do que aconteceu ao cliente.
  const texto = await corpoModeloLead(primeiroNome, pedido);
  return { waMessageId: json.messages?.[0]?.id ?? "", texto };
}

/**
 * Reescreve o corpo de um modelo já submetido.
 *
 * A Meta volta a pôr o modelo em revisão -- até ser reaprovado deixa de poder
 * ser enviado. Isto não é um campo que se experimente: é uma submissão, com o
 * custo de o canal ficar parado entretanto. O ecrã tem de o dizer.
 *
 * O `example` acompanha o texto porque a Meta rejeita corpos com parâmetros
 * sem exemplo; conta-se quantos `{{n}}` existem e manda-se um exemplo com esse
 * tamanho, senão uma edição que acrescente um parâmetro é recusada.
 */
export async function editarCorpoModelo(id: string, corpo: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WhatsApp não configurado.");

  const nParams = new Set((corpo.match(/\{\{\s*(\d+)\s*\}\}/g) ?? [])).size;
  const exemplo = Array.from({ length: nParams }, (_, i) => `exemplo ${i + 1}`);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      components: [{
        type: "BODY",
        text: corpo,
        ...(nParams > 0 ? { example: { body_text: [exemplo] } } : {}),
      }],
    }),
  });
  const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Meta devolveu ${res.status}`);
}
