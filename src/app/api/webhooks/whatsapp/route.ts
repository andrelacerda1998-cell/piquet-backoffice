import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { WHATSAPP_ENABLED, enviarTextoWhatsapp } from "@/lib/whatsapp";
import { extrairDadosLead, mensagemBoasVindas, eFormularioLanding, contactoNoFormulario } from "@/lib/leadReply";
import { interpretarResposta, fone9 } from "@/lib/despacho";
import { tecnicoPorTelefone } from "@/lib/tecnicoContactos";

/**
 * Webhook do WhatsApp Business (Meta Cloud API). Cada mensagem recebida no
 * número da Piquet entra como pedido em **Pedidos** com o estado
 * "Não iniciado" (`source: "whatsapp"`).
 *
 * GET  — verificação do webhook (Meta chama com hub.challenge na configuração).
 * POST — mensagens recebidas. Se `WHATSAPP_APP_SECRET` estiver definido, valida
 *        a assinatura `X-Hub-Signature-256`.
 *
 * Configuração (App > WhatsApp > Configuration na Meta):
 *   Callback URL:  https://piquet-dashboard.vercel.app/api/webhooks/whatsapp
 *   Verify token:  = env WHATSAPP_VERIFY_TOKEN
 *   Subscrever ao campo "messages".
 */

export const dynamic = "force-dynamic";

// --- Verificação do webhook ------------------------------------------------
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const mode = q.get("hub.mode");
  const token = q.get("hub.verify_token");
  const challenge = q.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// --- Mensagens recebidas ---------------------------------------------------
interface WaContact { profile?: { name?: string }; wa_id?: string }
interface WaMessage { id?: string; from?: string; type?: string; timestamp?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { list_reply?: { title?: string }; button_reply?: { title?: string } } }
// A Meta manda estes para dizer que uma mensagem NOSSA foi entregue/lida/falhou.
interface WaStatus { id?: string; status?: string; }

/** Extrai o texto legível de vários tipos de mensagem (texto/botão/lista). */
function messageText(m: WaMessage): string {
  return (
    m.text?.body ??
    m.button?.text ??
    m.interactive?.list_reply?.title ??
    m.interactive?.button_reply?.title ??
    `[${m.type ?? "mensagem"}]`
  );
}

