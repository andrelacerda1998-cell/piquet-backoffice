import { describe, it, expect } from "vitest";
import { dentroDaJanela, normalizarTelefone, JANELA_RESPOSTA_MS } from "./whatsappWindow";

const AGORA = Date.parse("2026-08-27T12:00:00Z");

describe("dentroDaJanela (regra das 24h da Meta)", () => {
  it("responder a quem escreveu agora é permitido", () => {
    expect(dentroDaJanela("2026-08-27T11:59:00Z", AGORA)).toBe(true);
  });

  it("mesmo à beira das 24h ainda deixa", () => {
    const quase = new Date(AGORA - JANELA_RESPOSTA_MS + 60_000).toISOString();
    expect(dentroDaJanela(quase, AGORA)).toBe(true);
  });

  it("passadas as 24h já não deixa texto livre", () => {
    const ontem = new Date(AGORA - JANELA_RESPOSTA_MS - 1000).toISOString();
    expect(dentroDaJanela(ontem, AGORA)).toBe(false);
  });

  it("sem nenhuma entrada não há janela — nunca houve conversa", () => {
    expect(dentroDaJanela(null, AGORA)).toBe(false);
  });

  it("data inválida não abre a janela", () => {
    expect(dentroDaJanela("nem-data", AGORA)).toBe(false);
  });
});

describe("normalizarTelefone", () => {
  it("um número português local ganha o indicativo 351", () => {
    expect(normalizarTelefone("912 345 678")).toBe("351912345678");
    expect(normalizarTelefone("912345678")).toBe("351912345678");
  });

  it("um número que já traz indicativo fica como está (só dígitos)", () => {
    expect(normalizarTelefone("+351 912 345 678")).toBe("351912345678");
    expect(normalizarTelefone("351912345678")).toBe("351912345678");
  });

  it("um número estrangeiro não leva o 351 à frente", () => {
    expect(normalizarTelefone("+44 20 7946 0000")).toBe("442079460000");
  });

  it("vazio devolve vazio", () => {
    expect(normalizarTelefone("")).toBe("");
    expect(normalizarTelefone("sem dígitos")).toBe("");
  });
});
