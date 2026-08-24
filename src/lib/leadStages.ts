/**
 * Estados do funil do CRM — FONTE ÚNICA.
 *
 * Existiam três listas separadas: uma na leitura (`GET /api/marketing/leads`),
 * outra na escrita (`PUT /api/marketing/leads/[id]`) e outra na interface.
 * Ao acrescentar "reembolsado" atualizaram-se só duas, e o resultado foi o
 * pior tipo de falha: a gravação corria bem, mas a leitura não reconhecia o
 * estado e devolvia-o como "nao_iniciado" — o utilizador escolhia
 * "Reembolsado", via "Novo" a seguir, e nada no ecrã explicava porquê.
 *
 * Qualquer estado novo acrescenta-se AQUI e passa a valer nos três sítios.
 */
export const LEAD_STAGE_IDS = [
  "nao_iniciado",
  "aguarda_resposta",
  "orcamento_enviado",
  "orcamento_aceite",
  "concluido",
  "recusado",
  "reembolsado",
] as const;

export type LeadStageId = (typeof LEAD_STAGE_IDS)[number];

/** Estados antigos de marketing, de linhas anteriores ao CRM atual. */
export const LEAD_STAGE_LEGACY: Record<string, LeadStageId> = {
  novo: "nao_iniciado",
  contactado: "orcamento_enviado",
  qualificado: "orcamento_aceite",
  convertido: "concluido",
  perdido: "recusado",
};

export function isLeadStage(v: unknown): v is LeadStageId {
  return typeof v === "string" && (LEAD_STAGE_IDS as readonly string[]).includes(v);
}

/**
 * Normaliza o que está na base de dados para um estado do funil.
 * Só cai em "nao_iniciado" quando o valor é mesmo desconhecido.
 */
export function normalizeLeadStage(raw: string | null | undefined): LeadStageId {
  if (isLeadStage(raw)) return raw;
  return LEAD_STAGE_LEGACY[String(raw ?? "")] ?? "nao_iniciado";
}

/** Estados em que o pedido já não pode gerar receita. */
export const LEAD_STAGES_SEM_RECEITA: LeadStageId[] = ["recusado", "reembolsado"];
