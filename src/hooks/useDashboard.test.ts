import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAsyncData } from "@/hooks/useDashboard";
import { apiGet, apiPost, clearAuthToken } from "@/services/api";
import { esquecerLeituras } from "@/lib/leiturasGuardadas";

// Sem NEXT_PUBLIC_API_URL o api.ts está em modo de demonstração: o apiGet
// responde com o que a função de mock devolve, depois de um atraso, como um
// pedido verdadeiro. É o mesmo caminho do `request()` que regista o pedido.
let valor = "primeiro";
const ler = () => apiGet("/teste/leituras", () => valor).then((r) => r.data);

describe("useAsyncData: voltar a uma página", () => {
  beforeEach(() => {
    esquecerLeituras();
    valor = "primeiro";
  });

  it("na primeira visita espera pelo pedido", async () => {
    const { result } = renderHook(() => useAsyncData(ler, []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe("primeiro"));
    expect(result.current.loading).toBe(false);
  });

  it("ao voltar mostra logo a leitura anterior, sem loading, e depois a nova", async () => {
    const primeira = renderHook(() => useAsyncData(ler, []));
    await waitFor(() => expect(primeira.result.current.data).toBe("primeiro"));
    primeira.unmount();

    valor = "segundo";
    const volta = renderHook(() => useAsyncData(ler, []));
    expect(volta.result.current.data).toBe("primeiro");
    expect(volta.result.current.loading).toBe(false);
    await waitFor(() => expect(volta.result.current.data).toBe("segundo"));
  });

  it("depois de uma escrita volta a esperar pelo pedido", async () => {
    const primeira = renderHook(() => useAsyncData(ler, []));
    await waitFor(() => expect(primeira.result.current.data).toBe("primeiro"));
    primeira.unmount();

    await apiPost("/teste/escrita", {}, () => ({}));
    const volta = renderHook(() => useAsyncData(ler, []));
    expect(volta.result.current.loading).toBe(true);
    expect(volta.result.current.data).toBeNull();
    await waitFor(() => expect(volta.result.current.data).toBe("primeiro"));
  });

  it("depois de sair da sessão volta a esperar pelo pedido", async () => {
    const primeira = renderHook(() => useAsyncData(ler, []));
    await waitFor(() => expect(primeira.result.current.data).toBe("primeiro"));
    primeira.unmount();

    clearAuthToken();
    const volta = renderHook(() => useAsyncData(ler, []));
    expect(volta.result.current.data).toBeNull();
    expect(volta.result.current.loading).toBe(true);
    await waitFor(() => expect(volta.result.current.data).toBe("primeiro"));
  });

  it("o refetch vai sempre ao servidor e mostra o loading", async () => {
    const { result } = renderHook(() => useAsyncData(ler, []));
    await waitFor(() => expect(result.current.data).toBe("primeiro"));

    valor = "segundo";
    act(() => {
      void result.current.refetch();
    });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe("segundo"));
  });

  it("outro estado do ecrã não aproveita a leitura feita para outro", async () => {
    const daCategoria = (c: string) => () => apiGet("/teste/categoria", () => `${c}:${valor}`).then((r) => r.data);

    const a = renderHook(({ c }) => useAsyncData(daCategoria(c), [c]), { initialProps: { c: "eletricidade" } });
    await waitFor(() => expect(a.result.current.data).toBe("eletricidade:primeiro"));
    a.unmount();

    const b = renderHook(({ c }) => useAsyncData(daCategoria(c), [c]), { initialProps: { c: "limpezas" } });
    expect(b.result.current.data).toBeNull();
    expect(b.result.current.loading).toBe(true);
    await waitFor(() => expect(b.result.current.data).toBe("limpezas:primeiro"));
  });

  it("uma leitura que só pede depois de esperar não se guarda", async () => {
    const depoisDeEsperar = async () => {
      await Promise.resolve();
      return (await apiGet("/teste/tardia", () => valor)).data;
    };
    const primeira = renderHook(() => useAsyncData(depoisDeEsperar, []));
    await waitFor(() => expect(primeira.result.current.data).toBe("primeiro"));
    primeira.unmount();

    const volta = renderHook(() => useAsyncData(depoisDeEsperar, []));
    expect(volta.result.current.loading).toBe(true);
    expect(volta.result.current.data).toBeNull();
    await waitFor(() => expect(volta.result.current.data).toBe("primeiro"));
  });

  it("uma resposta lenta que chega depois de uma rápida não volta atrás", async () => {
    let soltarLenta: (v: string) => void = () => {};
    const lenta = new Promise<string>((resolve) => {
      soltarLenta = resolve;
    });
    const leituras: Record<string, () => Promise<string>> = {
      lenta: () => lenta,
      rapida: () => Promise.resolve("rápida"),
    };

    const { result, rerender } = renderHook(({ k }) => useAsyncData(leituras[k], [k]), { initialProps: { k: "lenta" } });
    rerender({ k: "rapida" });
    await waitFor(() => expect(result.current.data).toBe("rápida"));

    await act(async () => {
      soltarLenta("lenta");
      await lenta;
    });
    expect(result.current.data).toBe("rápida");
    expect(result.current.loading).toBe(false);
  });
});
