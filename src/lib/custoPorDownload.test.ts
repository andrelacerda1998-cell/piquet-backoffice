import { describe, it, expect } from "vitest";
import { alvoDaCampanha, custoPorDownload } from "./custoPorDownload";

describe("alvoDaCampanha", () => {
  it("reconhece as campanhas reais de instalação", () => {
    expect(alvoDaCampanha("[PT] - [Google Play] - Clientes - Download App Android")).toBe("cliente");
    expect(alvoDaCampanha("[PT] - [Google Play] - Técnicos - Download App Android")).toBe("profissional");
    expect(alvoDaCampanha("[PIQUET APP] - [ALCANCE] - App clientes")).toBe("cliente");
  });

  it("lê 'técnicos' com e sem acento", () => {
    // Os nomes reais vêm escritos das duas maneiras.
    expect(alvoDaCampanha("Tecnicos - Android")).toBe("profissional");
    expect(alvoDaCampanha("Técnicos - Android")).toBe("profissional");
  });

  it("não inventa quando o nome não diz o público", () => {
    // A maior campanha de todas (831 €) é esta. Atribuí-la à app cliente só
    // porque diz "App" dava um custo por download bonito e falso.
    expect(alvoDaCampanha("[PT] - [PMAX] - Piquet App - Tráfego Site")).toBeNull();
    expect(alvoDaCampanha("Leads - LP")).toBeNull();
    expect(alvoDaCampanha("[2026] - [07] - [PIQUET APP] - [ENGAGEMENT] - Instagram")).toBeNull();
  });

  it("técnicos ganha a clientes quando aparecem os dois", () => {
    // "Técnicos para clientes de Lisboa" é uma campanha de recrutamento.
    expect(alvoDaCampanha("Técnicos que servem clientes de Lisboa")).toBe("profissional");
  });
});

describe("custoPorDownload", () => {
  // Os números reais de produção a 30/09/2026.
  const gastos = [
    { campanha: "[PT] - [PMAX] - Piquet App - Tráfego Site", gasto: 831.45 },
    { campanha: "[PT] - [Google Play] - Clientes - Download App Android", gasto: 96.07 },
    { campanha: "[PIQUET APP] - [ALCANCE] - App clientes", gasto: 53.05 },
    { campanha: "[PT] - [Google Play] - Técnicos - Download App Android", gasto: 7.26 },
    { campanha: "Leads - LP", gasto: 28.6 },
  ];
  const downloads = { cliente: 412, profissional: 105 };

  it("divide o gasto de cada app pelas instalações dessa app", () => {
    const r = custoPorDownload(gastos, downloads);
    const cliente = r.apps.find((a) => a.app === "cliente")!;
    expect(cliente.gastoAtribuido).toBeCloseTo(149.12, 2);
    expect(cliente.custoPorDownload).toBeCloseTo(0.362, 3);
  });

  it("conta à parte o que não se consegue atribuir", () => {
    const r = custoPorDownload(gastos, downloads);
    expect(r.gastoNaoAtribuido).toBeCloseTo(860.05, 2);
    expect(r.gastoTotal).toBeCloseTo(1016.43, 2);
  });

  it("diz que fatia do investimento entrou nas contas", () => {
    // 15% neste caso. É este número que impede alguém de olhar para
    // "0,36 € por download" e achar que já sabe o que custa crescer.
    const r = custoPorDownload(gastos, downloads);
    expect(r.cobertura).toBeCloseTo(0.154, 3);
  });

  it("dá também o número pessimista, com tudo incluído", () => {
    // O dinheiro do PMAX saiu da mesma conta. 1016,43 / 517.
    const r = custoPorDownload(gastos, downloads);
    expect(r.custoPorDownloadTudoIncluido).toBeCloseTo(1.966, 3);
  });

  it("sem instalações não há custo, e não é infinito", () => {
    // Dividir por zero daria Infinity, que num cartão aparece como "∞ €".
    const r = custoPorDownload(gastos, { cliente: 0, profissional: 0 });
    expect(r.apps[0].custoPorDownload).toBeNull();
    expect(r.custoPorDownloadTudoIncluido).toBeNull();
  });

  it("sem investimento nenhum não rebenta", () => {
    const r = custoPorDownload([], downloads);
    expect(r.gastoTotal).toBe(0);
    expect(r.cobertura).toBe(0);
    expect(r.apps[0].custoPorDownload).toBe(0);
  });

  it("uma app sem campanhas suas tem custo zero, não nulo", () => {
    // Zero é verdade: não se gastou nada nela. Nulo seria "não se sabe".
    const r = custoPorDownload(
      [{ campanha: "Clientes - Android", gasto: 50 }],
      downloads,
    );
    expect(r.apps.find((a) => a.app === "profissional")!.custoPorDownload).toBe(0);
  });
});
