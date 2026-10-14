import { describe, it, expect } from "vitest";
import { formatNumber, formatCurrency, formatRating } from "./formatters";

describe("agrupamento dos milhares", () => {
  /**
   * O pt-PT só agrupa a partir de cinco algarismos por omissão: no mesmo
   * cartão via-se "18 420" ao lado de "5240" — o mesmo tipo de número escrito
   * de duas maneiras, o que obriga a olhar duas vezes para comparar.
   */
  it("agrupa a partir de mil", () => {
    expect(formatNumber(5240)).toMatch(/^5\s240$/);
    expect(formatNumber(1630)).toMatch(/^1\s630$/);
  });

  it("agrupa da mesma forma acima de dez mil", () => {
    expect(formatNumber(18420)).toMatch(/^18\s420$/);
    expect(formatNumber(23660)).toMatch(/^23\s660$/);
  });

  it("abaixo de mil não leva separador", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("agrupamento nos valores em euros", () => {
  it("agrupa a partir de mil, como nos números", () => {
    // Via-se "8596,72 €" ao lado de "42 296,66 €" na mesma coluna.
    expect(formatCurrency(8596.72)).toMatch(/^8\s596,72/);
    expect(formatCurrency(42296.66)).toMatch(/^42\s296,66/);
  });
});

describe("formatRating", () => {
  it("uma casa, com vírgula, sem o lixo do vírgula flutuante", () => {
    expect(formatRating(4.800000000000001)).toBe("4,8");
    expect(formatRating(4.66666)).toBe("4,7");
    expect(formatRating(5)).toBe("5,0");
  });
  it("sem avaliação, um traço", () => {
    expect(formatRating(null)).toBe("—");
    expect(formatRating(0)).toBe("—");
    expect(formatRating(Number.NaN)).toBe("—");
  });
});
