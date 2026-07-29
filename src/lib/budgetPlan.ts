// =============================================================================
// Projeção do planeamento financeiro mensal.
// Função pura (testável): dadas as linhas de orçamento + as faturas reais a
// pagar, devolve, mês a mês, os custos totais, as entradas previstas e a
// necessidade líquida de caixa (custos − entradas). Sem I/O nem datas globais.
// =============================================================================

export type BudgetKind = "custo" | "entrada";
export type BudgetFrequency = "mensal" | "trimestral" | "semestral" | "anual" | "unica";

/** Linha de orçamento (forma mínima de que a projeção precisa). */
export interface PlanItem {
  kind: BudgetKind;
  amount: number;
  frequency: BudgetFrequency;
  startMonth: string; // "YYYY-MM"
  active: boolean;
  name?: string; // para o detalhe por mês
}

/** Fatura real a pagar (forma mínima). */
export interface PlanInvoice {
  outstanding: number;
  amount: number; // valor total — usado nas ocorrências projetadas de recorrentes
  dueDate: string | null; // "YYYY-MM-DD"
  status: string; // "pendente" | "parcial" | "pago"
  recurrence?: string; // "nenhuma" | "mensal" | "trimestral" | "semestral" | "anual"
  name?: string; // para o detalhe por mês (fornecedor)
}

/** Colaborador (forma mínima): custo mensal desde o início do contrato. */
export interface PlanTeamMember {
  monthlyCost: number;
  startMonth: string; // "YYYY-MM" (mês do início do contrato)
  endMonth?: string | null; // "YYYY-MM"; depois deste mês deixa de contar
  name?: string; // para o detalhe por mês
}

/** Uma parcela do detalhe de um mês (o que compõe cada coluna). */
export interface PlanEntry {
  name: string;
  amount: number;
  /** true = ocorrência futura de uma fatura recorrente (ainda não lançada). */
  projected?: boolean;
}

export interface PlanMonthDetail {
  costs: PlanEntry[]; // linhas kind=custo
  team: PlanEntry[]; // colaboradores
  invoices: PlanEntry[]; // faturas (reais + projetadas)
  inflows: PlanEntry[]; // linhas kind=entrada
}

export interface PlanMonth {
  month: string; // "YYYY-MM"
  label: string; // "jul 2026"
  recurringCosts: number; // linhas kind=custo que caem no mês
  teamCosts: number; // colaboradores com contrato ativo no mês
  invoices: number; // faturas a pagar no mês (outstanding + recorrentes projetadas)
  totalCosts: number; // recurringCosts + teamCosts + invoices
  expectedInflow: number; // linhas kind=entrada que caem no mês
  net: number; // totalCosts − expectedInflow  (>0 = falta injetar)
  detail: PlanMonthDetail; // composição do mês, para o clique de detalhe
}

export interface PlanTotals {
  recurringCosts: number;
  teamCosts: number;
  invoices: number;
  totalCosts: number;
  expectedInflow: number;
  net: number;
}

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Passo (em meses) de cada periodicidade; `unica` trata-se à parte. */
const STEP: Record<BudgetFrequency, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12, unica: 0 };
/** Passo das repetições de faturas ("nenhuma" e desconhecidos → 0 = sem projeção). */
const INVOICE_STEP: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

/** Índice absoluto de um "YYYY-MM" em meses (para aritmética simples). */
function monthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** "YYYY-MM" → rótulo curto "jul 2026". */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

