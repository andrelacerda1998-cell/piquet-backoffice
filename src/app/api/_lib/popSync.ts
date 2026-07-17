import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchPopTransactions } from "./paylands";

/**
 * Sincroniza as transações Paylands → `pop_transactions` numa janela de datas.
 * Partilhado pelo cron diário e pelo webhook (padrão "re-fetch": o webhook não
 * confia no payload recebido — vai buscar a verdade à API). Idempotente:
 * upsert por transaction_uuid.
 */
export async function syncPopTransactions(start: string, end: string): Promise<number> {
  const txs = await fetchPopTransactions(start, end);
  if (txs.length) {
    const rows = txs.map((t) => ({
      transaction_uuid: t.transactionUuid, order_uuid: t.orderUuid,
      customer_ext_id: t.customerExtId, amount_cents: t.amountCents,
      status: t.status, type: t.type, service: t.service, source_type: t.sourceType,
      created: t.created, updated_at: t.updatedAt,
    }));
    const { error } = await supabaseAdmin()
      .from("pop_transactions")
      .upsert(rows, { onConflict: "transaction_uuid" });
    if (error) throw new Error(error.message);
  }
  return txs.length;
}
