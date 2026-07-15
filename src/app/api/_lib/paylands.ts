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
  created: string | null;
  updatedAt: string | null;
}

interface RawTx {
  transactionUUID?: string; orderUUID?: string; customerExtId?: string;
  amount?: number; status?: string; type?: string; serviceUUID?: string;
  created?: string; updated_at?: string;
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
    // A API devolve "YYYY-MM-DD HH:mm:ss" (hora de Lisboa) — ISO-ficar simples.
    created: r.created ? r.created.replace(" ", "T") : null,
    updatedAt: r.updated_at ? r.updated_at.replace(" ", "T") : null,
  };
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
