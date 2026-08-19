import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchComPrazo, TIMEOUT_PADRAO_MS } from "./fetchTimeout";

afterEach(() => vi.unstubAllGlobals());

describe("fetchComPrazo", () => {
  it("devolve a resposta quando o servidor responde", async () => {
    const resp = new Response("ok");
    vi.stubGlobal("fetch", vi.fn(async () => resp));
    expect(await fetchComPrazo("https://exemplo.pt")).toBe(resp);
  });

  it("passa um AbortSignal ao fetch", async () => {
    const spy = vi.fn(async (_u: unknown, _i?: RequestInit) => new Response("ok"));
    vi.stubGlobal("fetch", spy);
    await fetchComPrazo("https://exemplo.pt", { method: "POST" });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.method).toBe("POST");
  });

  it("converte o timeout num erro que identifica o servidor lento", async () => {
    const err = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw err; }));
    await expect(fetchComPrazo("https://googleads.googleapis.com/v26/x"))
      .rejects.toThrow("googleads.googleapis.com não respondeu em 20s");
  });

  it("deixa passar os outros erros tal como são", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("DNS falhou"); }));
    await expect(fetchComPrazo("https://exemplo.pt")).rejects.toThrow("DNS falhou");
  });

  it("o prazo por omissão é de 20 segundos", () => {
    expect(TIMEOUT_PADRAO_MS).toBe(20_000);
  });
});
