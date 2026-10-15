import { describe, it, expect } from "vitest";
import { casosDoPedido, motivoDaConversa, CONVERSAS_EM_DISPUTAS_LIGADO } from "./conversaEmDisputa";

const SEM_CASOS = { problema: null, falta: null };

describe("conversa em disputas", () => {
  /**
   * Fica desligada até as Políticas de Privacidade novas estarem em vigor. Ligar é
   * uma decisão, num PR que muda também este teste: não acontece por engano.
   */
  it("está desligada até as Políticas de Privacidade novas", () => {
    expect(CONVERSAS_EM_DISPUTAS_LIGADO).toBe(false);
  });

  it("um ticket por resolver abre a conversa; resolvido ou fechado, não", () => {
    const casos = casosDoPedido(SEM_CASOS, [
      { id: "TK-1200", assunto: "Cobrou a mais", estado: "em_curso" },
      { id: "TK-1201", assunto: "", estado: "novo" },
      { id: "TK-1202", assunto: "Já tratado", estado: "resolvido" },
      { id: "TK-1203", assunto: "Arquivado", estado: "fechado" },
    ]);

    expect(casos.map((c) => c.id)).toEqual(["ticket:TK-1200", "ticket:TK-1201"]);
    expect(casos[0].rotulo).toBe("Ticket TK-1200 · Cobrou a mais");
    expect(casos[1].rotulo).toBe("Ticket TK-1201");
  });

  /** O id segue para o Laravel, que só aceita `ticket:TK-<número>`. */
  it("um ticket com um id que não é o nosso não conta", () => {
    expect(casosDoPedido(SEM_CASOS, [{ id: "XPTO", assunto: "", estado: "novo" }])).toEqual([]);
  });

  it("o problema reportado e a falta do técnico abrem a conversa", () => {
    const casos = casosDoPedido({ problema: { em: "2026-10-15T10:00:00Z", por: "vendor", motivo: "customer_absent" }, falta: { em: "2026-10-15T11:00:00Z" } }, []);

    expect(casos).toEqual([
      { id: "problema", rotulo: "Problema reportado na app pelo técnico" },
      { id: "falta", rotulo: "Falta do técnico" },
    ]);
  });

  it("sem casos, não há nada que a abra", () => {
    expect(casosDoPedido(SEM_CASOS, [])).toEqual([]);
  });

  it("o motivo tem de ser uma frase", () => {
    expect(motivoDaConversa("ver o chat")).toBeNull();
    expect(motivoDaConversa(42)).toBeNull();
    expect(motivoDaConversa("  O cliente diz   que combinaram 60 €  ")).toBe("O cliente diz que combinaram 60 €");
    expect(motivoDaConversa("x".repeat(600))).toHaveLength(500);
  });
});
