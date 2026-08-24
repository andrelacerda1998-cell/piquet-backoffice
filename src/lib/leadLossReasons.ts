/**
 * Motivos de perda de um pedido no CRM.
 *
 * 23 das primeiras 26 leads (88%) acabaram em recusado/perdido e o backoffice
 * não guardava porquê — logo, não havia como saber se o negócio se perde no
 * preço, na demora a responder, ou por não haver técnico na zona. Cada uma
 * dessas causas exige uma decisão diferente, e sem o motivo qualquer decisão
 * sobre o funil é palpite.
 *
 * A lista é curta de propósito: uma caixa de texto livre parece mais completa
 * mas não se consegue contar, e é isso que interessa aqui. Há "Outro" com
 * detalhe livre para o que não encaixa.
 */
export const LEAD_LOSS_REASONS = [
  { id: "preco", label: "Preço", hint: "Achou caro ou encontrou mais barato" },
  { id: "sem_tecnico", label: "Sem técnico disponível", hint: "Não havia quem fizesse, ou não na zona" },
  { id: "sem_resposta", label: "Cliente não respondeu", hint: "Contactámos e nunca mais deu sinal" },
  { id: "demora", label: "Demorámos a responder", hint: "Perdido por nossa causa — o mais importante de registar" },
  { id: "resolveu_sozinho", label: "Resolveu de outra forma", hint: "Já não precisava, ou tratou disso sozinho" },
  { id: "fora_ambito", label: "Fora do âmbito", hint: "Serviço que a Piquet não faz" },
  { id: "duplicado", label: "Duplicado / engano", hint: "Pedido repetido ou submetido por engano" },
  { id: "outro", label: "Outro", hint: "Escrever o motivo à mão" },
] as const;

export type LeadLossReasonId = (typeof LEAD_LOSS_REASONS)[number]["id"];

export function isLossReason(v: unknown): v is LeadLossReasonId {
  return typeof v === "string" && LEAD_LOSS_REASONS.some((r) => r.id === v);
}

export function lossReasonLabel(id: string | null | undefined): string {
  return LEAD_LOSS_REASONS.find((r) => r.id === id)?.label ?? "";
}

/** Estados em que faz sentido perguntar o motivo. */
export const ESTADOS_QUE_PEDEM_MOTIVO = ["recusado", "reembolsado"];

export function pedeMotivo(estado: string): boolean {
  return ESTADOS_QUE_PEDEM_MOTIVO.includes(estado);
}

export interface ContagemMotivo {
  id: LeadLossReasonId | "sem_motivo";
  label: string;
  total: number;
  /** Percentagem do total de perdidas, arredondada. */
  percentagem: number;
}

/**
 * Conta perdas por motivo, do mais frequente para o menos. Inclui as que não
 * têm motivo registado — esconder essas daria a ilusão de que se sabe mais do
 * que se sabe (hoje seriam 100% delas).
 */
export function contarMotivos(
  leads: Array<{ stage: string; loss_reason?: string | null }>,
): ContagemMotivo[] {
  const perdidas = leads.filter((l) => pedeMotivo(l.stage));
  if (perdidas.length === 0) return [];

  const contagem = new Map<string, number>();
  for (const l of perdidas) {
    const chave = isLossReason(l.loss_reason) ? l.loss_reason : "sem_motivo";
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([id, total]) => ({
      id: id as LeadLossReasonId | "sem_motivo",
      label: id === "sem_motivo" ? "Sem motivo registado" : lossReasonLabel(id),
      total,
      percentagem: Math.round((total / perdidas.length) * 100),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}
