import type { VendorDocument, VendorDocumentStatus } from "@/services/vendorDocumentsService";

/**
 * Documentos obrigatórios de um técnico (KYC). São estes três que decidem se
 * alguém pode trabalhar — por isso vão a colunas próprias na lista de técnicos,
 * em vez de um "documentação ✓/⚠️" que não diz o que falta.
 */
export const REQUIRED_DOCS = [
  { key: "cc", label: "Cartão de Cidadão", short: "Cartão de Cidadão" },
  { key: "criminal", label: "Registo Criminal", short: "Registo Criminal" },
  { key: "atividade", label: "Declaração de início de atividade", short: "Início de atividade" },
] as const;

export type RequiredDocKey = (typeof REQUIRED_DOCS)[number]["key"];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Classifica o `document_type` que vem do Laravel num dos obrigatórios.
 * Tolerante às variações de escrita (com/sem acentos, "CC", "Certidão de
 * Registo Criminal", "Declaração de Início de Atividade das Finanças", …).
 * Devolve `null` para documentos que não são nenhum dos três.
 */
export function classifyDocument(documentType: string | null | undefined): RequiredDocKey | null {
  const t = norm(documentType ?? "");
  if (!t) return null;
  if (/(cartao|carta).*(cidadao)|^cc$|\bcc\b|cidadao|bilhete de identidade|\bbi\b|identificacao/.test(t)) return "cc";
  if (/criminal/.test(t)) return "criminal";
  if (/(inicio|comeco).*(atividade)|atividade|financas|irs|declaracao de inicio/.test(t)) return "atividade";
  return null;
}

/** Estado de um documento obrigatório para um técnico. */
export type DocState = "aprovado" | "pendente" | "recusado" | "em_falta";

const RANK: Record<DocState, number> = { aprovado: 3, pendente: 2, recusado: 1, em_falta: 0 };

function toState(status: VendorDocumentStatus): DocState {
  return status === "approved" ? "aprovado" : status === "declined" ? "recusado" : "pendente";
}

/**
 * Índice `vendor_id → { cc, criminal, atividade }` com o estado de cada
 * documento obrigatório. Quando um técnico reenvia o mesmo documento, vale o
 * estado mais avançado (aprovado > pendente > recusado).
 */
export function indexDocsByVendor(docs: VendorDocument[]): Map<number, Record<RequiredDocKey, DocState>> {
  const empty = (): Record<RequiredDocKey, DocState> =>
    ({ cc: "em_falta", criminal: "em_falta", atividade: "em_falta" });
  const map = new Map<number, Record<RequiredDocKey, DocState>>();
  for (const d of docs) {
    const key = classifyDocument(d.document_type);
    if (!key) continue;
    const cur = map.get(d.vendor_id) ?? empty();
    const next = toState(d.status);
    if (RANK[next] > RANK[cur[key]]) cur[key] = next;
    map.set(d.vendor_id, cur);
  }
  return map;
}

/** Quantos dos obrigatórios ainda não estão aprovados. */
export function missingCount(states: Record<RequiredDocKey, DocState> | undefined): number {
  if (!states) return REQUIRED_DOCS.length;
  return REQUIRED_DOCS.filter((d) => states[d.key] !== "aprovado").length;
}

/** Aparência de cada estado na tabela (símbolo + tom + descrição). */
export const DOC_STATE_UI: Record<DocState, { symbol: string; tone: string; label: string }> = {
  aprovado: { symbol: "✓", tone: "text-success", label: "Aprovado" },
  pendente: { symbol: "•", tone: "text-warning", label: "Por validar" },
  recusado: { symbol: "✗", tone: "text-danger", label: "Recusado" },
  em_falta: { symbol: "—", tone: "text-text-muted", label: "Não entregue" },
};
