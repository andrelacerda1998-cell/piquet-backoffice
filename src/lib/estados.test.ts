import { describe, it, expect } from "vitest";
import { ESTADOS_SIMPLES, PRECISA_DE_ATENCAO, atencaoPrimeiro } from "./estados";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";

describe("estados simples", () => {
  it("cada estado técnico está em exatamente um estado simples", () => {
    const todos = ESTADOS_SIMPLES.flatMap((e) => e.statuses);
    expect([...todos].sort()).toEqual(Object.keys(SERVICE_STATUS_LABELS).sort());
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("são seis, e a reclamação não está com os recusados", () => {
    expect(ESTADOS_SIMPLES).toHaveLength(6);
    expect(ESTADOS_SIMPLES.find((e) => e.id === "cancelado")?.statuses).not.toContain("em_reclamacao");
    for (const s of PRECISA_DE_ATENCAO) expect(Object.keys(SERVICE_STATUS_LABELS)).toContain(s);
  });

  it("atenção primeiro, sem baralhar o resto", () => {
    const l = [
      { id: 1, status: "concluido" as const }, { id: 2, status: "em_reclamacao" as const },
      { id: 3, status: "agendado" as const }, { id: 4, status: "pagamento_por_capturar" as const },
    ];
    expect(atencaoPrimeiro(l).map((x) => x.id)).toEqual([2, 4, 1, 3]);
  });
});
