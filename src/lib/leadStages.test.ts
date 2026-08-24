import { describe, it, expect } from "vitest";
import {
  LEAD_STAGE_IDS, normalizeLeadStage, isLeadStage, LEAD_STAGES_SEM_RECEITA,
} from "./leadStages";

describe("normalizeLeadStage", () => {
  it("devolve os estados do funil tal como estão", () => {
    for (const id of LEAD_STAGE_IDS) expect(normalizeLeadStage(id)).toBe(id);
  });

  it("'reembolsado' sobrevive à leitura", () => {
    // O bug: a lista da leitura não o incluía, devolvia "nao_iniciado", e o
    // utilizador via o estado voltar a "Novo" depois de o mudar.
    expect(normalizeLeadStage("reembolsado")).toBe("reembolsado");
  });

  it("traduz os estados antigos de marketing", () => {
    expect(normalizeLeadStage("perdido")).toBe("recusado");
    expect(normalizeLeadStage("convertido")).toBe("concluido");
    expect(normalizeLeadStage("novo")).toBe("nao_iniciado");
    expect(normalizeLeadStage("contactado")).toBe("aguarda_resposta");
    expect(normalizeLeadStage("qualificado")).toBe("orcamento_aceite");
  });

  it("'orcamento_enviado' (estado retirado do funil) vira 'aguarda_resposta'", () => {
    // Saiu em 22/08 por ser o mesmo que esperar pela resposta do cliente. Os
    // pedidos que lá estavam não podem cair no fallback "Novo" — isso apagava
    // o trabalho já feito.
    expect(normalizeLeadStage("orcamento_enviado")).toBe("aguarda_resposta");
  });

  it("valor desconhecido, nulo ou vazio cai em 'nao_iniciado'", () => {
    expect(normalizeLeadStage("qualquer_coisa")).toBe("nao_iniciado");
    expect(normalizeLeadStage(null)).toBe("nao_iniciado");
    expect(normalizeLeadStage(undefined)).toBe("nao_iniciado");
    expect(normalizeLeadStage("")).toBe("nao_iniciado");
  });
});

describe("isLeadStage", () => {
  it("aceita os estados do funil e recusa o resto", () => {
    expect(isLeadStage("reembolsado")).toBe(true);
    expect(isLeadStage("concluido")).toBe(true);
    expect(isLeadStage("perdido")).toBe(false); // legado: traduz-se, não se grava
    expect(isLeadStage(null)).toBe(false);
    expect(isLeadStage(42)).toBe(false);
  });
});

describe("LEAD_STAGES_SEM_RECEITA", () => {
  it("cobre recusado e reembolsado, e mais nada", () => {
    expect(LEAD_STAGES_SEM_RECEITA).toEqual(["recusado", "reembolsado"]);
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
