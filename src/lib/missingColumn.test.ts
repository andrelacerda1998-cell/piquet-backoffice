import { describe, it, expect } from "vitest";
import { isMissingColumn } from "./missingColumn";

describe("isMissingColumn", () => {
  it("reconhece o erro do Postgres (42703)", () => {
    expect(isMissingColumn({ code: "42703", message: 'column "notes" does not exist' }, "notes")).toBe(true);
  });

  it("reconhece o erro do PostgREST (PGRST204)", () => {
    expect(isMissingColumn(
      { code: "PGRST204", message: "Could not find the 'notes' column of 'leads' in the schema cache" },
      "notes",
    )).toBe(true);
  });

  it("não confunde com outra coluna em falta", () => {
    // Importante: só se ignora o campo que sabemos estar em falta. Engolir
    // qualquer erro de coluna esconderia enganos de escrita noutros campos.
    expect(isMissingColumn({ code: "42703", message: 'column "outra" does not exist' }, "notes")).toBe(false);
  });

  it("não trata erros normais como coluna em falta", () => {
    expect(isMissingColumn({ code: "23514", message: "violates check constraint" }, "notes")).toBe(false);
    expect(isMissingColumn({ code: "23505", message: "duplicate key" }, "notes")).toBe(false);
  });

  it("aguenta valores inesperados", () => {
    expect(isMissingColumn(null, "notes")).toBe(false);
    expect(isMissingColumn(undefined, "notes")).toBe(false);
    expect(isMissingColumn("erro", "notes")).toBe(false);
    expect(isMissingColumn({}, "notes")).toBe(false);
  });
});
