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
interface WaMessage { from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { list_reply?: { title?: string }; button_reply?: { title?: string } } }

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
    const entries = (payload as { entry?: { changes?: { value?: { contacts?: WaContact[]; messages?: WaMessage[] } }[] }[] }).entry ?? [];
    const rows: Record<string, string>[] = [];
    for (const e of entries) {
      for (const ch of e.changes ?? []) {
        const v = ch.value ?? {};
        const nameByPhone = new Map((v.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]));
        for (const m of v.messages ?? []) {
          const phone = m.from ?? "";
          rows.push({
            name: (nameByPhone.get(phone) ?? "").slice(0, 200),
            phone: phone.slice(0, 50),
            message: messageText(m).slice(0, 2000),
            source: "whatsapp",
            stage: "nao_iniciado",
          });
        }
      }
    }
    if (rows.length) await supabaseAdmin().from("leads").insert(rows);
  } catch {
    // não propaga — o webhook responde sempre 200
  }
  return NextResponse.json({ ok: true });
}
