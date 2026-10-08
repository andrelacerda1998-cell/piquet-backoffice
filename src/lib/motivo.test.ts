import { describe, it, expect } from "vitest";
import { motivoValido } from "./motivo";

describe("motivoValido", () => {
  it("recusa vazio, espaços e meias palavras", () => {
    for (const m of [undefined, null, 3, "", "   ", "ok", " sim "]) expect(motivoValido(m), String(m)).toBeNull();
  });

  it("aceita uma frase e arruma os espaços", () => {
    expect(motivoValido("  duas   faltas\nsem aviso ")).toBe("duas faltas sem aviso");
  });

  it("corta motivos enormes em 500 letras", () => {
    expect(motivoValido("x".repeat(900))?.length).toBe(500);
  });
});