export async function POST(req: Request) {
  const raw = await req.text();

  // Validação da assinatura (opcional — só se o segredo estiver configurado).
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const ok = sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return new NextResponse("bad signature", { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  // Sempre 200 para a Meta não reenviar; qualquer falha é engolida em silêncio.
  if (!SUPABASE_ENABLED) return NextResponse.json({ ok: true });

  try {
    const db = supabaseAdmin();
    const entries = (payload as { entry?: { changes?: { value?: { contacts?: WaContact[]; messages?: WaMessage[]; statuses?: WaStatus[] } }[] }[] }).entry ?? [];
    for (const e of entries) {
      for (const ch of e.changes ?? []) {
        const v = ch.value ?? {};

        // --- Updates de estado das NOSSAS mensagens (entregue/lido/falhou) ---
        // Casa-se pelo id da Meta. Não bloqueia nada se a coluna/tabela ainda
        // não existir (migração por correr).
        for (const st of v.statuses ?? []) {
          if (!st.id || !st.status) continue;
          try {
            await db.from("whatsapp_messages").update({ status: st.status }).eq("wa_message_id", st.id);
          } catch { /* tabela ainda não migrada — ignora */ }
        }

        // --- Mensagens recebidas do cliente ---
        const nameByPhone = new Map((v.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]));
        for (const m of v.messages ?? []) {
          const phone = (m.from ?? "").slice(0, 50);
          if (!phone) continue;
          const nome = (nameByPhone.get(phone) ?? "").slice(0, 200);
          const texto = messageText(m).slice(0, 2000);

          /*
            É um técnico a responder a um pedido que lhe difundimos?

            Tem de ser decidido ANTES de se mexer nas leads. Sem isto, o "sim"
            de um técnico criava-lhe uma lead no CRM -- a rede de quem executa
            os serviços entrava na lista de quem os pede.

            Casa-se pelos últimos 9 dígitos: o Laravel guarda "912345678" e a
            Meta manda "351912345678".
          */
          const respostaTecnico = await tratarRespostaTecnico(db, phone, texto);
          if (respostaTecnico) continue;

          /*
            Não é resposta a um pedido, mas é da rede?

            Um técnico também escreve fora do despacho -- uma dúvida, uma foto,
            "cheguei". Isso não é um pedido de serviço, e entrar no CRM como
            lead punha quem executa os serviços na lista de quem os pede. A
            mensagem fica guardada com o técnico, e aparece no perfil dele.

            Se a cópia local dos números falhar, `tecnicoPorTelefone` devolve
            null e a mensagem segue como cliente -- é a falha certa: uma
            mensagem a mais no CRM corrige-se à mão, uma de cliente que não
            entra perde-se.
          */
          const tecnico = await tecnicoPorTelefone(phone);
          if (tecnico) {
            try {
              await db.from("whatsapp_messages").upsert({
                technician_id: tecnico.id,
                phone,
                direction: "in",
                body: texto,
                wa_message_id: m.id ?? null,
                status: "received",
              }, { onConflict: "wa_message_id", ignoreDuplicates: true });
            } catch { /* tabela não migrada — a mensagem não se perde no log */ }
            continue;
          }

          // A lead: reutiliza a mais recente deste telefone, ou cria uma nova.
          // Antes criava-se SEMPRE uma lead nova por mensagem — dez mensagens
          // do mesmo cliente enchiam o CRM com dez pedidos iguais.
          let leadId: string | null = null;
          /*
            Procura pelos últimos 9 dígitos, não pelo texto do telefone.

            A landing grava "934670597" e a Meta manda "351934670597": pela
            comparação literal nunca casavam, e a resposta de um cliente ao
            nosso "recebemos o seu pedido" criava uma lead NOVA -- um "Ok"
            solto, separado do pedido a que respondia. Foi o que aconteceu a
            07/09.
          */
          /*
            E o número a procurar não é necessariamente o de quem envia.

            A mensagem que a landing prepara traz "*Contacto:* 912345678", que é
            o que a pessoa escreveu no formulário. Quem carrega em enviar pode
            estar noutro telemóvel -- preencheu no computador e enviou do
            telefone de outra pessoa. A 08/09 aconteceu: o formulário levava
            932429907, a mensagem veio de 919820416, e o mesmo pedido entrou
            duas vezes.

            O contacto escrito ganha, quando existe: é o número por onde se vai
            responder ao cliente.
          */
          const contacto = fone9(contactoNoFormulario(texto)) || fone9(phone);

          const { data: existente } = await db
            .from("leads").select("id").eq("phone9", contacto)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (existente?.id) {
            leadId = existente.id as string;
          } else {
            const { data: nova } = await db.from("leads").insert({
              name: nome,
              // O contacto do formulário quando existe: é por aí que se
              // responde ao cliente, não pelo telemóvel de quem carregou em
              // enviar. "novo" e não "nao_iniciado" -- o estado mudou de nome
              // a 08/09 e isto ficou para trás, a gravar o antigo.
              phone: contacto || phone,
              message: texto, source: "whatsapp", stage: "novo",
            }).select("id").single();
            leadId = (nova?.id as string) ?? null;
          }

          // Esta mensagem já foi processada? A Meta reenvia o webhook até
          // receber 200; a `wa_message_id` é única por mensagem, por isso serve
          // de guarda para não responder duas vezes ao mesmo pedido.
          let jaProcessada = false;
          if (m.id) {
            try {
              const { count } = await db
                .from("whatsapp_messages")
                .select("id", { count: "exact", head: true })
                .eq("wa_message_id", m.id);
              jaProcessada = (count ?? 0) > 0;
            } catch { /* tabela não migrada — segue como não processada */ }
          }

          // A mensagem na conversa. `wa_message_id` é único: se a Meta reenviar
          // o webhook (fá-lo até receber 200), a mesma mensagem não entra duas
          // vezes. Se a tabela ainda não existir, a lead já ficou criada acima.
          try {
            await db.from("whatsapp_messages").upsert({
              lead_id: leadId,
              phone,
              direction: "in",
              body: texto,
              wa_message_id: m.id ?? null,
              status: "received",
            }, { onConflict: "wa_message_id", ignoreDuplicates: true });
          } catch { /* tabela ainda não migrada — a lead já entrou */ }

          // Resposta automática de boas-vindas — só quando a mensagem é um
          // pedido do formulário da landing (não um "olá" solto), só uma vez
          // por mensagem (guarda `jaProcessada`) e só com o WhatsApp ligado.
          // Como o cliente acabou de escrever, a janela de 24h está aberta: é
          // texto livre, sem modelo pago. Uma falha de envio nunca parte o
          // webhook.
          if (eFormularioLanding(texto) && !jaProcessada && leadId && WHATSAPP_ENABLED) {
            try {
              const corpo = mensagemBoasVindas(extrairDadosLead(texto, nome));
              const { waMessageId } = await enviarTextoWhatsapp(phone, corpo);
              try {
                await db.from("whatsapp_messages").insert({
                  lead_id: leadId, phone, direction: "out", body: corpo,
                  wa_message_id: waMessageId || null, status: "sent", sent_by: "auto",
                });
              } catch { /* tabela não migrada — a mensagem saiu na mesma */ }
            } catch { /* envio falhou — não propaga */ }
          }
        }
      }
    }
  } catch {
    // não propaga — o webhook responde sempre 200
  }
  return NextResponse.json({ ok: true });
}

/**
 * Marca a difusão como aceite ou recusada quando quem escreve é um técnico a
 * quem perguntámos. Devolve true quando a mensagem foi tratada como resposta —
 * e aí não vira lead nenhuma.
 *
 * Uma mensagem que não se percebe ("a que horas?") devolve false de propósito:
 * segue o caminho normal e fica visível para alguém responder. Adivinhar aí
 * seria arriscar dar como recusado um técnico que só queria uma informação.
 */
async function tratarRespostaTecnico(
  db: ReturnType<typeof supabaseAdmin>,
  phone: string,
  texto: string,
): Promise<boolean> {
  const decisao = interpretarResposta(texto);
  if (!decisao) return false;

  try {
    // Só difusões ainda sem resposta, da mais recente para trás: um técnico
    // que responde "sim" está a responder ao último pedido que recebeu.
    const { data } = await db
      .from("lead_dispatches")
      .select("id, phone, lead_id")
      .eq("status", "enviado")
      .order("created_at", { ascending: false })
      .limit(50);

    const alvo = ((data ?? []) as { id: string; phone: string; lead_id: string }[])
      .find((d) => fone9(d.phone) === fone9(phone));
    if (!alvo) return false;

    await db.from("lead_dispatches")
      .update({ status: decisao, responded_at: new Date().toISOString() })
      .eq("id", alvo.id);

    // A resposta fica na conversa da lead: quem despacha precisa de ver o que
    // o técnico escreveu, não só o estado.
    try {
      await db.from("whatsapp_messages").insert({
        lead_id: alvo.lead_id, phone, direction: "in",
        body: texto, status: "received",
      });
    } catch { /* tabela não migrada — o estado já ficou */ }

    return true;
  } catch {
    // Sem a tabela das difusões (migração por correr) segue o caminho normal.
    return false;
  }
}
