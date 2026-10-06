import { describe, it, expect } from "vitest";
import { contarExecutadosEAgendados } from "./contagemServicos";

/** Outubro de 2026, como a rota o pede: início incluído, fim excluído. */
const OUT = ["2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"] as const;

type S = Parameters<typeof contarExecutadosEAgendados>[0][number];
const s = (status: S["status"], extra: Partial<S> = {}): S => ({ status, ...extra });

describe("contarExecutadosEAgendados", () => {
  it("conta os concluídos pela data de conclusão", () => {
    const r = contarExecutadosEAgendados([
      s("concluido", { completedAt: "2026-10-05T10:00:00Z" }),
      s("concluido", { completedAt: "2026-09-30T23:59:00Z" }), // mês anterior
      s("concluido", { completedAt: "2026-11-01T00:00:00Z" }), // fim é excluído
    ], ...OUT);

    expect(r.executados).toBe(1);
  });

  it("conta os agendados pelo dia marcado, que vem do Laravel sem fuso", () => {
    const r = contarExecutadosEAgendados([
      s("agendado", { scheduledAt: "2026-10-12 14:00" }),
      s("tecnico_encontrado", { scheduledAt: "2026-10-31" }),
      s("agendado", { scheduledAt: "2026-11-01 09:00" }), // mês seguinte
    ], ...OUT);

    expect(r.agendados).toBe(2);
  });

  /** O mesmo serviço não pode aparecer nas duas contas. */
  it("um concluído com data marcada conta só como executado", () => {
    const r = contarExecutadosEAgendados([
      s("concluido", { completedAt: "2026-10-12T16:00:00Z", scheduledAt: "2026-10-12 14:00" }),
    ], ...OUT);

    expect(r).toEqual({ executados: 1, agendados: 0 });
  });

  /**
   * Terminado pelo técnico mas por confirmar pelo cliente: nem executado (o
   * dinheiro ainda não entrou), nem agendado (já foi feito).
   */
  it("o trabalho por confirmar não entra em nenhuma das contas", () => {
    const r = contarExecutadosEAgendados([
      s("a_aguardar_confirmacao", { completedAt: "2026-10-12T16:00:00Z", scheduledAt: "2026-10-12 14:00" }),
      s("pagamento_por_capturar", { completedAt: "2026-10-12T16:00:00Z" }),
      s("arquivado", { scheduledAt: "2026-10-12 14:00" }),
    ], ...OUT);

    expect(r).toEqual({ executados: 0, agendados: 0 });
  });

  it("datas que não são datas não contam nem rebentam", () => {
    const r = contarExecutadosEAgendados([
      s("concluido", { completedAt: "ontem" }),
      s("agendado", { scheduledAt: "amanhã de manhã" }),
      s("concluido"),
      s("agendado"),
    ], ...OUT);

    expect(r).toEqual({ executados: 0, agendados: 0 });
  });
});
