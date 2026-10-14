import { describe, expect, it } from "vitest";
import { eixoEmEuros } from "./Charts";

describe("eixoEmEuros", () => {
  it("abaixo de mil mostra o número inteiro, sem 'k'", () => {
    expect([0, 250, 500, 750].map(eixoEmEuros)).toEqual(["0", "250", "500", "750"]);
  });
  it("a partir de mil passa a 'k', com uma casa só quando é preciso", () => {
    expect(eixoEmEuros(1000)).toBe("1k");
    expect(eixoEmEuros(1500)).toBe("1,5k");
    expect(eixoEmEuros(12000)).toBe("12k");
    expect(eixoEmEuros(-2500)).toBe("-2,5k");
  });
});
