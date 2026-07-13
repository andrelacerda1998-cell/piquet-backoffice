"use client";

import { useFilterStore } from "@/stores";
import { TODAY } from "@/lib/today";
import { CalendarDays } from "lucide-react";

const FULL_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Últimos 12 meses a partir da data de referência.
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: `${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  };
});

/**
 * Seletor de mês — escreve no filtro global (`período personalizado` com as
 * datas do mês), pelo que todos os dados da página passam a refletir esse mês.
 * "Período atual" limpa a seleção e volta ao período por defeito.
 */
export function MonthSelect() {
  const { filters, setFilters } = useFilterStore();
  const selected = filters.period === "personalizado" && filters.startDate ? filters.startDate.slice(0, 7) : "";

  const onChange = (value: string) => {
    if (!value) {
      setFilters({ period: "ultimos_30_dias", startDate: undefined, endDate: undefined });
      return;
    }
    const [year, month] = value.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate(); // último dia do mês
    setFilters({
      period: "personalizado",
      startDate: `${value}-01`,
      endDate: `${value}-${String(lastDay).padStart(2, "0")}`,
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <CalendarDays className="h-4 w-4 text-text-muted" />
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="input-field text-sm w-auto py-1.5 pr-8"
        aria-label="Selecionar mês"
      >
        <option value="">Período atual</option>
        {MONTHS.map((m) => (
          <option key={m.key} value={m.key}>{m.label}</option>
        ))}
      </select>
    </div>
  );
}
