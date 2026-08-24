import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Tamanho mínimo de letra: 11px.
 *
 * Havia texto a 10px espalhado por 32 sítios — rótulos de variação, contadores,
 * legendas dentro de cartões. Num backoffice que se usa o dia todo, e agora
 * também no telemóvel, 10px é abaixo do que se lê sem esforço. O 11px fica
 * como piso, que mantém a densidade sem obrigar a aproximar a cara do ecrã.
 */
function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return ficheiros(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("tamanho mínimo de letra", () => {
  it("não há texto abaixo de 11px", () => {
    const infratores = ficheiros("src")
      .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
      .flatMap((f) => {
        const m = readFileSync(f, "utf8").match(/text-\[(\d+)px\]/g) ?? [];
        return m.filter((c) => Number(c.match(/\d+/)![0]) < 11).map((c) => `${f}: ${c}`);
      });
    expect(infratores).toEqual([]);
  });
});
