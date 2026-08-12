import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

export function generateId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Escapa um valor para CSV: sem isto, uma descrição com ";" ou uma quebra de
 * linha desalinhava todas as colunas seguintes ao abrir no Excel.
 */
function csvCell(value: string): string {
  const v = value ?? "";
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const csvLine = (cells: string[]) => cells.map(csvCell).join(";");

function saveCsv(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  saveCsv(filename, [csvLine(headers), ...rows.map(csvLine)].join("\n"));
}

/** Uma secção do relatório: título próprio, colunas próprias, e um total opcional. */
export interface CsvSection {
  title: string;
  headers: string[];
  rows: string[][];
  /** Linha final destacada (ex.: "TOTAL; ; ; 1.234,00"). */
  total?: string[];
  /** Mostrado por baixo do título quando a secção não tem linhas. */
  emptyNote?: string;
}

/**
 * Relatório em CSV com secções — em vez de despejar tudo numa tabela plana com
 * colunas genéricas, cada assunto leva o seu bloco, com as colunas que fazem
 * sentido e o seu total. Abre no Excel/Numbers com a estrutura visível.
 */
export function downloadReportCsv(
  filename: string,
  meta: { title: string; subtitle?: string; lines?: string[] },
  sections: CsvSection[],
): void {
  const out: string[] = [];
  out.push(csvLine([meta.title]));
  if (meta.subtitle) out.push(csvLine([meta.subtitle]));
  for (const l of meta.lines ?? []) out.push(csvLine([l]));

  for (const sec of sections) {
    out.push("");
    out.push(csvLine([sec.title.toUpperCase()]));
    if (sec.rows.length === 0) {
      out.push(csvLine([sec.emptyNote ?? "(sem registos no período)"]));
      continue;
    }
    out.push(csvLine(sec.headers));
    for (const r of sec.rows) out.push(csvLine(r));
    if (sec.total) out.push(csvLine(sec.total));
  }
  saveCsv(filename, out.join("\n"));
}
