import { describe, it, expect } from "vitest";
import { porTecnico, SITUACAO, type FaturaPorEmitir } from "./faturasPorEmitir";

const fatura = (f: Partial<FaturaPorEmitir>): FaturaPorEmitir => ({
  service_id: 1, vendor_id: 10, vendor_name: "Rui Tavares", service_type: "Canalização",
  amount: 100, amount_for_vendor: 75, finished_at: null, dias_em_atraso: 0,
  situacao: "pronta_a_emitir", invoice_id: null,
  ...f,
});

describe("porTecnico", () => {
  it("junta as faturas de cada técnico e soma a parte dele", () => {
    const [rui] = porTecnico([
      fatura({ service_id: 1, amount_for_vendor: 75 }),
      fatura({ service_id: 2, amount_for_vendor: 30.1 }),
    ]);

    expect(rui.itens.map((i) => i.service_id)).toEqual([1, 2]);
    expect(rui.paraOTecnico).toBe(105.1);
  });

  it("os técnicos com a fatura mais atrasada vêm primeiro", () => {
    const grupos = porTecnico([
      fatura({ vendor_id: 10, dias_em_atraso: 2 }),
      fatura({ vendor_id: 20, vendor_name: "Ana", dias_em_atraso: 9 }),
    ]);

    expect(grupos.map((g) => g.vendor_id)).toEqual([20, 10]);
  });

  // O "Emitir agora" responde 409 a quem não tem conta de faturação ou AT:
  // o botão só aparece onde serve para alguma coisa.
  it("só se pode emitir quando há alguma pronta ou já iniciada", () => {
    expect(porTecnico([fatura({ situacao: "sem_at" })])[0].podeEmitir).toBe(false);
    expect(porTecnico([fatura({ situacao: "sem_conta_de_faturacao" })])[0].podeEmitir).toBe(false);
    expect(porTecnico([fatura({ situacao: "fatura_iniciada" })])[0].podeEmitir).toBe(true);
    expect(porTecnico([fatura({ situacao: "sem_at" }), fatura({ situacao: "pronta_a_emitir" })])[0].podeEmitir).toBe(true);
  });

  it("sem faturas, sem grupos", () => {
    expect(porTecnico([])).toEqual([]);
  });
});

describe("SITUACAO", () => {
  it("a AT em falta é a única que depende do técnico", () => {
    expect(Object.entries(SITUACAO).filter(([, s]) => s.deQuem === "tecnico").map(([k]) => k)).toEqual(["sem_at"]);
  });
});
