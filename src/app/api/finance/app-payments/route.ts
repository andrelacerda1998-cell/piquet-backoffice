import { supabaseAdmin } from "@/lib/supabase/server";
import { paymentMethodOf, type PaymentState } from "../../_lib/paylands";
import { agruparPagamentos, mesDe } from "../../_lib/gmv";
import { apiOk, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";

/**
 * O pedido de cada pagamento (backend: GET /v1/admin/payment-orders?uuids=…),
 * de 50 em 50 para o endereço não crescer demais. Um backend sem a rota deixa
 * os pagamentos sem pedido -- e o ecrã sem o "Abrir pedido" -- sem erro.
 */
async function pedidosDosPagamentos(uuids: string[]): Promise<Map<string, string>> {
  const pedidoDe = new Map<string, string>();
  if (!LARAVEL_ADMIN_ENABLED) return pedidoDe;
  for (let i = 0; i < uuids.length; i += 50) {
    const lote = uuids.slice(i, i + 50);
    try {
      const r = await laravelAdminRequest<Array<{ uuid: string; service_id: number | null }> | { items?: Array<{ uuid: string; service_id: number | null }> }>(
        `/v1/admin/payment-orders?uuids=${lote.map(encodeURIComponent).join(",")}`,
      );
      for (const o of Array.isArray(r) ? r : r.items ?? []) if (o.service_id) pedidoDe.set(o.uuid, String(o.service_id));
    } catch {
      return pedidoDe;
    }
  }
  return pedidoDe;
}

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

export const GET = withStaff(async (req) => {
  // Os pagamentos de teste (< 10 €) ficam escondidos por omissão: só a pedido (?testes=1).
  const comTestes = new URL(req.url).searchParams.get("testes") === "1";
  const { data, error } = await supabaseAdmin()
    .from("pop_transactions")
    .select("transaction_uuid, order_uuid, customer_ext_id, amount_cents, status, type, service, source_type, created")
    .order("created", { ascending: false })
    ;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  /*
    O agrupamento, o valor, o estado e a data são os do GMV (_lib/gmv.ts):
    o "cobrado" deste ecrã é, por construção, o mesmo GMV da Visão Geral.
  */
  const payments = agruparPagamentos(rows).map((p) => {
    const txs = p.transacoes;
    const withBrand = txs.find((t) => t.source_type) ?? txs[0];
    const method = paymentMethodOf(withBrand.service, withBrand.source_type);
    const refunded = p.reembolsadoCents;
    return {
      id: p.id,
      customer: p.cliente,
      amountCents: p.valorCents,
      refundedCents: refunded,
      state: p.estado,
      method: method.label,
      methodKind: method.kind,
      created: p.quando,
      attempts: txs.length,
      isTest: p.teste,
    };
  }).sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));

  // KPIs, série mensal e métodos contam SÓ pagamentos reais; os de teste
  // (confirmados pelo André como tráfego do programador) ficam visíveis na
  // lista, marcados, mas fora de qualquer total — incluindo o GMV.
  const real = payments.filter((p) => !p.isTest);
  const testCount = payments.length - real.length;

  // O cobrado é líquido do que se devolveu em reembolsos parciais (como o GMV).
  const sumOf = (st: PaymentState) => real.filter((p) => p.state === st)
    .reduce((s, p) => s + p.amountCents - (st === "pago" ? p.refundedCents : 0), 0);
  const cntOf = (st: PaymentState) => real.filter((p) => p.state === st).length;

  const pagoCents = sumOf("pago");
  const cativadoCents = sumOf("cativado");
  const moving = cntOf("pago") + cntOf("cativado");

  // Volume mensal: cobrado vs cativado (só pagamentos reais — o cobrado é o GMV).
  const byMonth = new Map<string, { cobrado: number; cativado: number }>();
  for (const p of real) {
    if (p.state !== "pago" && p.state !== "cativado") continue;
    // Mês de Lisboa, como o GMV.
    const key = p.created ? mesDe(p.created) : "";
    if (!key) continue;
    const m = byMonth.get(key) ?? { cobrado: 0, cativado: 0 };
    if (p.state === "pago") m.cobrado += p.amountCents - p.refundedCents; else m.cativado += p.amountCents;
    byMonth.set(key, m);
  }

  // Repartição por método (só pagamentos reais onde houve dinheiro a mexer).
  const byMethod = new Map<string, { count: number; volume: number }>();
  for (const p of real) {
    if (p.state === "recusado") continue;
    const m = byMethod.get(p.method) ?? { count: 0, volume: 0 };
    m.count++; m.volume += p.amountCents;
    byMethod.set(p.method, m);
  }

  // A lista: os reais (e os de teste, se pedidos), até 200, cada um com o seu pedido.
  const lista = (comTestes ? payments : real).slice(0, 200);
  const pedidoDe = await pedidosDosPagamentos(lista.map((p) => p.id));

  return apiOk({
    kpis: {
      pagoCents,
      pagoCount: cntOf("pago"),
      cativadoCents,
      cativadoCount: cntOf("cativado"),
      canceladoCount: cntOf("cancelado"),
      recusadoCount: cntOf("recusado"),
      reembolsadoCents: real.reduce((s, p) => s + p.refundedCents, 0),
      avgTicketCents: moving ? Math.round((pagoCents + cativadoCents) / moving) : 0,
      successRate: real.length ? (moving / real.length) * 100 : 0,
      testCount,
    },
    monthly: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, cobrado: v.cobrado / 100, cativado: v.cativado / 100 })),
    byMethod: [...byMethod.entries()].map(([name, v]) => ({ name, count: v.count, volume: Math.round(v.volume) / 100 })),
    payments: lista.map((p) => ({
      id: p.id, customer: p.customer, amount: p.amountCents / 100,
      refunded: p.refundedCents / 100, state: p.state, method: p.method,
      methodKind: p.methodKind, created: p.created, attempts: p.attempts,
      isTest: p.isTest, servicoId: pedidoDe.get(p.id) ?? null,
    })),
  });
});
