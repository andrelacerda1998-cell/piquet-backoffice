import { describe, it, expect } from "vitest";
import { nomeDoServico, podeSerCancelado } from "./nomeDoServico";

describe("nomeDoServico", () => {
  it("usa o tipo de serviço quando existe", () => {
    expect(nomeDoServico({ serviceName: "Reparar uma torneira", categoryName: "Canalização" })).toBe("Reparar uma torneira");
  });

  it("num personalizado mostra as categorias que a Piquet lhe deu", () => {
    expect(nomeDoServico({ serviceName: "" }, { categorias: ["Canalização", "Eletricidade"] })).toBe("Personalizado · Canalização, Eletricidade");
    expect(nomeDoServico({ serviceName: null }, { categorias: [] })).toBe("Personalizado");
  });

  it("sem tipo cai na categoria e, sem nada, diz que não há nome", () => {
    expect(nomeDoServico({ serviceName: " ", categoryName: "Limpeza" })).toBe("Limpeza");
    expect(nomeDoServico({ serviceName: "", categoryName: "" })).toBeNull();
  });
});

describe("podeSerCancelado", () => {
  it("só antes de o trabalho começar", () => {
    for (const e of ["PendingReview", "Matching", "AwaitingPayment", "Pending3DS", "Pending", "Scheduled", "Accepted"]) {
      expect(podeSerCancelado(e)).toBe(true);
    }
    for (const e of ["Arrived", "Finished", "ClosedPendingPayment", "Closed", "Canceled", null, undefined]) {
      expect(podeSerCancelado(e)).toBe(false);
    }
  });
});
