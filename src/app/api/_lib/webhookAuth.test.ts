import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { verificarChave } from "./webhookAuth";

describe("verificarChave", () => {
  it("aceita quando a chave bate certo", () => {
    expect(verificarChave("abc", "abc", "X")).toEqual({ ok: true });
  });

  it("RECUSA quando a env não está definida (falha fechado)", () => {
    // O comportamento antigo aceitava tudo neste caso.
    const r = verificarChave("qualquer-coisa", undefined, "OUTLOOK_WEBHOOK_KEY");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toContain("OUTLOOK_WEBHOOK_KEY");
  });

  it("recusa env vazia como se não existisse", () => {
    expect(verificarChave("x", "", "X").ok).toBe(false);
  });

  it("recusa pedido sem chave", () => {
    expect(verificarChave(null, "abc", "X").ok).toBe(false);
    expect(verificarChave("", "abc", "X").ok).toBe(false);
  });

  it("recusa chave errada", () => {
    expect(verificarChave("errada", "abc", "X").ok).toBe(false);
  });
});
