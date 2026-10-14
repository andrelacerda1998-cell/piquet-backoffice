"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Estado de aba com deep-link por `?tab=` (ex.: /tecnicos?tab=aprovacoes).
 * Trocar de aba atualiza o URL sem recarregar.
 *
 * O separador segue o endereço, e não só o endereço com que se chegou. Lia-o
 * uma vez, ao montar: um link para outro separador da MESMA página ("Ver
 * todos" do "Precisa de ti", o ⌘K, o sino) mudava o endereço e o separador
 * ficava onde estava, porque o Next não volta a montar a página quando só
 * muda a query string.
 *
 * As regras:
 * - o endereço traz o separador → é esse;
 * - o separador sai do endereço na mesma página (o botão Voltar, um link sem
 *   ele) → volta ao separador por omissão;
 * - muda o caminho → fica onde estava. As fichas trocam o endereço por
 *   /tecnicos/94 enquanto estão abertas (sem `?tab=`), e saltar para o
 *   separador por omissão por baixo da ficha deitava fora a lista onde se
 *   estava.
 *
 * `useSearchParams` pede um limite de Suspense por cima da página para ela
 * compilar como estática: as páginas que usam isto embrulham-se num.
 *
 * `param`: um ecrã dentro de outro com separadores (Produto dentro de
 * Crescimento) lê o seu de outro parâmetro, para não lutarem pelo `tab`.
 */
export function useTabParam(defaultTab: string, param = "tab"): [string, (id: string) => void] {
  const caminho = usePathname();
  const doEndereco = useSearchParams().get(param);
  const [tab, setTab] = useState(doEndereco ?? defaultTab);
  const caminhoAnterior = useRef(caminho);

  useEffect(() => {
    const mesmaPagina = caminhoAnterior.current === caminho;
    caminhoAnterior.current = caminho;
    if (doEndereco) setTab(doEndereco);
    else if (mesmaPagina) setTab(defaultTab);
  }, [doEndereco, caminho, defaultTab]);

  const change = (id: string) => {
    setTab(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id === defaultTab) url.searchParams.delete(param);
      else url.searchParams.set(param, id);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return [tab, change];
}
