import { describe, it, expect } from "vitest";
import {
  LEAD_STAGE_IDS, normalizeLeadStage, isLeadStage, LEAD_STAGES_SEM_RECEITA,
} from "./leadStages";

describe("normalizeLeadStage", () => {
  it("devolve os estados do funil tal como estão", () => {
    for (const id of LEAD_STAGE_IDS) expect(normalizeLeadStage(id)).toBe(id);
  });

  /*
    A lista de cinco estados é de 08/09. Estes nomes antigos continuam a ter de
    ser lidos: as linhas foram convertidas, mas um pedido gravado por uma
    versão anterior, ou reposto de uma cópia de segurança, ainda chega assim.
    Cair no fallback apagava o trabalho já feito.
  */
  it("lê os estados do CRM anterior", () => {
    expect(normalizeLeadStage("nao_iniciado")).toBe("novo");
    expect(normalizeLeadStage("aguarda_resposta")).toBe("a_procurar");
    expect(normalizeLeadStage("orcamento_enviado")).toBe("a_procurar");
    expect(normalizeLeadStage("orcamento_aceite")).toBe("com_tecnico");
    expect(normalizeLeadStage("recusado")).toBe("perdido");
  });

  /*
    O reembolso deixou de ser estado do pedido — é um acontecimento financeiro,
    tratado no Financeiro. Para o pedido, só interessa que não deu receita.
  */
  it("'reembolsado' passa a 'perdido'", () => {
    expect(normalizeLeadStage("reembolsado")).toBe("perdido");
  });

  it("traduz os estados da primeira geração", () => {
    expect(normalizeLeadStage("convertido")).toBe("concluido");
    expect(normalizeLeadStage("contactado")).toBe("a_procurar");
    expect(normalizeLeadStage("qualificado")).toBe("com_tecnico");
  });

  it("valor desconhecido, nulo ou vazio cai em 'novo'", () => {
    expect(normalizeLeadStage("qualquer_coisa")).toBe("novo");
    expect(normalizeLeadStage(null)).toBe("novo");
    expect(normalizeLeadStage(undefined)).toBe("novo");
    expect(normalizeLeadStage("")).toBe("novo");
  });
});

describe("isLeadStage", () => {
  it("aceita os estados do funil e recusa o resto", () => {
    expect(isLeadStage("com_tecnico")).toBe(true);
    expect(isLeadStage("concluido")).toBe(true);
    expect(isLeadStage("reembolsado")).toBe(false); // legado: traduz-se, não se grava
    expect(isLeadStage(null)).toBe(false);
    expect(isLeadStage(42)).toBe(false);
  });
});

describe("LEAD_STAGES_SEM_RECEITA", () => {
  it("é só o perdido", () => {
    expect(LEAD_STAGES_SEM_RECEITA).toEqual(["perdido"]);
    expect(LEAD_STAGES_SEM_RECEITA).not.toContain("concluido");
  });
});

describe("a interface cobre todos os estados", () => {
  it("cada estado do funil tem um rótulo em LEAD_STAGES", async () => {
    // Esta é a rede que faltava: o bug do "reembolsado" foi exatamente uma
    // lista de estados a divergir de outra. Se alguém acrescentar um id sem
    // rótulo (ou ao contrário), este teste falha antes de chegar ao ecrã.
    const { LEAD_STAGES } = await import("@/services/extrasService");
    const comRotulo = LEAD_STAGES.map((s) => s.id).sort();
    expect(comRotulo).toEqual([...LEAD_STAGE_IDS].sort());
  });
});
