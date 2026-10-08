import type { ServiceStatus } from "@/types";

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
}

export const ESTADOS_SIMPLES: EstadoSimples[] = [
  { id: "procura", label: "À procura de profissional", statuses: ["pedido_recebido", "a_procurar_tecnico"] },
  { id: "espera", label: "À espera", statuses: ["a_aguardar_orcamento", "orcamento_enviado", "a_aguardar_pagamento"] },
  { id: "agendado", label: "Agendado", statuses: ["tecnico_encontrado", "pago", "agendado"] },
  { id: "curso", label: "Em curso", statuses: ["em_execucao", "a_aguardar_confirmacao"] },
  { id: "concluido", label: "Concluído", statuses: ["concluido", "pagamento_por_capturar", "em_reclamacao"] },
  {
    id: "cancelado", label: "Cancelado",
    statuses: ["cancelado_cliente", "cancelado_tecnico", "sem_tecnico_disponivel", "reembolsado", "arquivado"],
  },
];

/** Os estados técnicos que pedem alguém da equipa, seja qual for o estado simples. */
export const PRECISA_DE_ATENCAO: ServiceStatus[] = ["pagamento_por_capturar", "em_reclamacao"];

export function precisaDeAtencao(status: ServiceStatus): boolean {
  return PRECISA_DE_ATENCAO.includes(status);
}

/** Os que precisam de atenção primeiro; o resto fica pela ordem em que vinha. */
export function atencaoPrimeiro<T extends { status: ServiceStatus }>(lista: readonly T[]): T[] {
  return [...lista.filter((s) => precisaDeAtencao(s.status)), ...lista.filter((s) => !precisaDeAtencao(s.status))];
}
