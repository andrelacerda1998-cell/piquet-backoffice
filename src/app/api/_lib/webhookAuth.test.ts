import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createHmac } from "crypto";
import { verificarChave, verificarAssinaturaMeta } from "./webhookAuth";

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

describe("verificarAssinaturaMeta", () => {
  const segredo = "app-secret-da-meta";
  const corpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: "351900000000" }] } }] }] });
  const assinar = (b: string, s = segredo) => "sha256=" + createHmac("sha256", s).update(b).digest("hex");

  it("aceita a assinatura que a Meta calcularia", () => {
    expect(verificarAssinaturaMeta(corpo, assinar(corpo), segredo)).toEqual({ ok: true });
  });

  it("RECUSA quando o segredo não está definido (falha fechado)", () => {
    // O comportamento antigo aceitava qualquer POST anónimo neste caso.
    const r = verificarAssinaturaMeta(corpo, assinar(corpo), undefined);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toContain("WHATSAPP_APP_SECRET");
  });

  it("recusa segredo vazio como se não existisse", () => {
    expect(verificarAssinaturaMeta(corpo, assinar(corpo), "").ok).toBe(false);
  });

  it("recusa pedido sem cabeçalho de assinatura", () => {
    expect(verificarAssinaturaMeta(corpo, null, segredo).ok).toBe(false);
    expect(verificarAssinaturaMeta(corpo, "", segredo).ok).toBe(false);
  });

  it("recusa assinatura feita com outro segredo", () => {
    expect(verificarAssinaturaMeta(corpo, assinar(corpo, "outro"), segredo).ok).toBe(false);
  });

  it("recusa corpo adulterado depois de assinado", () => {
    const sig = assinar(corpo);
    const forjado = corpo.replace("351900000000", "351911111111");
    expect(verificarAssinaturaMeta(forjado, sig, segredo).ok).toBe(false);
  });

  it("recusa assinatura de tamanho errado sem rebentar", () => {
    // `timingSafeEqual` lança com buffers de tamanhos diferentes.
    expect(() => verificarAssinaturaMeta(corpo, "sha256=abc", segredo)).not.toThrow();
    expect(verificarAssinaturaMeta(corpo, "sha256=abc", segredo).ok).toBe(false);
  });
});
