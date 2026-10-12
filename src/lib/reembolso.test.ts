import { describe, it, expect } from "vitest";
import { valorAEnviar } from "./reembolso";

describe("valorAEnviar — sem valor, o backend devolve o total original", () => {
  it("devolver tudo de um pagamento intacto não leva valor (o backend usa o exato)", () => {
    expect(valorAEnviar(5000, 5000, 0)).toBeUndefined();
  });

  it("uma parte leva o valor", () => {
    expect(valorAEnviar(2000, 5000, 0)).toBe(2000);
  });

  it("depois de um reembolso parcial, devolver o resto leva o valor (e não o total)", () => {
    expect(valorAEnviar(3000, 5000, 2000)).toBe(3000);
  });
});
