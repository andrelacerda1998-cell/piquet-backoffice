/**
 * Os endereços das fichas. Cada registo tem um só endereço, e todas as
 * ligações -- ⌘K, alertas, avisos no telemóvel, "Copiar ligação" -- levam a
 * ele: um pedido abre sempre em /servicos/282, um cliente em /clientes/412.
 */

/** A ficha de um pedido: /servicos/282. */
export function pedidoHref(id: string | number): string {
  return `/servicos/${encodeURIComponent(String(id))}`;
}

/**
 * O endereço que abre a ficha de um cliente ou de um técnico. Com um id do
 * Laravel (só números) é o endereço próprio: /clientes/412, /tecnicos/94
 * (desde 09/10/2026). Para ids que não sejam números fica o formato antigo,
 * com o nome para a lista o procurar (ver useAbrirPeloEndereco).
 */
export function fichaHref(base: string, chave: string, id: unknown, nome?: unknown): string {
  if (/^\d+$/.test(String(id))) return `${base.split("?")[0]}/${id}`;
  const url = new URL(base, "http://x");
  url.searchParams.set(chave, String(id));
  const q = typeof nome === "string" ? nome.trim() : "";
  if (q) url.searchParams.set("q", q);
  return url.pathname + url.search;
}

export const clienteHref = (id: unknown, nome?: unknown) => fichaHref("/clientes?tab=lista", "cliente", id, nome);
export const tecnicoHref = (id: unknown, nome?: unknown) => fichaHref("/tecnicos?tab=lista", "tecnico", id, nome);
