import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";

/**
 * Webhook do WhatsApp Business (Meta Cloud API). Cada mensagem recebida no
 * número da Piquet entra como lead em **Marketing → CRM & Leads** com o estado
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

          // A lead: reutiliza a mais recente deste telefone, ou cria uma nova.
          // Antes criava-se SEMPRE uma lead nova por mensagem — dez mensagens
          // do mesmo cliente enchiam o CRM com dez pedidos iguais.
          let leadId: string | null = null;
          const { data: existente } = await db
            .from("leads").select("id").eq("phone", phone)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (existente?.id) {
            leadId = existente.id as string;
          } else {
            const { data: nova } = await db.from("leads").insert({
              name: nome, phone, message: texto, source: "whatsapp", stage: "nao_iniciado",
            }).select("id").single();
            leadId = (nova?.id as string) ?? null;
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
        }
      }
    }
  } catch {
    // não propaga — o webhook responde sempre 200
  }
  return NextResponse.json({ ok: true });
}
