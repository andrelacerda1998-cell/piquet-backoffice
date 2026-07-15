import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/finance/app-payments — pagamentos reais da app (Payshop Online
 * Payments), agregados da tabela `pop_transactions`.
 *
 * Devolve KPIs, volume mensal, repartição por serviço e as transações mais
 * recentes. `transactions: []` enquanto a tabela estiver vazia.
 */

interface Row {
  transaction_uuid: string; order_uuid: string; customer_ext_id: string;
  amount_cents: number; status: string; type: string; service: string;
  created: string | null;
}

// A app usa pagamentos DIFERIDOS: `DEFERRED` = cativação na reserva,
// `CONFIRMATION` = cobrança efetiva no fim do serviço, `CANCELLATION` =
// libertação da cativação, `REFUND` = devolução de dinheiro já cobrado.
const CHARGED_TYPES = new Set(["CONFIRMATION", "PURCHASE", "CAPTURE", "PAYMENT", "TRANSACTION"]);
const HOLD_TYPES = new Set(["DEFERRED", "AUTHORIZATION"]);
const REFUND_TYPES = new Set(["REFUND", "REVERSAL"]);

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("pop_transactions")
    .select("transaction_uuid, order_uuid, customer_ext_id, amount_cents, status, type, service, created")
    .order("created", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  const ok = rows.filter((r) => r.status === "SUCCESS");
  const charged = ok.filter((r) => CHARGED_TYPES.has(r.type));
  const holds = ok.filter((r) => HOLD_TYPES.has(r.type));
  const refunds = ok.filter((r) => REFUND_TYPES.has(r.type));
  const refused = rows.filter((r) => r.status === "REFUSED");

  const sum = (a: Row[]) => a.reduce((s, r) => s + (r.amount_cents || 0), 0);
  const moneyMoving = charged.length + holds.length;

  // Volume mensal: cativado vs cobrado, lado a lado.
  const byMonth = new Map<string, { cativado: number; cobrado: number }>();
  for (const r of [...holds, ...charged]) {
    const key = (r.created ?? "").slice(0, 7);
    if (!key) continue;
    const m = byMonth.get(key) ?? { cativado: 0, cobrado: 0 };
    if (CHARGED_TYPES.has(r.type)) m.cobrado += r.amount_cents;
    else m.cativado += r.amount_cents;
    byMonth.set(key, m);
  }
  const monthly = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ name: key, cativado: Math.round(v.cativado) / 100, cobrado: Math.round(v.cobrado) / 100 }));

  const byService = new Map<string, { count: number; volume: number }>();
  for (const r of [...holds, ...charged]) {
    const s = byService.get(r.service) ?? { count: 0, volume: 0 };
    s.count++; s.volume += r.amount_cents;
    byService.set(r.service, s);
  }

  return apiOk({
    kpis: {
      chargedCents: sum(charged),
      chargedCount: charged.length,
      heldCents: sum(holds),
      heldCount: holds.length,
      refused: refused.length,
      refundedCents: sum(refunds),
      avgTicketCents: moneyMoving ? Math.round((sum(charged) + sum(holds)) / moneyMoving) : 0,
      successRate: moneyMoving + refused.length
        ? (moneyMoving / (moneyMoving + refused.length)) * 100 : 0,
    },
    monthly,
    byService: [...byService.entries()].map(([name, v]) => ({
      name: name || "—", count: v.count, volume: Math.round(v.volume) / 100,
    })),
    transactions: rows.slice(0, 100).map((r) => ({
      id: r.transaction_uuid, order: r.order_uuid, customer: r.customer_ext_id,
      amount: (r.amount_cents || 0) / 100, status: r.status, type: r.type,
      service: r.service, created: r.created,
    })),
  });
});
