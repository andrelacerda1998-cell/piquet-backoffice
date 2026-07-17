import { NextResponse } from "next/server";
import { SUPABASE_ENABLED } from "@/lib/supabase/server";
import { paylandsConfigured, paylandsDate } from "../../_lib/paylands";
import { syncPopTransactions } from "../../_lib/popSync";
import { logCronRun, ranWithin } from "../../_lib/cronlog";

/**
 * POST /api/webhooks/paylands — notificações do Payshop Online Payments.
 *
 * Registar no backoffice POP (popbackoffice.payshop.pt → Desenvolvedores):
 *   https://piquet-dashboard.vercel.app/api/webhooks/paylands?key=<PAYLANDS_WEBHOOK_KEY>
 *
 * Segurança pelo padrão "re-fetch": o payload recebido é IGNORADO — serve só
 * de gatilho. Vamos buscar a verdade à própria API (autenticados) e fazemos o
 * upsert idempotente. Um payload forjado não consegue escrever nada; o pior
 * que um abuso consegue é provocar re-sincronizações, e o debounce limita-as.
 *
 * `key` na query string: proteção simples contra pokes aleatórios. Se a env
 * PAYLANDS_WEBHOOK_KEY não estiver definida, o endpoint aceita sem chave
 * (mantém o deploy funcional antes de a configurar).
 */

export const dynamic = "force-dynamic";

/** Janela re-sincronizada a cada notificação (cobre confirmações tardias). */
const WINDOW_HOURS = 48;
/** Não re-sincroniza mais do que uma vez por minuto e meio. */
const DEBOUNCE_SECONDS = 90;

export async function POST(req: Request) {
  if (!SUPABASE_ENABLED || !paylandsConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const expected = process.env.PAYLANDS_WEBHOOK_KEY;
  if (expected && new URL(req.url).searchParams.get("key") !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Consome o corpo sem o usar (evita retries de proveniência por resposta antecipada).
  try { await req.text(); } catch { /* irrelevante */ }

  if (await ranWithin("pop-webhook", DEBOUNCE_SECONDS)) {
    return NextResponse.json({ ok: true, skipped: "debounce" });
  }

  const end = paylandsDate(new Date());
  const start = paylandsDate(new Date(Date.now() - WINDOW_HOURS * 3_600_000));
  try {
    const upserted = await syncPopTransactions(start, end);
    await logCronRun("pop-webhook", true, `janela ${start}→${end}`, upserted);
    return NextResponse.json({ ok: true, upserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun("pop-webhook", false, msg);
    // 200 na mesma: a fonte de verdade é a API; um retry do Paylands não ajuda.
    return NextResponse.json({ ok: false, error: "sync falhou; cron diário recupera" });
  }
}
