import { apiGet } from "./api";
import type { StatusTone } from "@/lib/formatters";

export type SearchType = "service" | "customer" | "technician" | "payment" | "lead" | "ticket" | "invoice";

export interface SearchResult {
  type: SearchType;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** O estado ao lado do resultado ("À espera do cliente", "Bloqueado"…). */
  estado?: string;
  tom?: StatusTone;
}

/** Pesquisa global de entidades: pedidos, clientes, técnicos, pagamentos, contactos, tickets e faturas. */
export async function searchEntities(q: string): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2 && !/^#?\d$/.test(query)) return [];
  return apiGet<{ results: SearchResult[] }>(
    `/search?q=${encodeURIComponent(query)}`,
    () => ({ results: [] }),
  ).then((r) => r.data.results);
}
