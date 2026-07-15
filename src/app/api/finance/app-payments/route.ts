import { supabaseAdmin } from "@/lib/supabase/server";
import { paymentMethodOf, derivePaymentState, type PaymentState } from "../../_lib/paylands";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/finance/app-payments — pagamentos reais da app (Payshop Online
 * Payments / Paylands), agregados **por encomenda** a partir de `pop_transactions`.
 *
 * Porquê por encomenda: a app usa pagamentos diferidos, logo cada pagamento
 * gera VÁRIAS transações (cativação → confirmação/cancelamento/reembolso).
 * Listar transações cruas mostrava a mesma compra em várias linhas e sem
 * estado final. Aqui derivamos um estado por pagamento.
 */

interface Row {
  transaction_uuid: string; order_uuid: string; customer_ext_id: string;
  amount_cents: number; status: string; type: string; service: string;
  source_type: string; created: string | null;
}

const CHARGE_TYPES = ["CONFIRMATION", "PURCHASE", "CAPTURE", "PAYMENT"];
const HOLD_TYPES = ["DEFERRED", "AUTHORIZATION"];

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("pop_transactions")
    .select("transaction_uuid, order_uuid, customer_ext_id, amount_cents, status, type, service, source_type, created")
    .order("created", { ascending: false })
    .limit(10000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  // Agrupa por encomenda (fallback: a própria transação, se não houver order).
  const byOrder = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.order_uuid || r.transaction_uuid;
    (byOrder.get(k) ?? byOrder.set(k, []).get(k)!).push(r);
  }

  const payments = [...byOrder.entries()].map(([orderId, txs]) => {
    const state = derivePaymentState(txs);
    const pick = (types: string[]) =>
      txs.find((t) => t.status === "SUCCESS" && types.includes(t.type)) ??
      txs.find((t) => types.includes(t.type));
    // Valor do pagamento: o confirmado manda; senão o cativado; senão o 1.º.
    const main = pick(CHARGE_TYPES) ?? pick(HOLD_TYPES) ?? txs[0];
    const withBrand = txs.find((t) => t.source_type) ?? main;
    const method = paymentMethodOf(withBrand.service, withBrand.source_type);
    const created = txs.map((t) => t.created).filter(Boolean).sort()[0] ?? null;
    const refunded = txs.filter((t) => t.status === "SUCCESS" && (t.type === "REFUND" || t.type === "REVERSAL"))
      .reduce((s, t) => s + t.amount_cents, 0);
    return {
      id: orderId,
      customer: main.customer_ext_id,
      amountCents: main.amount_cents,
      refundedCents: refunded,
      state,
      method: method.label,
      methodKind: method.kind,
      created,
      attempts: txs.length,
    };
  }).sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));

  const sumOf = (st: PaymentState) => payments.filter((p) => p.state === st).reduce((s, p) => s + p.amountCents, 0);
  const cntOf = (st: PaymentState) => payments.filter((p) => p.state === st).length;

  const pagoCents = sumOf("pago");
  const cativadoCents = sumOf("cativado");
  const moving = cntOf("pago") + cntOf("cativado");

  // Volume mensal: cobrado vs cativado.
  const byMonth = new Map<string, { cobrado: number; cativado: number }>();
  for (const p of payments) {
    if (p.state !== "pago" && p.state !== "cativado") continue;
    const key = (p.created ?? "").slice(0, 7);
    if (!key) continue;
    const m = byMonth.get(key) ?? { cobrado: 0, cativado: 0 };
    if (p.state === "pago") m.cobrado += p.amountCents; else m.cativado += p.amountCents;
    byMonth.set(key, m);
  }

  // Repartição por método (só pagamentos onde houve dinheiro a mexer).
  const byMethod = new Map<string, { count: number; volume: number }>();
  for (const p of payments) {
    if (p.state === "recusado") continue;
    const m = byMethod.get(p.method) ?? { count: 0, volume: 0 };
    m.count++; m.volume += p.amountCents;
    byMethod.set(p.method, m);
  }

  return apiOk({
    kpis: {
      pagoCents,
      pagoCount: cntOf("pago"),
      cativadoCents,
      cativadoCount: cntOf("cativado"),
      canceladoCount: cntOf("cancelado"),
      recusadoCount: cntOf("recusado"),
      reembolsadoCents: payments.reduce((s, p) => s + p.refundedCents, 0),
      avgTicketCents: moving ? Math.round((pagoCents + cativadoCents) / moving) : 0,
      successRate: payments.length ? (moving / payments.length) * 100 : 0,
    },
    monthly: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, cobrado: v.cobrado / 100, cativado: v.cativado / 100 })),
    byMethod: [...byMethod.entries()].map(([name, v]) => ({ name, count: v.count, volume: Math.round(v.volume) / 100 })),
    payments: payments.slice(0, 200).map((p) => ({
      id: p.id, customer: p.customer, amount: p.amountCents / 100,
      refunded: p.refundedCents / 100, state: p.state, method: p.method,
      methodKind: p.methodKind, created: p.created, attempts: p.attempts,
    })),
  });
});
