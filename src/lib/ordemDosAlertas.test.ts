import { describe, it, expect } from "vitest";
import { compararAlertas, ordenarAlertas } from "./ordemDosAlertas";
import type { DashboardAlert, AlertPriority } from "@/types";

const alerta = (id: string, priority: AlertPriority, createdAt: string, prazo?: string): DashboardAlert => ({
  id, type: "operacional", priority, title: id, description: "", createdAt, status: "novo",
  recommendedAction: "Fazer qualquer coisa.", prazo,
});

describe("ordem dos alertas", () => {
  it("o mais urgente primeiro, seja qual for a data", () => {
    const r = ordenarAlertas([
      alerta("media-antiga", "media", "2026-10-01T09:00:00Z"),
      alerta("critica-recente", "critica", "2026-10-15T09:00:00Z"),
    ]);
    expect(r.map((a) => a.id)).toEqual(["critica-recente", "media-antiga"]);
  });

  it("dentro da mesma urgência, o que tem prazo vem à frente, e o mais curto primeiro", () => {
    const r = ordenarAlertas([
      alerta("lead-de-4-dias", "critica", "2026-10-11T09:00:00Z"),
      alerta("comeca-as-10h12", "critica", "2026-10-15T09:12:00Z", "2026-10-15T09:12:00Z"),
      alerta("comeca-as-10h07", "critica", "2026-10-15T09:07:00Z", "2026-10-15T09:07:00Z"),
    ]);
    expect(r.map((a) => a.id)).toEqual(["comeca-as-10h07", "comeca-as-10h12", "lead-de-4-dias"]);
  });

  it("sem prazo, o mais antigo primeiro", () => {
    const r = ordenarAlertas([
      alerta("recente", "alta", "2026-10-15T08:00:00Z"),
      alerta("antigo", "alta", "2026-10-13T08:00:00Z"),
    ]);
    expect(r.map((a) => a.id)).toEqual(["antigo", "recente"]);
  });

  it("uma data que não se lê vai para o fim, sem estragar a ordem", () => {
    const sem = alerta("sem-data", "alta", "não é data");
    const com = alerta("com-data", "alta", "2026-10-15T08:00:00Z");
    expect(compararAlertas(sem, sem)).toBe(0);
    expect(ordenarAlertas([sem, com]).map((a) => a.id)).toEqual(["com-data", "sem-data"]);
  });

  it("não muda a lista que recebe", () => {
    const lista = [alerta("b", "media", "2026-10-15T08:00:00Z"), alerta("a", "critica", "2026-10-15T08:00:00Z")];
    ordenarAlertas(lista);
    expect(lista.map((a) => a.id)).toEqual(["b", "a"]);
  });
});
