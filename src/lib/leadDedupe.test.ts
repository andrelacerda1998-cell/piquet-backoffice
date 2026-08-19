import { describe, it, expect } from "vitest";
import { eDuplicado, JANELA_MESMA_MENSAGEM_MIN, JANELA_MESMO_CONTACTO_MIN } from "./leadDedupe";

const AGORA = Date.parse("2026-08-19T12:00:00Z");
const haMin = (m: number) => new Date(AGORA - m * 60000).toISOString();

describe("eDuplicado", () => {
  it("sem leads anteriores, nunca é duplicado", () => {
    expect(eDuplicado([], "Servico: Limpeza", AGORA)).toBe(false);
  });

  it("mesma mensagem dentro de 30 min é duplicado", () => {
    expect(eDuplicado([{ created_at: haMin(5), message: "X" }], "X", AGORA)).toBe(true);
    expect(eDuplicado([{ created_at: haMin(29), message: "X" }], "X", AGORA)).toBe(true);
  });

  it("mesma mensagem passados 30 min já não é duplicado", () => {
    expect(eDuplicado([{ created_at: haMin(31), message: "X" }], "X", AGORA)).toBe(false);
  });

  it("mensagem DIFERENTE no mesmo minuto é duplicado", () => {
    // O caso real que escapou: mesmo telefone, mesmo minuto, mensagens
    // "Servico: Outro" e "Servico: Selecionar…".
    const r = eDuplicado(
      [{ created_at: haMin(0), message: "Servico: Outro · Urgencia: Normal" }],
      "Servico: Selecionar… · Urgencia: Normal",
      AGORA,
    );
    expect(r).toBe(true);
  });

  it("mensagem diferente passados 10 min já conta como pedido novo", () => {
    // A mesma pessoa pode pedir dois serviços diferentes de propósito.
    expect(eDuplicado([{ created_at: haMin(11), message: "A" }], "B", AGORA)).toBe(false);
    expect(eDuplicado([{ created_at: haMin(10), message: "A" }], "B", AGORA)).toBe(true);
  });

  it("o caso real da Marisa (5h de diferença) NÃO é duplicado", () => {
    expect(eDuplicado([{ created_at: haMin(300), message: "A" }], "B", AGORA)).toBe(false);
  });

  it("mensagem nula é tratada como vazia, sem rebentar", () => {
    expect(eDuplicado([{ created_at: haMin(2), message: null }], "", AGORA)).toBe(true);
    expect(eDuplicado([{ created_at: haMin(2) }], "", AGORA)).toBe(true);
  });

  it("um registo com data no futuro não bloqueia a inserção", () => {
    const futuro = new Date(AGORA + 60000).toISOString();
    expect(eDuplicado([{ created_at: futuro, message: "X" }], "X", AGORA)).toBe(false);
  });

  it("as janelas são as esperadas", () => {
    expect(JANELA_MESMA_MENSAGEM_MIN).toBe(30);
    expect(JANELA_MESMO_CONTACTO_MIN).toBe(10);
  });
});
