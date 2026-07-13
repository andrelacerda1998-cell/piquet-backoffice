import { describe, it, expect, vi, afterEach } from "vitest";
import { buildUrl, httpRequest, ApiError } from "@/services/http";

describe("buildUrl", () => {
  it("junta base + endpoint", () => {
    expect(buildUrl("http://x.pt", "/admin/bookings")).toBe("http://x.pt/admin/bookings");
  });

  it("acrescenta query params, ignorando vazios/undefined", () => {
    const url = buildUrl("http://x.pt", "/s", { page: 2, q: "", city: undefined, ok: true });
    expect(url).toContain("page=2");
    expect(url).toContain("ok=true");
    expect(url).not.toContain("q=");
    expect(url).not.toContain("city");
  });

  it("suporta base relativa (/api) devolvendo caminho+query same-origin", () => {
    expect(buildUrl("/api", "/services")).toBe("/api/services");
    const url = buildUrl("/api", "/services", { page: 3, status: "concluido" });
    expect(url.startsWith("/api/services?")).toBe(true);
    expect(url).toContain("page=3");
    expect(url).toContain("status=concluido");
    expect(url).not.toMatch(/^https?:\/\//);
  });
});

describe("httpRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devolve JSON quando ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ hello: "world" }),
    }));
    const data = await httpRequest<{ hello: string }>("http://x.pt", "/y");
    expect(data.hello).toBe("world");
  });

  it("lança ApiError com mensagem do corpo quando !ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 422, json: async () => ({ error: "Valor inválido" }),
    }));
    await expect(httpRequest("http://x.pt", "/y")).rejects.toMatchObject({
      name: "ApiError", status: 422, message: "Valor inválido",
    });
  });

  it("chama onUnauthorized e lança 401", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(httpRequest("http://x.pt", "/y", { onUnauthorized })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("normaliza falha de rede numa ApiError amigável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(httpRequest("http://x.pt", "/y")).rejects.toMatchObject({
      name: "ApiError",
      message: "Falha de ligação ao servidor.",
    });
  });

  it("serializa o body em JSON nos PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await httpRequest("http://x.pt", "/y", { method: "PUT", body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});
