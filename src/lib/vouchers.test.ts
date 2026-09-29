import { describe, it, expect } from "vitest";
import { toVoucher, paraLaravel, queixaDe, type VoucherLaravel } from "@/lib/vouchers";

const BASE: VoucherLaravel = {
  id: 7,
  name: "OUTONO20",
  start_date: "2026-10-01",
  end_date: "2026-10-31",
  max_uses: 2,
  discount_percentage: 20,
  valid_services: ["immediate", "scheduled"],
  is_active: true,
  is_valid: true,
  usages_count: 3,
};

describe("toVoucher", () => {
  it("converte o desconto dado de cêntimos para euros", () => {
    // 2000 cêntimos = 20,00 €. Ler isto como 2000 € seria o erro do starts_from.
    const v = toVoucher({ ...BASE, discount_total_cents: 2000 });
    expect(v.discountGiven).toBe(20);
  });

  it("zero cêntimos é zero euros, não 'desconhecido'", () => {
    const v = toVoucher({ ...BASE, discount_total_cents: 0 });
    expect(v.discountGiven).toBe(0);
  });

  it("sem o campo do backend, o desconto dado é desconhecido e não zero", () => {
    // Antes do PR dos totais o Laravel não manda o campo. Mostrar 0,00 € aí
    // afirmava que o voucher não custou nada, que é outra coisa.
    const v = toVoucher(BASE);
    expect(v.discountGiven).toBeNull();
    expect(v.servicesCount).toBeNull();
  });

  it("o limite é por cliente, e ausente quer dizer sem limite", () => {
    expect(toVoucher(BASE).maxUsesPerCustomer).toBe(2);
    expect(toVoucher({ ...BASE, max_uses: null }).maxUsesPerCustomer).toBeNull();
  });

  it("separa 'está ligado' de 'funciona hoje'", () => {
    // Ligado mas fora das datas: is_active true, is_valid false.
    const v = toVoucher({ ...BASE, is_active: true, is_valid: false });
    expect(v.active).toBe(true);
    expect(v.usableToday).toBe(false);
  });

  it("aguenta uma lista de serviços em falta", () => {
    const v = toVoucher({ ...BASE, valid_services: undefined as unknown as string[] });
    expect(v.validServices).toEqual([]);
  });
});

describe("paraLaravel", () => {
  it("só envia o que foi mexido", () => {
    // Um PUT com o objeto todo apagaria datas que ninguém tocou.
    expect(paraLaravel({ active: false })).toEqual({ is_active: false });
  });

  it("datas vazias viram null, não string vazia", () => {
    // O Laravel valida `nullable|date`: "" rebenta com 422.
    expect(paraLaravel({ startDate: "", endDate: "" })).toEqual({ start_date: null, end_date: null });
  });

  it("limite vazio vira null (sem limite)", () => {
    expect(paraLaravel({ maxUsesPerCustomer: null })).toEqual({ max_uses: null });
  });

  it("tira espaços do código", () => {
    expect(paraLaravel({ name: "  OUTONO20 " })).toEqual({ name: "OUTONO20" });
  });
});

describe("queixaDe", () => {
  const valido = { name: "OUTONO20", discountPercentage: 20, validServices: ["immediate"] };

  it("aceita um voucher bem preenchido", () => {
    expect(queixaDe(valido, true)).toBeNull();
  });

  it("exige código", () => {
    expect(queixaDe({ ...valido, name: "   " }, true)).toMatch(/código é obrigatório/i);
  });

  it("recusa um código acima dos 30 caracteres da coluna", () => {
    expect(queixaDe({ ...valido, name: "A".repeat(31) }, true)).toMatch(/30 caracteres/);
  });

  it("recusa descontos fora de 1–100", () => {
    expect(queixaDe({ ...valido, discountPercentage: 0 }, true)).toMatch(/entre 1% e 100%/);
    expect(queixaDe({ ...valido, discountPercentage: 101 }, true)).toMatch(/entre 1% e 100%/);
  });

  it("exige pelo menos um tipo de serviço", () => {
    expect(queixaDe({ ...valido, validServices: [] }, true)).toMatch(/pelo menos um tipo/i);
  });

  it("recusa um tipo de serviço que o Laravel não conhece", () => {
    expect(queixaDe({ ...valido, validServices: ["urgente"] }, true)).toMatch(/desconhecido/i);
  });

  it("recusa um fim que não é posterior ao início", () => {
    const msg = queixaDe({ ...valido, startDate: "2026-10-10", endDate: "2026-10-10" }, true);
    expect(msg).toMatch(/posterior/);
  });

  it("numa alteração, não exige os campos que não vêm", () => {
    // PUT só com o estado: não se pode queixar de faltar o código.
    expect(queixaDe({ active: false }, false)).toBeNull();
  });

  it("numa alteração, ainda valida o que vem", () => {
    expect(queixaDe({ discountPercentage: 500 }, false)).toMatch(/entre 1% e 100%/);
  });
});
