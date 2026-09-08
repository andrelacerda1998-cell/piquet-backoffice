import { describe, it, expect } from "vitest";
import {
  LEAD_LOSS_REASONS, isLossReason, lossReasonLabel, pedeMotivo, contarMotivos,
} from "./leadLossReasons";

const l = (stage: string, loss_reason?: string | null) => ({ stage, loss_reason });

describe("motivos de perda", () => {
  it("a lista é curta o suficiente para se conseguir contar", () => {
    // Uma lista longa (ou texto livre) parece mais completa mas não se agrega.
    expect(LEAD_LOSS_REASONS.length).toBeLessThanOrEqual(8);
    expect(LEAD_LOSS_REASONS.map((r) => r.id)).toContain("outro");
  });

  it("reconhece motivos válidos e rejeita o resto", () => {
    expect(isLossReason("preco")).toBe(true);
    expect(isLossReason("inventado")).toBe(false);
    expect(isLossReason(null)).toBe(false);
    expect(isLossReason(42)).toBe(false);
  });

  it("traduz o motivo para leitura humana", () => {
    expect(lossReasonLabel("demora")).toBe("Demorámos a responder");
    expect(lossReasonLabel("desconhecido")).toBe("");
    expect(lossReasonLabel(null)).toBe("");
  });
});

describe("pedeMotivo", () => {
  it("só se pergunta o motivo onde houve perda", () => {
    expect(pedeMotivo("perdido")).toBe(true);
    expect(pedeMotivo("novo")).toBe(false);
    expect(pedeMotivo("a_procurar")).toBe(false);
    expect(pedeMotivo("com_tecnico")).toBe(false);
    expect(pedeMotivo("concluido")).toBe(false);
  });
});

describe("contarMotivos", () => {
  it("sem leads perdidas devolve lista vazia", () => {
    expect(contarMotivos([l("novo"), l("concluido")])).toEqual([]);
  });

  it("conta só as perdidas e ordena pelo mais frequente", () => {
    const r = contarMotivos([
      l("perdido", "preco"), l("perdido", "preco"), l("perdido", "demora"),
      l("concluido"), l("novo"),
    ]);
    expect(r[0]).toMatchObject({ id: "preco", total: 2, percentagem: 67 });
    expect(r[1]).toMatchObject({ id: "demora", total: 1, percentagem: 33 });
  });

  it("mostra as perdidas SEM motivo em vez de as esconder", () => {
    // Escondê-las daria a ilusão de saber mais do que se sabe. Hoje seriam
    // 100% — todas as 23 perdas da Piquet estão sem motivo registado.
    const r = contarMotivos([l("perdido"), l("perdido", "preco"), l("perdido", "lixo")]);
    const sem = r.find((x) => x.id === "sem_motivo")!;
    expect(sem.total).toBe(2); // a que não tem + a que tem um valor inválido
    expect(sem.label).toBe("Sem motivo registado");
  });

  it("as percentagens são sobre as perdidas, não sobre todas as leads", () => {
    const r = contarMotivos([l("perdido", "preco"), l("concluido"), l("concluido"), l("concluido")]);
    expect(r[0].percentagem).toBe(100);
  });

  /*
    "recusado" e "reembolsado" eram os dois estados de perda antes de 08/09.
    Continuam a aparecer em linhas antigas, mas quem lê já os traduziu para
    "perdido" -- aqui chega sempre o estado normalizado.
  */
  it("é o estado normalizado que chega aqui", () => {
    expect(contarMotivos([l("recusado", "preco")])).toEqual([]);
  });
});
