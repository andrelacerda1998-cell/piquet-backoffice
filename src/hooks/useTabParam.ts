"use client";

import { useState, useEffect } from "react";

/**
 * Estado de aba com deep-link por `?tab=`. Ao montar, lê o parâmetro do URL
 * (ex.: /tecnicos?tab=recrutamento) e ativa essa aba; caso contrário fica no
 * default. Evita `useSearchParams` (que exigiria Suspense nas páginas estáticas)
 * lendo `window.location` no cliente. Trocar de aba atualiza o URL sem recarregar.
 */
export function useTabParam(defaultTab: string, param = "tab"): [string, (id: string) => void] {
  const [tab, setTab] = useState(defaultTab);

  // `param`: um ecrã dentro de outro com separadores (Produto dentro de
  // Crescimento) lê o seu de outro parâmetro, para não lutarem pelo `tab`.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get(param);
    if (t) setTab(t);
  }, [param]);

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
