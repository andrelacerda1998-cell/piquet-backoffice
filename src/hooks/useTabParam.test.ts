import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabParam } from "@/hooks/useTabParam";

/*
  O Next dá o endereço por `usePathname`/`useSearchParams`. Aqui leem-se do
  `window.location`, e "navegar" é mudar o endereço e voltar a desenhar --
  que é o que o router do Next faz quando só muda a query string: não volta a
  montar a página.
*/
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const irPara = (url: string) => window.history.replaceState(null, "", url);

beforeEach(() => irPara("/financeiro"));

describe("useTabParam", () => {
  it("abre no separador do endereço", () => {
    irPara("/financeiro?tab=custos");
    const { result } = renderHook(() => useTabParam("resultado"));
    expect(result.current[0]).toBe("custos");
  });

  it("sem separador no endereço, abre no por omissão", () => {
    const { result } = renderHook(() => useTabParam("resultado"));
    expect(result.current[0]).toBe("resultado");
  });

  /** O defeito: "Ver todos", o ⌘K e o sino mudavam o endereço e o separador ficava. */
  it("segue um link para outro separador da mesma página", () => {
    const { result, rerender } = renderHook(() => useTabParam("resultado"));

    irPara("/financeiro?tab=pagamentos");
    rerender();

    expect(result.current[0]).toBe("pagamentos");
  });

  it("volta ao por omissão quando o separador sai do endereço na mesma página (Voltar)", () => {
    irPara("/financeiro?tab=custos");
    const { result, rerender } = renderHook(() => useTabParam("resultado"));

    irPara("/financeiro");
    rerender();

    expect(result.current[0]).toBe("resultado");
  });

  /** As fichas põem /tecnicos/94 no endereço enquanto estão abertas. */
  it("não mexe no separador quando muda o caminho (abrir uma ficha)", () => {
    irPara("/tecnicos?tab=lista");
    const { result, rerender } = renderHook(() => useTabParam("resumo"));

    irPara("/tecnicos/94");
    rerender();
    expect(result.current[0]).toBe("lista");

    // Fechar a ficha devolve o endereço da lista.
    irPara("/tecnicos?tab=lista");
    rerender();
    expect(result.current[0]).toBe("lista");
  });

  it("trocar de separador escreve-o no endereço, e o por omissão tira-o", () => {
    const { result } = renderHook(() => useTabParam("resultado"));

    act(() => result.current[1]("custos"));
    expect(result.current[0]).toBe("custos");
    expect(window.location.search).toBe("?tab=custos");

    act(() => result.current[1]("resultado"));
    expect(result.current[0]).toBe("resultado");
    expect(window.location.search).toBe("");
  });

  it("um ecrã dentro de outro lê o seu parâmetro sem mexer no `tab`", () => {
    irPara("/crescimento?tab=produto&vista=funil");
    const { result } = renderHook(() => useTabParam("apps", "vista"));
    expect(result.current[0]).toBe("funil");

    act(() => result.current[1]("clientes"));
    expect(window.location.search).toBe("?tab=produto&vista=clientes");
  });
});
