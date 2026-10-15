"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useFilterStore } from "@/stores";
import { chaveDaLeitura, coletarPedidos, guardarLeitura, lerGuardada } from "@/lib/leiturasGuardadas";

// No browser corre antes de pintar: a leitura guardada entra no primeiro ecrã,
// sem piscar o "a carregar". No servidor o useLayoutEffect não corre.
const useAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Lê dados para um ecrã.
 *
 * Ao montar, se esta mesma leitura foi feita há menos de 10 minutos, mostra-a
 * logo (`loading` falso) e vai buscar a nova em segundo plano: voltar a uma
 * página já não volta a mostrar "a carregar". Ver src/lib/leiturasGuardadas.ts.
 *
 * O `refetch` vai sempre ao servidor e mostra o `loading`, como antes: é o que
 * se chama depois de uma ação, quando o que interessa é o estado novo.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Só a resposta do pedido mais recente conta: uma lenta que chegasse depois
  // de uma rápida deixava no ecrã o estado de antes.
  const ultimo = useRef(0);

  const carregar = useCallback(async (mostrarGuardada: boolean) => {
    const este = ++ultimo.current;
    setError(null);

    let leitura: Promise<T>;
    let chave: string | null = null;
    try {
      const { resultado, pedidos } = coletarPedidos(fetcher);
      leitura = Promise.resolve(resultado);
      chave = chaveDaLeitura(fetcher, pedidos, deps);
    } catch (e) {
      leitura = Promise.reject(e);
    }

    const guardada = mostrarGuardada && chave ? lerGuardada<T>(chave) : undefined;
    if (guardada !== undefined) {
      setData(guardada);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const result = await leitura;
      if (este !== ultimo.current) return;
      setData(result);
      if (chave) guardarLeitura(chave, result);
    } catch (e) {
      if (este !== ultimo.current) return;
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      if (este === ultimo.current) setLoading(false);
    }
    // A lista de dependências é controlada pelo chamador (padrão de data-fetching genérico).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => carregar(false), [carregar]);

  useAntesDePintar(() => {
    void carregar(true);
  }, [carregar]);

  return { data, loading, error, refetch };
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useFilters() {
  return useFilterStore((s) => s.filters);
}

export function usePagination(initialPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(initialPageSize);
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setPage(1);
  };

  return { page, setPage, pageSize, sortField, sortDirection, handleSort, search, setSearch };
}
