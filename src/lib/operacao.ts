/**
 * O funil, a distribuição de estados e os tempos da operação — dos serviços
 * REAIS.
 *
 * A conta do funil e da distribuição já estava certa; o que estava errado era
 * a fonte: corriam sobre `mockData.services`. Aqui é a mesma lógica aplicada
 * ao que o Laravel devolve.
 *
 * Os tempos são outra história. O mock devolvia 28, 95, 180, 1440 e 120
 * minutos — constantes escritas no código — mais taxas de remarcação (5,2%),
 * resolução à primeira (87,5%) e "serviços em atraso" (12) que não vinham de
 * lado nenhum. Ficam só os que se conseguem medir; o resto não se substitui
 * por um palpite.
 */

export interface ServicoOperacional {
  id: string;
  status: string;
  technicianId?: string;
  startedAt?: string;
  completedAt?: string;
  responseTimeMinutes?: number;
  technicianAssignmentTimeMinutes?: number;
}

export interface PassoFunil {
  nome: string;
  quantos: number;
  /** % sobre o total de pedidos. */
  percentagem: number;
  /** % que se perdeu do passo anterior. */
  perdaNoPasso: number;
}

export interface Operacao {
  total: number;
  funil: PassoFunil[];
  /** Quantos serviços em cada estado, do mais comum para o menos. */
  porEstado: { estado: string; quantos: number }[];
  /** Percentagem de serviços concluídos. */
  taxaConclusao: number;
  /** Percentagem de serviços cancelados. */
  taxaCancelamento: number;
  /**
   * Medianas em minutos, `null` quando nenhum serviço traz o dado.
   * Mediana e não média: um serviço esquecido em aberto durante três semanas
   * desloca uma média e não desloca a mediana.
   */
  tempoAteResponder: number | null;
  tempoAteEncontrarTecnico: number | null;
  duracaoDoServico: number | null;
  /** Quantos serviços sustentam cada mediana — sem isto, o número não se lê. */
  amostras: { responder: number; encontrar: number; duracao: number };
}

const CONCLUIDO = "concluido";

/** Estados a partir dos quais já houve pagamento (ou mais). */
const DEPOIS_DE_PAGAR = new Set(["pago", "agendado", "em_execucao", CONCLUIDO]);
const DEPOIS_DE_ORCAMENTO = new Set(["orcamento_enviado", "a_aguardar_pagamento", ...DEPOIS_DE_PAGAR]);
const DEPOIS_DE_COMECAR = new Set(["em_execucao", CONCLUIDO]);

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  const m = ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
  return Math.round(m);
}

/** Minutos entre dois instantes, ou `null` se alguma data não presta. */
export function minutosEntre(de?: string, ate?: string): number | null {
  if (!de || !ate) return null;
  const a = new Date(de).getTime();
  const b = new Date(ate).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60_000);
}

export function construirOperacao(servicos: ServicoOperacional[]): Operacao {
  const total = servicos.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  const passos = [
    { nome: "Pedido recebido", quantos: total },
    { nome: "Técnico encontrado", quantos: servicos.filter((s) => s.technicianId).length },
    { nome: "Orçamento enviado", quantos: servicos.filter((s) => DEPOIS_DE_ORCAMENTO.has(s.status)).length },
    { nome: "Pagamento feito", quantos: servicos.filter((s) => DEPOIS_DE_PAGAR.has(s.status)).length },
    { nome: "Serviço começado", quantos: servicos.filter((s) => DEPOIS_DE_COMECAR.has(s.status)).length },
    { nome: "Serviço concluído", quantos: servicos.filter((s) => s.status === CONCLUIDO).length },
  ];

  let anterior = total;
  const funil: PassoFunil[] = passos.map((p) => {
    const perdaNoPasso = anterior > 0 ? Math.round(((anterior - p.quantos) / anterior) * 1000) / 10 : 0;
    anterior = p.quantos;
    return { nome: p.nome, quantos: p.quantos, percentagem: pct(p.quantos), perdaNoPasso };
  });

  const contagem = new Map<string, number>();
  for (const s of servicos) contagem.set(s.status, (contagem.get(s.status) ?? 0) + 1);
  const porEstado = [...contagem.entries()]
    .map(([estado, quantos]) => ({ estado, quantos }))
    .sort((a, b) => b.quantos - a.quantos);

  const concluidos = servicos.filter((s) => s.status === CONCLUIDO).length;
  const cancelados = servicos.filter((s) => s.status.startsWith("cancelado")).length;

  const responder = servicos
    .map((s) => s.responseTimeMinutes)
    .filter((n): n is number => typeof n === "number" && n >= 0);
  const encontrar = servicos
    .map((s) => s.technicianAssignmentTimeMinutes)
    .filter((n): n is number => typeof n === "number" && n >= 0);
  const duracao = servicos
    .map((s) => minutosEntre(s.startedAt, s.completedAt))
    .filter((n): n is number => n !== null);

  return {
    total,
    funil,
    porEstado,
    taxaConclusao: pct(concluidos),
    taxaCancelamento: pct(cancelados),
    tempoAteResponder: mediana(responder),
    tempoAteEncontrarTecnico: mediana(encontrar),
    duracaoDoServico: mediana(duracao),
    amostras: { responder: responder.length, encontrar: encontrar.length, duracao: duracao.length },
  };
}
