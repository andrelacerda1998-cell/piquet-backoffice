export const BUDGET_KINDS = ["custo", "entrada"];
export const BUDGET_FREQUENCIES = ["mensal", "trimestral", "semestral", "anual", "unica"];
export const BUDGET_CATEGORIES = [
  "salarios", "renda", "software", "servicos", "marketing",
  "impostos", "seguros", "financiamento", "comissoes", "outros",
];

export interface BudgetRow {
  id: string;
  name: string;
  kind: string;
  category: string;
  amount: number | string;
  frequency: string;
  start_month: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

/** Linha da BD → forma `BudgetItem` (camelCase) que o frontend consome. */
export function toBudgetItem(r: BudgetRow) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    category: r.category,
    amount: Number(r.amount),
    frequency: r.frequency,
    startMonth: r.start_month,
    active: r.active,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

/** Valida "YYYY-MM" (mês 01–12). */
export function isValidMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}
