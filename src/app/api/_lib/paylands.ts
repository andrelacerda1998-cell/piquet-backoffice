import "server-only";

/**
 * Payshop Online Payments (plataforma Paylands / PaynoPain).
 *
 * Lê as transações da app via `GET https://api.paylands.com/v1/orders`.
 * Autenticação: HTTP Basic com a API key como username e password vazia
 * (validado ao vivo). A API limita cada consulta a 3 meses e 10 000 resultados.
 *
 * Env:
 * - PAYLANDS_API_KEY  (Chave da API principal do backoffice POP)
 */

const BASE = "https://api.paylands.com/v1";

// serviceUUID → nome legível (do credentials.txt do backoffice POP).
const SERVICE_NAMES: Record<string, string> = {
  "5C48BE5D-CDF5-4AED-AB86-283A02B6A0FC": "SIBS",
  "C12AADE7-6125-45D9-8470-D23DC6AFCD47": "CREDORAX",
  "4B2FEC33-0EFB-11F0-8D52-02ACC42E513B": "PAYSHOP",
};

export function paylandsConfigured(): boolean {
  return Boolean(process.env.PAYLANDS_API_KEY);
}

export interface PopTransaction {
  transactionUuid: string;
  orderUuid: string;
  customerExtId: string;
  amountCents: number;
  status: string;
  type: string;
  service: string;
  /** Marca do cartão (VISA/MASTERCARD). Vazio em MB Way/referências. */
  sourceType: string;
  created: string | null;
  updatedAt: string | null;
}

interface RawTx {
  transactionUUID?: string; orderUUID?: string; customerExtId?: string;
  amount?: number; status?: string; type?: string; serviceUUID?: string;
  sourceType?: string | null; created?: string; updated_at?: string;
}

/** Formata Date para o formato YYYYMMDDHHmm que a API exige. */
export function paylandsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

/** Converte uma transação crua da API no formato da tabela (exportado p/ testes). */
export function mapPopTransaction(r: RawTx): PopTransaction {
  return {
    transactionUuid: r.transactionUUID ?? "",
    orderUuid: r.orderUUID ?? "",
    customerExtId: r.customerExtId ?? "",
    amountCents: Number(r.amount) || 0,
    status: r.status ?? "",
    type: r.type ?? "",
    service: SERVICE_NAMES[r.serviceUUID ?? ""] ?? (r.serviceUUID ?? ""),
    sourceType: r.sourceType ?? "",
    // A API devolve "YYYY-MM-DD HH:mm:ss" (hora de Lisboa) — ISO-ficar simples.
    created: r.created ? r.created.replace(" ", "T") : null,
    updatedAt: r.updated_at ? r.updated_at.replace(" ", "T") : null,
  };
}

/**
 * Método de pagamento legível, a partir do serviço + marca do cartão.
 *
 * Como distinguir (confirmado nos dados reais): o Credorax processa os cartões
 * e traz `sourceType` (VISA/MASTERCARD); a SIBS processa MB Way e não traz
 * `sourceType`; o Payshop são referências pagas em agente.
 */
export function paymentMethodOf(service: string, sourceType: string): { kind: "cartao" | "mbway" | "referencia" | "outro"; label: string } {
  const brand = (sourceType || "").toUpperCase();
  if (brand === "VISA") return { kind: "cartao", label: "Visa" };
  if (brand === "MASTERCARD") return { kind: "cartao", label: "Mastercard" };
  if (brand) return { kind: "cartao", label: sourceType };
  if (service === "SIBS") return { kind: "mbway", label: "MB Way" };
  if (service === "PAYSHOP") return { kind: "referencia", label: "Referência Payshop" };
  if (service === "CREDORAX") return { kind: "cartao", label: "Cartão" };
  return { kind: "outro", label: service || "—" };
}

/**
 * Transações entre `start` e `end` (máx. 3 meses por chamada — responsabilidade
 * do chamador). Segue a paginação via `next_offset`.
 */
export async function fetchPopTransactions(start: string, end: string): Promise<PopTransaction[]> {
  const auth = "Basic " + Buffer.from(`${process.env.PAYLANDS_API_KEY}:`).toString("base64");
  const out: PopTransaction[] = [];
  let offset = 0;
  for (let guard = 0; guard < 20; guard++) {
    const params = new URLSearchParams({ start, end, limit: "10000", offset: String(offset) });
    const res = await fetch(`${BASE}/orders?${params}`, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Paylands ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { code: number; transactions?: RawTx[]; next_offset?: number; count?: number };
    if (json.code !== 200) throw new Error(`Paylands code ${json.code}`);
    const batch = (json.transactions ?? []).map(mapPopTransaction);
    out.push(...batch);
    // Sem next_offset ou lote vazio → fim.
    if (!json.next_offset || batch.length === 0) break;
    offset = json.next_offset;
  }
  return out;
}

export type PaymentState = "pago" | "cativado" | "cancelado" | "reembolsado" | "recusado";

/**
 * Estado final de um pagamento, a partir das suas transações.
 *
 * A app usa pagamentos diferidos: cada pagamento gera várias transações
 * (cativação → confirmação/cancelamento/reembolso). O que aconteceu por último
 * no ciclo de vida manda — daí a ordem de precedência.
 */
export function derivePaymentState(txs: Array<{ type: string; status: string }>): PaymentState {
  const okOf = (t: string) => txs.some((x) => x.status === "SUCCESS" && x.type === t);
  if (okOf("REFUND") || okOf("REVERSAL")) return "reembolsado";
  if (okOf("CANCELLATION")) return "cancelado";
  if (okOf("CONFIRMATION") || okOf("PURCHASE") || okOf("CAPTURE") || okOf("PAYMENT")) return "pago";
  if (okOf("DEFERRED") || okOf("AUTHORIZATION")) return "cativado";
  return "recusado";
}
