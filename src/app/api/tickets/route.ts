import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { lerPedido } from "./_lib";
import { assinarImagensDoCliente, type MensagemGuardada } from "./_conversa";
import { subirImagens } from "./_imagens";

/**
 * POST /api/tickets — receção PÚBLICA de tickets de suporte da app cliente
 * (e, no futuro, da app dos técnicos via channel/requester_type).
 *
 * O pedido vem de utilizadores da app sem token do backoffice, por isso é o
 * único endpoint /api sem autenticação -- o /api/leads, que era o outro, foi
 * fechado a 24/09/2026 quando o formulário saiu da landing. Defesas: honeypot
 * `website`, validação/truncagem, CORS só POST/OPTIONS. Ler e responder a
 * tickets continua a exigir staff (/api/support/inbox).
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const clip = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

const STATUS_LABEL: Record<string, string> = {
  novo: "Recebido",
  em_curso: "Em análise",
  aguarda_cliente: "À espera de ti",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

/** uuid v4 — o único formato aceite como credencial de leitura. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/tickets?tokens=<uuid>,<uuid> — estado atual dos tickets indicados.
 *
 * Autorização por posse do token: cada ticket tem um `access_token` aleatório
 * devolvido UMA vez, no POST que o criou, e guardado só no dispositivo do
 * cliente. Sem sessão do backoffice, é o que substitui a autenticação aqui.
 *
 * O parâmetro `ids` foi REMOVIDO de propósito: o id é sequencial ("TK-1101",
 * "TK-1102", …), portanto aceitá-lo permitia enumerar e ler tickets de outros
 * clientes sem credenciais — confirmado na auditoria de 2026-08-03. Pedidos
 * antigos que ainda enviem `ids` recebem lista vazia (falha fechada), nunca
 * dados de terceiros.
 */
export async function GET(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }
  const url = new URL(req.url);
  const tokens = (url.searchParams.get("tokens") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s)) // descarta lixo antes de chegar à BD
    .slice(0, 50);
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, tickets: [] }, { status: 200, headers: CORS });
  }
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .select("id, subject, status, last_message_at, unread, messages, access_token")
    .in("access_token", tokens);
  if (error) {
    return NextResponse.json({ ok: false, error: "erro" }, { status: 500, headers: CORS });
  }
  // A conversa inteira, não só a última resposta. Um ticket é uma troca: o
  // suporte pergunta, o cliente responde, e ambos precisam de ver o que já foi
  // dito. Mandar um "preview" obrigava o cliente a ir ao email reconstruir o
  // fio — e não havia forma de ele responder de volta.
  const comConversa = await assinarImagensDoCliente(
    (data ?? []).map((t) => ({
      ...t,
      messages: Array.isArray((t as { messages?: unknown[] }).messages)
        ? ((t as { messages: unknown[] }).messages as MensagemGuardada[])
        : [],
    })),
  );

  const tickets = comConversa.map((t) => {
    const lastAgent = [...t.messages].reverse().find((m) => m?.from === "agente");
    return {
      id: t.id,
      // Devolvido para a app casar a resposta com o ticket que tem em memória
      // (a app já o conhece — foi ela que o enviou no pedido).
      access_token: t.access_token,
      subject: t.subject,
      status: t.status,
      status_label: STATUS_LABEL[t.status] ?? t.status,
      last_message_at: t.last_message_at,
      has_reply: !!lastAgent,
      // Mantido para as versões da app já instaladas, que só sabem ler isto.
      reply_preview: lastAgent?.body ?? null,
      messages: t.messages,
      // Um ticket fechado não aceita resposta; os outros aceitam.
      can_reply: t.status !== "fechado",
    };
  });
  return NextResponse.json({ ok: true, tickets }, { status: 200, headers: CORS });
}

export async function POST(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }

  // Duas formas de entrar, e as duas têm de continuar a funcionar: as versões
  // da app já instaladas mandam JSON, as novas mandam multipart quando há
  // fotos. Ler o Content-Type em vez de assumir evita partir quem não
  // actualizou — e quem nunca vai actualizar.
  let lido: Awaited<ReturnType<typeof lerPedido>>;
  try {
    lido = await lerPedido(req);
  } catch {
    return NextResponse.json({ ok: false, error: "pedido inválido" }, { status: 400, headers: CORS });
  }
  const body = lido.body;
  const imagens = lido.imagens;

  // Honeypot: humanos não veem o campo, bots preenchem-no. Falso sucesso.
  if (clip(body.website, 10)) {
    return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
  }

  const name = clip(body.name, 200);
  const email = clip(body.email, 200);
  const phone = clip(body.phone, 50);
  const subject = clip(body.subject, 200);
  const message = clip(body.message, 4000);

  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Escreve a tua mensagem." },
      { status: 400, headers: CORS },
    );
  }
  if (!name && !email && !phone) {
    return NextResponse.json(
      { ok: false, error: "Indica pelo menos nome, email ou telefone." },
      { status: 400, headers: CORS },
    );
  }

  // Depois de validar o texto: uma mensagem vazia não merece um upload, e o
  // honeypot acima já mandou os bots embora sem tocar no Storage.
  const imagePaths = imagens.length > 0 ? await subirImagens(imagens) : [];

  const now = new Date().toISOString();
  /*
    A ORIGEM decide-se UMA vez, e tudo o resto lê daqui.
    Estava escrita duas vezes (canal e tipo) e uma terceira, por omissão, no
    nome do autor -- que dizia "Cliente" a toda a gente. Um técnico sem nome
    preenchido aparecia no backoffice com o selo «Técnico» e a mensagem
    assinada por «Cliente», na mesma linha.
  */
  const daAppDosTecnicos = clip(body.channel, 30) === "app_tecnico";
  const tratamento = daAppDosTecnicos ? "Técnico" : "Cliente";
  const ticket = {
    channel: daAppDosTecnicos ? "app_tecnico" : "app_cliente",
    requester_type: daAppDosTecnicos ? "tecnico" : "cliente",
    requester_name: name,
    requester_email: email,
    requester_phone: phone,
    subject: subject || message.slice(0, 80),
    category: clip(body.category, 100),
    service_id: clip(body.service_id, 100),
    messages: [
      {
        id: `im_${Date.now()}`,
        from: "requester",
        authorName: name || tratamento,
        body: message,
        at: now,
        // Só aparece quando há fotos: uma lista vazia em todas as mensagens
        // antigas obrigaria a migrar o jsonb sem ganhar nada.
        ...(imagePaths.length > 0 ? { images: imagePaths } : {}),
      },
    ],
    unread: 1,
    opened_at: now,
    last_message_at: now,
  };

  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .insert(ticket)
    .select("id, access_token")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: "erro ao guardar" }, { status: 500, headers: CORS });
  }
  // O access_token é devolvido UMA só vez, aqui. É a credencial que a app guarda
  // no dispositivo para poder consultar o estado deste ticket (ver GET).
  return NextResponse.json(
    { ok: true, ticket_id: data.id, access_token: data.access_token },
    { status: 201, headers: CORS },
  );
}
