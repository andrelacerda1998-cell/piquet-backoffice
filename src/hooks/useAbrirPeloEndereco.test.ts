import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAbrirPeloEndereco, pedirAbertura } from "@/hooks/useAbrirPeloEndereco";

/**
 * O caminho do ⌘K até à ficha: o endereço traz o id e o nome, a página
 * procura pelo nome, e a ficha abre quando o registo chega à lista.
 */
type Cliente = { id: number; name: string };
const ana: Cliente = { id: 42, name: "Ana Marques" };
const rui: Cliente = { id: 7, name: "Rui" };

const irPara = (q: string) => window.history.replaceState(null, "", `/clientes${q}`);
const idDe = (c: Cliente) => c.id;

beforeEach(() => irPara(""));

describe("useAbrirPeloEndereco", () => {
  it("passa o nome à pesquisa da página", () => {
    irPara("?cliente=42&q=Ana%20Marques");
    const pesquisa = vi.fn();
    renderHook(() => useAbrirPeloEndereco("cliente", undefined, idDe, vi.fn(), pesquisa));

    expect(pesquisa).toHaveBeenCalledWith("Ana Marques");
  });

  it("abre a ficha quando o registo aparece na lista, e não antes", () => {
    irPara("?cliente=42&q=Ana");
    const abrir = vi.fn();
    const { rerender } = renderHook(
      ({ lista }) => useAbrirPeloEndereco("cliente", lista, idDe, abrir),
      { initialProps: { lista: [rui] as Cliente[] } },
    );
    expect(abrir).not.toHaveBeenCalled();

    rerender({ lista: [rui, ana] });

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith(ana);
  });

  /** Senão fechar a ficha e mexer na lista voltava a abri-la. */
  it("abre uma vez só e limpa o endereço", () => {
    irPara("?tab=lista&cliente=42&q=Ana");
    const abrir = vi.fn();
    const { rerender } = renderHook(
      ({ lista }) => useAbrirPeloEndereco("cliente", lista, idDe, abrir),
      { initialProps: { lista: [ana] as Cliente[] } },
    );
    rerender({ lista: [ana, rui] });

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?tab=lista");
  });

  it("sem id no endereço não faz nada", () => {
    const abrir = vi.fn();
    const pesquisa = vi.fn();
    renderHook(() => useAbrirPeloEndereco("cliente", [ana], idDe, abrir, pesquisa));

    expect(abrir).not.toHaveBeenCalled();
    expect(pesquisa).not.toHaveBeenCalled();
  });

  it("compara o id como texto: o endereço é sempre texto", () => {
    irPara("?cliente=42");
    const abrir = vi.fn();
    renderHook(() => useAbrirPeloEndereco("cliente", [{ id: "42", name: "Ana" }], (c) => c.id, abrir));

    expect(abrir).toHaveBeenCalledTimes(1);
  });
});

describe("pedirAbertura — o ⌘K na mesma página", () => {
  it("abre outro registo sem a página voltar a montar", () => {
    const abrir = vi.fn();
    const pesquisa = vi.fn();
    renderHook(() => useAbrirPeloEndereco("cliente", [ana, rui], idDe, abrir, pesquisa));
    expect(abrir).not.toHaveBeenCalled();

    act(() => pedirAbertura("/clientes?tab=lista&cliente=7&q=Rui"));

    expect(pesquisa).toHaveBeenCalledWith("Rui");
    expect(abrir).toHaveBeenCalledWith(rui);
  });

  it("ignora pedidos para outra página", () => {
    const abrir = vi.fn();
    renderHook(() => useAbrirPeloEndereco("cliente", [ana], idDe, abrir));

    act(() => pedirAbertura("/tecnicos?cliente=42"));

    expect(abrir).not.toHaveBeenCalled();
  });

  it("depois de abrir um, abre o seguinte", () => {
    irPara("?cliente=42");
    const abrir = vi.fn();
    renderHook(() => useAbrirPeloEndereco("cliente", [ana, rui], idDe, abrir));
    act(() => pedirAbertura("/clientes?cliente=7"));

    expect(abrir.mock.calls.map(([c]) => c.id)).toEqual([42, 7]);
  });
});
