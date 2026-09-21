import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { resolveCategoryId, categoryFromMessage } from "@/lib/categories";
import { eDuplicado, JANELA_MESMA_MENSAGEM_MIN } from "@/lib/leadDedupe";
import { fone9 } from "@/lib/telefone";

/**
 * POST /api/leads — receção PÚBLICA de leads do formulário da landing page
 * (piquetapp.com). É o único endpoint /api sem autenticação: o formulário corre
 * no browser de visitantes anónimos, não há token possível.
 *
 * Defesas (sem dependências externas):
 * - honeypot `website`: campo invisível no formulário; bots preenchem-no e
 *   recebem um falso sucesso, sem escrita na base de dados;
 * - validação e truncagem de todos os campos, e pelo menos um contacto
 *   (nome/email/telefone) obrigatório;
 * - CORS aberto só a POST/OPTIONS — ler leads continua a exigir staff
 *   (GET /api/marketing/leads).
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const clip = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

export async function POST(req: Request) {
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "indisponível" }, { status: 503, headers: CORS });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400, headers: CORS });
  }

  // Honeypot: humanos não veem o campo, bots preenchem-no. Falso sucesso.
  if (clip(body.website, 10)) {
    return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
  }

  // Categoria escolhida pelo cliente no formulário — aceita nome, slug ou id
  // (com/sem acentos), sob qualquer um destes campos. Resolve para o id canónico
  // para o CRM já a mostrar preenchida; "" quando não corresponde a nenhuma.
  // O formulário atual da landing NÃO envia campo de categoria — mas escreve
  // "Servico: X" na mensagem, por isso ela dá-se a deduzir. Sem este fallback,
  // 18 das 23 primeiras leads entraram sem categoria apesar de a mensagem
  // dizer "Servico: Limpeza Doméstica" e afins.
  const categoryId =
    resolveCategoryId(body.category ?? body.categoryId ?? body.category_id ?? body.service ?? body.servico) ||
    categoryFromMessage(clip(body.message, 2000));

  /*
    Atribuição: de onde veio esta lead.

    Os UTM podem ser reescritos por encurtadores e redirecionamentos; o `gclid`
    e o `fbclid` não, e por isso valem como fonte de verdade quando existem.
    Guardam-se os dois — a vista `lead_attribution` deduz o canal do
    identificador de clique quando o utm_source falta.

    Campos vazios ficam vazios: "direto" é uma conclusão a tirar na leitura,
    não um valor a inventar na escrita.
  */
  const atribuicao: Record<string, string> = {
    utm_source: clip(body.utm_source, 100),
    utm_medium: clip(body.utm_medium, 100),
    utm_campaign: clip(body.utm_campaign, 200),
    utm_content: clip(body.utm_content, 200),
    utm_term: clip(body.utm_term, 200),
    gclid: clip(body.gclid, 300),
    fbclid: clip(body.fbclid, 300),
    landing_page: clip(body.landing_page, 500),
    referrer: clip(body.referrer, 500),
  };

  const lead: Record<string, string> = {
    ...Object.fromEntries(Object.entries(atribuicao).filter(([, v]) => v)),
    name: clip(body.name, 200),
    email: clip(body.email, 200),
    phone: clip(body.phone, 50),
    city: clip(body.city, 100),
    message: clip(body.message, 2000),
    source: clip(body.source, 100) || "website",
    stage: "novo", // entra como "Novo"
  };
  if (categoryId) lead.category_id = categoryId;
  if (!lead.name && !lead.email && !lead.phone) {
    return NextResponse.json(
      { ok: false, error: "Indica pelo menos nome, email ou telefone." },
      { status: 400, headers: CORS },
    );
  }

  // Anti-duplicação: o formulário/WhatsApp costuma disparar o POST duas vezes
  // (submit + click-to-chat, ou duplo toque) — chegavam pares da MESMA pessoa e
  // MESMO pedido com segundos de diferença. Se já existe uma lead igual (mesmo
  // contacto + mesma mensagem) nos últimos 30 min, devolve sucesso sem gravar.
  // Procura-se pelo CONTACTO (não pela mensagem) e decide-se em `eDuplicado`:
  // exigir mensagem idêntica deixava passar pares reais em que o utilizador
  // mexeu no dropdown entre os dois envios — chegaram duas leads do mesmo
  // telefone no mesmo minuto, uma com "Servico: Outro" e outra com
  // "Servico: Selecionar…".
  const since = new Date(Date.now() - JANELA_MESMA_MENSAGEM_MIN * 60 * 1000).toISOString();
  let dupQ = supabaseAdmin().from("leads").select("created_at, message").gte("created_at", since);
  // Pelos últimos 9 dígitos: o mesmo número entra com indicativo pela Meta e
  // sem ele pela landing, e pela comparação literal os dois nunca casavam.
  dupQ = lead.phone ? dupQ.eq("phone9", fone9(lead.phone))
    : lead.email ? dupQ.eq("email", lead.email)
    : dupQ.eq("name", lead.name);
  const { data: recentes } = await dupQ;
  if (eDuplicado(recentes ?? [], lead.message, Date.now())) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200, headers: CORS });
  }

  const { error } = await supabaseAdmin().from("leads").insert(lead);
  if (error) {
    return NextResponse.json({ ok: false, error: "erro ao guardar" }, { status: 500, headers: CORS });
  }

  /*
    O pedido fica registado, e é só isso que acontece aqui.

    Havia uma confirmação automática pelo WhatsApp, enviada com o modelo
    aprovado da Meta. Saiu com a Cloud API: o 926 866 108 passou para a app
    WhatsApp Business, no telemóvel, e é de lá que se responde. O backoffice
    regista o pedido e mostra-o -- quem responde é uma pessoa.
  */

  return NextResponse.json({ ok: true }, { status: 201, headers: CORS });
}

