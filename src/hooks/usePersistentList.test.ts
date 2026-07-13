import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePersistentList } from "@/hooks/usePersistentList";
import { useDataStore } from "@/stores";

function resetStore() {
  useDataStore.setState({ lists: {} });
}

interface Item { id: string; name: string; active?: boolean }

describe("usePersistentList", () => {
  beforeEach(resetStore);

  it("semeia a partir do valor base quando não há nada guardado", () => {
    const seed: Item[] = [{ id: "a", name: "A" }];
    const { result } = renderHook(() => usePersistentList<Item>("d1", seed));
    expect(result.current[0]).toEqual(seed);
    // Semeado no store.
    expect(useDataStore.getState().lists.d1).toEqual(seed);
  });

  it("persiste mutações via updater funcional", () => {
    const seed: Item[] = [{ id: "a", name: "A", active: true }];
    const { result } = renderHook(() => usePersistentList<Item>("d2", seed));
    act(() => {
      const setList = result.current[1];
      setList((prev) => prev.map((i) => (i.id === "a" ? { ...i, active: false } : i)));
    });
    expect(result.current[0][0].active).toBe(false);
    expect((useDataStore.getState().lists.d2 as Item[])[0].active).toBe(false);
  });

  it("acrescenta itens criados", () => {
    const seed: Item[] = [{ id: "a", name: "A" }];
    const { result } = renderHook(() => usePersistentList<Item>("d3", seed));
    act(() => result.current[1]((prev) => [{ id: "b", name: "B" }, ...prev]));
    expect(result.current[0].map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("depois de semeado, um novo seed NÃO sobrepõe o valor guardado (persistência manda)", () => {
    const first: Item[] = [{ id: "a", name: "A" }];
    const { result, rerender } = renderHook(({ s }) => usePersistentList<Item>("d4", s), {
      initialProps: { s: first },
    });
    act(() => result.current[1]([{ id: "z", name: "Z" }]));
    rerender({ s: [{ id: "a", name: "A" }, { id: "b", name: "B" }] });
    expect(result.current[0].map((i) => i.id)).toEqual(["z"]);
  });
});
