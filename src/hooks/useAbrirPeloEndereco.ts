"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Abre a ficha de um registo a partir do endereço: `/clientes?cliente=42&q=Ana`.
 *
 * É o caminho do ⌘K. A pesquisa global encontrava o cliente e depois largava
 * quem a usou na lista genérica, para o procurar outra vez à mão.
 *
 * O Laravel não tem leitura de UM cliente ou de UM técnico pelo id — só a
 * listagem, com pesquisa. Por isso: o `q` preenche a pesquisa da página (que
 * traz o registo para a lista), e quando ele aparece a ficha abre-se sozinha.
 * Uma vez: depois de aberta, os dois parâmetros saem do endereço, senão fechar
 * a ficha e mexer na lista voltava a abri-la.
 *
 * Lê `window.location`, como o `useTabParam`, e não o `useSearchParams`, que
 * obrigaria a embrulhar as páginas em Suspense.
 */
export function useAbrirPeloEndereco<T>(
  chave: string,
  lista: readonly T[] | null | undefined,
  idDe: (item: T) => string | number,
  abrir: (item: T) => void,
  preencherPesquisa?: (texto: string) => void,
): void {
  const alvo = useRef<string | null>(null);
  const feito = useRef(false);
  // Muda a cada pedido, para a procura correr mesmo com a lista igual.
  const [pedido, setPedido] = useState(0);

  useEffect(() => {
    const armar = (search: string) => {
      const p = new URLSearchParams(search);
      const id = p.get(chave);
      if (!id) return;
      alvo.current = id;
      feito.current = false;
      const q = p.get("q");
      if (q && preencherPesquisa) preencherPesquisa(q);
      setPedido((n) => n + 1);
    };
    // Ao montar: o alvo é o do endereço com que se chegou.
    armar(window.location.search);
    // Já nesta página: o ⌘K muda o endereço sem a voltar a montar.
    return ouvirPedidosDeAbertura((url) => armar(url.search));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    if (feito.current || !alvo.current || !lista) return;
    const item = lista.find((x) => String(idDe(x)) === alvo.current);
    if (!item) return;

    feito.current = true;
    abrir(item);

    const url = new URL(window.location.href);
    url.searchParams.delete(chave);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
  }, [lista, chave, idDe, abrir, pedido]);
}

const EVENTO = "piquet:abrir";

/**
 * Avisa a página aberta de que se quer abrir um registo nela.
 *
 * A navegação do Next não volta a montar a página quando só muda a query
 * string: de /clientes para /clientes?cliente=42 nada se mexia. Quem navega
 * chama isto a seguir ao `router.push`.
 */
export function pedirAbertura(href: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENTO, { detail: href }));
}

/** Escuta os pedidos para ESTA página. Devolve a função que deixa de escutar. */
export function ouvirPedidosDeAbertura(fn: (url: URL) => void): () => void {
  const ouvinte = (e: Event) => {
    const href = (e as CustomEvent<string>).detail;
    if (typeof href !== "string") return;
    const url = new URL(href, window.location.origin);
    if (url.pathname === window.location.pathname) fn(url);
  };
  window.addEventListener(EVENTO, ouvinte);
  return () => window.removeEventListener(EVENTO, ouvinte);
}
