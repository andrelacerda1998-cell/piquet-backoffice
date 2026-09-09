/**
 * Estados de um pedido — FONTE ÚNICA.
 *
 * Existiam três listas separadas: uma na leitura (`GET /api/marketing/leads`),
 * outra na escrita (`PUT /api/marketing/leads/[id]`) e outra na interface.
 * Ao acrescentar um estado atualizavam-se só duas, e o resultado foi o pior
 * tipo de falha: a gravação corria bem, mas a leitura não reconhecia o estado
 * e devolvia-o como "novo" — escolhia-se um estado, via-se outro a seguir, e
 * nada no ecrã explicava porquê.
 *
 * Qualquer estado novo acrescenta-se AQUI e passa a valer nos três sítios.
 *
 * ---
 *
 * A lista de cinco é de 08/09/2026 e descreve o que acontece mesmo:
 * chega um pedido → pergunta-se a técnicos → há técnico → está feito.
 *
 * A anterior tinha "Aguarda resposta" e "Orçamento aceite", desenhados para um
 * negócio onde se liga ao cliente, se dá um preço e se fecha. Aqui há um passo
 * de despacho pelo meio, e como nenhum estado o descrevia, atribuir um técnico
 * escrevia "Orçamento aceite" — que não era verdade e ninguém percebia.
 *
 * Estes avançam sozinhos: difundir põe em "À procura de técnico", atribuir põe
 * em "Com técnico". Um funil mantido à mão só está certo enquanto alguém se
 * lembrar de o manter.
 *
 * ---
 *
 * "Agendado" e "Em execução" entraram a 09/09/2026. Entre "o técnico aceitou" e
 * "está pago" acontece o serviço, e o backoffice não sabia nada disso: não
 * havia forma de responder a "o que está a acontecer agora na Piquet?".
 * Marcar como concluído exigia já ter os valores, o que fazia do estado final
 * um acto de contabilidade e não o fim de um trabalho.
 */
export const LEAD_STAGE_IDS = [
  "novo",
  "a_procurar",
  "com_tecnico",
  "agendado",
  "em_execucao",
  "concluido",
  "perdido",
] as const;

export type LeadStageId = (typeof LEAD_STAGE_IDS)[number];

/**
 * Estados antigos → estados de agora.
 *
 * Fica para sempre: as linhas na base de dados foram convertidas, mas um
 * pedido gravado por uma versão anterior da app, ou reposto de uma cópia de
 * segurança, ainda chega com o nome antigo. Sem isto cairia em "novo" e
 * apagava o trabalho já feito.
 */
export const LEAD_STAGE_LEGACY: Record<string, LeadStageId> = {
  // Primeira geração (marketing). "novo" e "perdido" já coincidem com os
  // nomes de agora e por isso não precisam de tradução.
  contactado: "a_procurar",
  qualificado: "com_tecnico",
  convertido: "concluido",
  // Segunda geração (CRM).
  nao_iniciado: "novo",
  orcamento_enviado: "a_procurar",
  aguarda_resposta: "a_procurar",
  orcamento_aceite: "com_tecnico",
  recusado: "perdido",
  /*
    O reembolso deixou de ser um estado do pedido: é um acontecimento
    financeiro, tratado no Financeiro, onde estão os botões que devolvem o
    dinheiro. Aqui só interessa que o pedido não deu receita — que é o que
    "perdido" já diz.
  */
  reembolsado: "perdido",
};

export function isLeadStage(v: unknown): v is LeadStageId {
  return typeof v === "string" && (LEAD_STAGE_IDS as readonly string[]).includes(v);
}

/**
 * Normaliza o que está na base de dados para um estado.
 * Só cai em "novo" quando o valor é mesmo desconhecido.
 */
export function normalizeLeadStage(raw: string | null | undefined): LeadStageId {
  if (isLeadStage(raw)) return raw;
  return LEAD_STAGE_LEGACY[String(raw ?? "")] ?? "novo";
}

/** Estados em que o pedido já não pode gerar receita. */
export const LEAD_STAGES_SEM_RECEITA: LeadStageId[] = ["perdido"];
