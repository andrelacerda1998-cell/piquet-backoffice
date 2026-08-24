import type { DashboardAlert, AlertPriority } from "@/types";

/**
 * Agrupa alertas repetidos do mesmo tipo numa linha só.
 *
 * As regras geram um alerta POR registo — uma lead por responder, uma fatura
 * vencida, uma obrigação fiscal. Isso é o correto enquanto são poucos: cada
 * linha é um caso concreto com nome e data. Deixa de ser quando são muitos:
 * com 23 leads paradas a página fica uma parede de cartões iguais, e um ecrã
 * que se percorre a fazer scroll é um ecrã que se deixa de ler.
 *
 * A partir de {@link LIMITE_AGRUPAMENTO} a família passa a uma linha com a
 * contagem, ficando à vista o caso mais antigo — que é o que interessa. O
 * clique leva à lista completa, onde estão todos.
 *
 * Agrupar NUNCA baixa a urgência: o grupo herda a mais alta dos seus membros.
 * Um resumo que suavizasse o pior caso seria pior do que não agrupar.
 */

/** A partir de quantos alertas iguais se resume numa linha. */
export const LIMITE_AGRUPAMENTO = 4;

interface Familia {
  /** Prefixo dos ids gerados por `gerarAlertas`. */
  prefixo: string;
  /** Id estável do grupo — usado para o adiar funcionar sobre o grupo. */
  id: string;
  titulo: (n: number) => string;
  accao: string;
  /** Para onde o clique leva: a lista, não um registo. */
  entityType: string;
}

const FAMILIAS: Familia[] = [
  {
    prefixo: "lead-sem-resposta-",
    id: "grupo-leads-sem-resposta",
    titulo: (n) => `${n} pedidos sem resposta`,
    accao: "Abrir CRM & Leads e responder aos mais antigos primeiro.",
    entityType: "leads",
  },
  {
    prefixo: "orcamento-sem-resposta-",
    id: "grupo-orcamentos-sem-resposta",
    titulo: (n) => `${n} pedidos à espera do cliente`,
    accao: "Insistir, ou marcar como recusado quem já não responde.",
    entityType: "leads",
  },
  {
    prefixo: "ticket-",
    id: "grupo-tickets-sem-resposta",
    titulo: (n) => `${n} tickets sem resposta`,
    accao: "Responder em Suporte, do mais antigo para o mais recente.",
    entityType: "tickets",
  },
  {
    prefixo: "fatura-vencida-",
    id: "grupo-faturas-vencidas",
    titulo: (n) => `${n} faturas de fornecedores vencidas`,
    accao: "Registar os pagamentos em Financeiro › Faturas de custos.",
    entityType: "fatura",
  },
  {
    prefixo: "imposto-vencido-",
    id: "grupo-impostos-vencidos",
    titulo: (n) => `${n} obrigações fiscais com prazo ultrapassado`,
    accao: "Confirmar os pagamentos em Financeiro › Impostos e RH.",
    entityType: "imposto",
  },
];

const ORDEM: Record<AlertPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

const maisUrgente = (as: DashboardAlert[]): AlertPriority =>
  as.reduce<AlertPriority>((p, a) => (ORDEM[a.priority] < ORDEM[p] ? a.priority : p), "baixa");

export function agruparAlertas(
  alertas: DashboardAlert[],
  limite: number = LIMITE_AGRUPAMENTO,
): DashboardAlert[] {
  const usados = new Set<string>();
  const grupos: DashboardAlert[] = [];

  for (const f of FAMILIAS) {
    const membros = alertas.filter((a) => a.id.startsWith(f.prefixo));
    if (membros.length < limite) continue;
    membros.forEach((a) => usados.add(a.id));

    // O mais antigo é o que está à espera há mais tempo — é ele que dá a data
    // ao grupo e o exemplo que se mostra.
    const ordenados = [...membros].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const antigo = ordenados[0];
    grupos.push({
      id: f.id,
      type: antigo.type,
      priority: maisUrgente(membros),
      title: f.titulo(membros.length),
      // Mostrar o caso mais antigo evita que agrupar apague a informação: quem
      // lê continua a saber qual é o pior, e há quanto tempo.
      description: `O mais antigo: ${antigo.title.toLowerCase()} — ${antigo.description}`,
      createdAt: antigo.createdAt,
      status: "novo",
      recommendedAction: f.accao,
      entityType: f.entityType,
    });
  }

  const soltos = alertas.filter((a) => !usados.has(a.id));
  return [...grupos, ...soltos].sort((a, b) =>
    ORDEM[a.priority] - ORDEM[b.priority] || Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
