import { apiGet } from "./api";

export type SearchType = "service" | "customer" | "technician" | "invoice" | "lead" | "ticket";

export interface SearchResult {
  type: SearchType;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Pesquisa global de entidades (serviços, clientes, técnicos, faturas, leads, tickets). */
export async function searchEntities(q: string): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  return apiGet<{ results: SearchResult[] }>(
    `/search?q=${encodeURIComponent(query)}`,
    () => ({ results: [] }),
  ).then((r) => r.data.results);
}
