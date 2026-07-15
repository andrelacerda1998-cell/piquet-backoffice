import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { paylandsConfigured, fetchPopTransactions, paylandsDate } from "../../_lib/paylands";

/**
 * Cron diário (vercel.json → 06:30 UTC): sincroniza as transações do Payshop
 * Online Payments (Paylands) para `pop_transactions`. Reprocessa os últimos
 * 7 dias — apanha transações novas e mudanças de estado (ex.: reembolsos).
 * Idempotente: upsert por transaction_uuid.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }
  if (!paylandsConfigured()) {
    return NextResponse.json({ ok: true, skipped: "PAYLANDS_API_KEY não configurada" });
  }

  // Janela por defeito: últimos 7 dias. Para backfill histórico, aceita
  // ?start=YYYYMMDDHHmm&end=YYYYMMDDHHmm (máx. 3 meses — limite da API).
  const url = new URL(req.url);
  const qsStart = url.searchParams.get("start");
  const qsEnd = url.searchParams.get("end");
  const valid = (s: string | null): s is string => Boolean(s && /^\d{12}$/.test(s));
  const end = valid(qsEnd) ? qsEnd : paylandsDate(new Date());
  const start = valid(qsStart) ? qsStart : paylandsDate(new Date(Date.now() - 7 * 86_400_000));

  try {
    const txs = await fetchPopTransactions(start, end);
    if (txs.length) {
      const rows = txs.map((t) => ({
        transaction_uuid: t.transactionUuid, order_uuid: t.orderUuid,
        customer_ext_id: t.customerExtId, amount_cents: t.amountCents,
        status: t.status, type: t.type, service: t.service,
        created: t.created, updated_at: t.updatedAt,
      }));
      const { error } = await supabaseAdmin()
        .from("pop_transactions")
        .upsert(rows, { onConflict: "transaction_uuid" });
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, window: `${start}→${end}`, upserted: txs.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