/** Soma n meses a um "YYYY-MM", devolvendo "YYYY-MM". */
export function addMonths(ym: string, n: number): string {
  const idx = monthIndex(ym) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** True se a linha (pela periodicidade e mês-âncora) ocorre no mês-alvo. */
function itemHitsMonth(item: PlanItem, targetIdx: number): boolean {
  const startIdx = monthIndex(item.startMonth);
  if (targetIdx < startIdx) return false;
  if (item.frequency === "unica") return targetIdx === startIdx;
  const step = STEP[item.frequency];
  return (targetIdx - startIdx) % step === 0;
}

export interface BuildPlanOptions {
  /** Primeiro mês da projeção, "YYYY-MM". */
  fromMonth: string;
  /** Nº de meses a projetar (por omissão 12). */
  horizon?: number;
  /** Colaboradores: custo mensal contado do início ao fim do contrato. */
  team?: PlanTeamMember[];
}

/**
 * Constrói a projeção mês a mês.
 *
 * Faturas reais: as não pagas com vencimento dentro da janela caem no seu mês;
 * as vencidas/sem data (antes do 1.º mês ou sem `dueDate`) entram no 1.º mês,
 * por representarem dinheiro que já é preciso agora. As RECORRENTES projetam
 * ainda as ocorrências seguintes (valor total) nos meses futuros — quando a
 * fatura é paga e o servidor gera a próxima, a projeção desloca-se sozinha.
 */
export function buildMonthlyPlan(
  items: PlanItem[],
  invoices: PlanInvoice[],
  { fromMonth, horizon = 12, team = [] }: BuildPlanOptions
): { months: PlanMonth[]; totals: PlanTotals } {
  const active = items.filter((i) => i.active);
  const fromIdx = monthIndex(fromMonth);
  const lastIdx = fromIdx + horizon - 1;

  const months: PlanMonth[] = [];
  for (let k = 0; k < horizon; k++) {
    const idx = fromIdx + k;
    const ym = addMonths(fromMonth, k);
    const detail: PlanMonthDetail = { costs: [], team: [], invoices: [], inflows: [] };

    let recurringCosts = 0;
    let expectedInflow = 0;
    for (const item of active) {
      if (!itemHitsMonth(item, idx)) continue;
      const entry = { name: item.name ?? "Linha do plano", amount: item.amount };
      if (item.kind === "entrada") { expectedInflow += item.amount; detail.inflows.push(entry); }
      else { recurringCosts += item.amount; detail.costs.push(entry); }
    }

    // Colaboradores: contam do mês do início do contrato até ao fim (se houver).
    let teamCosts = 0;
    for (const member of team) {
      if (idx < monthIndex(member.startMonth)) continue;
      if (member.endMonth && idx > monthIndex(member.endMonth)) continue;
      teamCosts += member.monthlyCost;
      detail.team.push({ name: member.name ?? "Colaborador", amount: member.monthlyCost });
    }

    // Faturas reais a pagar (não pagas): o valor em falta cai no mês do
    // vencimento; as recorrentes projetam as ocorrências seguintes.
    let inv = 0;
    for (const f of invoices) {
      if (f.status === "pago" || f.outstanding <= 0) continue;
      const due = f.dueDate ? monthIndex(f.dueDate.slice(0, 7)) : null;
      const bucket = due === null || due < fromIdx ? fromIdx : due; // vencidas/sem data → 1.º mês
      if (bucket === idx && bucket <= lastIdx) {
        inv += f.outstanding;
        detail.invoices.push({ name: f.name ?? "Fatura", amount: f.outstanding });
      }
      const step = f.recurrence ? INVOICE_STEP[f.recurrence] ?? 0 : 0;
      if (step > 0 && idx > bucket && (idx - bucket) % step === 0) {
        inv += f.amount;
        detail.invoices.push({ name: `${f.name ?? "Fatura"} (prevista)`, amount: f.amount, projected: true });
      }
    }

    const totalCosts = recurringCosts + teamCosts + inv;
    months.push({
      month: ym,
      label: monthLabel(ym),
      recurringCosts,
      teamCosts,
      invoices: inv,
      totalCosts,
      expectedInflow,
      net: totalCosts - expectedInflow,
      detail,
    });
  }

  const totals = months.reduce<PlanTotals>(
    (acc, m) => ({
      recurringCosts: acc.recurringCosts + m.recurringCosts,
      teamCosts: acc.teamCosts + m.teamCosts,
      invoices: acc.invoices + m.invoices,
      totalCosts: acc.totalCosts + m.totalCosts,
      expectedInflow: acc.expectedInflow + m.expectedInflow,
      net: acc.net + m.net,
    }),
    { recurringCosts: 0, teamCosts: 0, invoices: 0, totalCosts: 0, expectedInflow: 0, net: 0 }
  );

  return { months, totals };
}
