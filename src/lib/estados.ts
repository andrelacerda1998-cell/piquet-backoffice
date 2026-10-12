import type { ServiceStatus } from "@/types";
import type { StatusTone } from "@/lib/formatters";

/**
 * Os estados de um pedido como a equipa os lê: seis, em vez dos dezoito
 * técnicos. Cada estado técnico pertence a exatamente um (o teste garante-o).
 *
 * "Precisa de atenção" não é um sétimo estado: é um sinal por cima de um
 * estado. Um pagamento por capturar é um serviço concluído com dinheiro por
 * entrar; uma reclamação é um serviço concluído com um cliente insatisfeito.
 */
export interface EstadoSimples {
  id: string;
  label: string;
  statuses: ServiceStatus[];
  /**
   * A cor diz o que fazer, não de que departamento é: âmbar para estar atento,
   * azul para a andar, verde para tudo bem, cinzento para terminado. O
   * vermelho fica para o sinal "precisa de atenção", por cima de qualquer um.
   */
  tom: StatusTone;
}

export const ESTADOS_SIMPLES: EstadoSimples[] = [
  { id: "procura", label: "À procura de técnico", statuses: ["pedido_recebido", "a_procurar_tecnico"], tom: "warning" },
  { id: "espera", label: "À espera", statuses: ["a_aguardar_orcamento", "orcamento_enviado", "a_aguardar_pagamento"], tom: "warning" },
  { id: "agendado", label: "Agendado", statuses: ["tecnico_encontrado", "pago", "agendado"], tom: "info" },
  { id: "curso", label: "Em curso", statuses: ["em_execucao", "a_aguardar_confirmacao"], tom: "info" },
  { id: "concluido", label: "Concluído", statuses: ["concluido", "pagamento_por_capturar", "em_reclamacao"], tom: "success" },
  {
    id: "cancelado", label: "Cancelado",
    statuses: ["cancelado_cliente", "cancelado_tecnico", "sem_tecnico_disponivel", "reembolsado", "arquivado"],
    tom: "neutral",
  },
];

/**
 * Os estados técnicos que pedem alguém da equipa, seja qual for o estado
 * simples. O personalizado à espera da Piquet (a_aguardar_orcamento) só anda
 * quando alguém o despacha.
 */
export const PRECISA_DE_ATENCAO: ServiceStatus[] = ["pagamento_por_capturar", "em_reclamacao", "a_aguardar_orcamento"];

export function precisaDeAtencao(status: ServiceStatus): boolean {
  return PRECISA_DE_ATENCAO.includes(status);
}

/** Os que precisam de atenção primeiro; o resto fica pela ordem em que vinha. */
export function atencaoPrimeiro<T extends { status: ServiceStatus }>(lista: readonly T[]): T[] {
  return [...lista.filter((s) => precisaDeAtencao(s.status)), ...lista.filter((s) => !precisaDeAtencao(s.status))];
}

/** O estado simples a que pertence um estado técnico (todos pertencem a um). */
export function estadoSimplesDe(status: ServiceStatus): EstadoSimples | null {
  return ESTADOS_SIMPLES.find((e) => e.statuses.includes(status)) ?? null;
}

/*
  "À espera" sozinho não diz de quem: a frase completa diz. O mesmo para
  "Cancelado", que por baixo pode ser o cliente, o técnico ou não ter havido
  ninguém. É o que a equipa precisa de ler para saber se tem de agir.
*/
const ROTULO_DETALHADO: Partial<Record<ServiceStatus, string>> = {
  a_aguardar_orcamento: "À espera da Piquet",
  orcamento_enviado: "À espera do cliente",
  a_aguardar_pagamento: "À espera do pagamento do cliente",
  a_aguardar_confirmacao: "Em curso · falta o cliente confirmar",
  pagamento_por_capturar: "Concluído · pagamento por cobrar",
  em_reclamacao: "Concluído · com reclamação",
  cancelado_cliente: "Cancelado pelo cliente",
  cancelado_tecnico: "Cancelado pelo técnico",
  sem_tecnico_disponivel: "Cancelado · sem técnico",
  reembolsado: "Cancelado · reembolsado",
  arquivado: "Cancelado · arquivado",
};

/** Como a equipa lê o estado de um pedido: o estado simples, dito de quem é a vez. */
export function rotuloSimples(status: ServiceStatus): string {
  return ROTULO_DETALHADO[status] ?? estadoSimplesDe(status)?.label ?? status;
}
