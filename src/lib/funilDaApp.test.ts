import { describe, it, expect } from "vitest";
import { passoDoFunil, avisosDoFunil, maiorQuebra, duracaoCurta } from "./funilDaApp";

/** O funil guardado no Mixpanel em outubro de 2026 (id 90327528). */
const FUNIL_ATUAL = [
  "app_opened", "category_viewed", "service_viewed", "guest_address_submitted", "technician_list_viewed",
  "technician_selected", "sms_verified", "checkout_started", "checkout_input_filled", "service_confirmed",
];

describe("passoDoFunil", () => {
  it("todos os passos do funil atual têm nome e explicação em português", () => {
    for (const evento of FUNIL_ATUAL) {
      const p = passoDoFunil(evento);
      expect(p.nome, evento).not.toMatch(/_/);
      expect(p.explicacao.length, evento).toBeGreaterThan(20);
      expect(p.explicacao, evento).not.toContain("ainda sem explicação");
    }
  });

  it("um evento desconhecido mostra-se legível, sem partir", () => {
    expect(passoDoFunil("cart_booking_flow_started").nome).toBe("Cart booking flow started");
    expect(passoDoFunil("cart_booking_flow_started").explicacao).toContain("cart_booking_flow_started");
  });
});

describe("avisosDoFunil", () => {
  it("o funil atual: SMS antes do pagamento (ordem trocada) e passos só de convidados", () => {
    const avisos = avisosDoFunil(FUNIL_ATUAL);
    expect(avisos.map((a) => a.tom)).toEqual(["atencao", "info"]);
    expect(avisos[0].texto).toContain("trocando a ordem");
  });

  it("com a ordem corrigida, fica só o aviso dos convidados", () => {
    const corrigido = [...FUNIL_ATUAL];
    corrigido.splice(6, 2, "checkout_started", "sms_verified");
    expect(avisosDoFunil(corrigido).map((a) => a.tom)).toEqual(["info"]);
  });

  it("sem passos de convidados nem ordem trocada, nenhum aviso", () => {
    expect(avisosDoFunil(["app_opened", "service_viewed", "checkout_started", "service_confirmed"])).toEqual([]);
  });
});

describe("maiorQuebra", () => {
  it("escolhe a maior perda em pessoas, não em percentagem", () => {
    // 100→40 perde 60 (60%); 4→1 perde 3 (75%): a notícia é a primeira.
    expect(maiorQuebra([100, 40, 4, 1])).toEqual({ indice: 1, perdidos: 60, fracao: 0.6 });
  });

  it("sem ninguém, não há quebra", () => {
    expect(maiorQuebra([0, 0, 0])).toBeNull();
    expect(maiorQuebra([5])).toBeNull();
  });
});

describe("duracaoCurta", () => {
  it("escolhe a unidade que se lê", () => {
    expect(duracaoCurta(42)).toBe("42 s");
    expect(duracaoCurta(180)).toBe("3 min");
    expect(duracaoCurta(2 * 3600)).toBe("2 h");
    expect(duracaoCurta(86400)).toBe("24 h");
    expect(duracaoCurta(4 * 86400)).toBe("4 dias");
  });
});
