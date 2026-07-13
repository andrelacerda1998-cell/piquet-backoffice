"use client";

import { useCallback, useEffect } from "react";
import { useDataStore } from "@/stores";

type Updater<T> = T[] | ((prev: T[]) => T[]);

/**
 * `useState<T[]>` persistido (localStorage via `useDataStore`), com a MESMA
 * assinatura de `useState`, para que mutações de gestão (preços, zonas,
 * catálogo…) sobrevivam ao refresh.
 *
 * Substitui diretamente o padrão:
 *   const [x, setX] = useState<T[]>([]);
 *   useEffect(() => { if (data) setX(data); }, [data]);
 * por:
 *   const [x, setX] = usePersistentList<T>("dominio", data);
 *
 * `seed` é o valor base (mock/backend); é semeado uma vez por domínio e as
 * edições passam a mandar. Chamar `resetList(domain)` no store limpa-as.
 */
export function usePersistentList<T>(domain: string, seed: T[] | null | undefined): [T[], (u: Updater<T>) => void] {
  const stored = useDataStore((s) => s.lists[domain]) as T[] | undefined;
  const setListRaw = useDataStore((s) => s.setList);

  // Semeia uma vez, quando os dados base chegam e ainda não há nada guardado.
  useEffect(() => {
    if (stored === undefined && seed != null) setListRaw(domain, seed);
  }, [domain, seed, stored, setListRaw]);

  const value = stored ?? seed ?? [];

  const setList = useCallback(
    (u: Updater<T>) => {
      const current = (useDataStore.getState().lists[domain] as T[] | undefined) ?? seed ?? [];
      const next = typeof u === "function" ? (u as (prev: T[]) => T[])(current) : u;
      setListRaw(domain, next);
    },
    [domain, seed, setListRaw]
  );

  return [value, setList];
}
