import { describe, it, expect } from "vitest";
import { agruparAlertas, LIMITE_AGRUPAMENTO } from "./alertGroups";
import type { DashboardAlert, AlertPriority } from "@/types";

const a = (id: string, priority: AlertPriority, createdAt: string, title = "Lead sem resposta há 2 dias"): DashboardAlert => ({
  id, type: "marketing", priority, title, description: "desc", createdAt,
  status: "novo", recommendedAction: "fazer algo",
});

const leads = (n: number, p: AlertPriority = "alta") =>
  Array.from({ length: n }, (_, i) => a(`lead-sem-resposta-${i}`, p, `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00Z`));

describe("agruparAlertas", () => {
  it("deixa passar intocado o que está abaixo do limite", () => {
    const entrada = leads(LIMITE_AGRUPAMENTO - 1);
    expect(agruparAlertas(entrada).map((x) => x.id)).toEqual(entrada.map((x) => x.id));
  });

  it("resume numa linha só a partir do limite", () => {
    const r = agruparAlertas(leads(10));
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("grupo-leads-sem-resposta");
    expect(r[0].title).toBe("10 contactos sem resposta");
  });

  it("herda a urgência mais alta — agrupar não pode suavizar o pior caso", () => {
    const entrada = [...leads(4, "media"), a("lead-sem-resposta-x", "critica", "2026-08-20T10:00:00Z")];
    expect(agruparAlertas(entrada)[0].priority).toBe("critica");
  });

  it("guarda a data e o exemplo do mais antigo", () => {
    const r = agruparAlertas(leads(5));
    expect(r[0].createdAt).toBe("2026-08-01T10:00:00Z");
    expect(r[0].description).toContain("O mais antigo");
  });

  it("não mistura famílias diferentes", () => {
    const entrada = [...leads(5), ...Array.from({ length: 5 }, (_, i) =>
      a(`imposto-vencido-IVA-${i}`, "critica", "2026-07-19T00:00:00Z", "IVA com prazo ultrapassado"))];
    const ids = agruparAlertas(entrada).map((x) => x.id);
    expect(ids).toContain("grupo-leads-sem-resposta");
    expect(ids).toContain("grupo-impostos-vencidos");
    expect(ids).toHaveLength(2);
  });

  it("mantém os alertas que não pertencem a nenhuma família", () => {
    const entrada = [...leads(5), a("kyc-fila", "media", "2026-08-24T10:00:00Z")];
    expect(agruparAlertas(entrada).map((x) => x.id)).toContain("kyc-fila");
  });

  it("aponta para a lista e não para um registo — um grupo não tem entityId", () => {
    const g = agruparAlertas(leads(5))[0];
    expect(g.entityType).toBe("leads");
    expect(g.entityId).toBeUndefined();
  });

  it("devolve o mais urgente primeiro", () => {
    const entrada = [
      a("kyc-fila", "media", "2026-08-01T00:00:00Z"),
      ...Array.from({ length: 5 }, (_, i) => a(`imposto-vencido-${i}`, "critica", "2026-07-19T00:00:00Z")),
    ];
    expect(agruparAlertas(entrada)[0].priority).toBe("critica");
  });

  it("o id do grupo é estável — é dele que depende o adiar", () => {
    expect(agruparAlertas(leads(5))[0].id).toBe(agruparAlertas(leads(9))[0].id);
  });
});

import { umPorPedido } from "./alertGroups";

describe("umPorPedido — uma linha por pedido", () => {
  const a = (id: string, priority: DashboardAlert["priority"], title: string, entityId = "282"): DashboardAlert => ({
    id, type: "operacional", priority, title, description: "Marta · Lisboa", createdAt: "2026-10-12T10:00:00Z",
    status: "novo", recommendedAction: "Ligar", entityType: "pedido", entityId,
  });

  it("fica o mais urgente, com os outros motivos na descrição", () => {
    const r = umPorPedido([
      a("pedido-prazo_esgotado-282", "alta", "Pedido #282: o prazo acabou"),
      a("falta-282", "critica", "Possível falta no pedido #282"),
      a("perdido-300", "alta", "Pedido #300 ficou sem técnico", "300"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["falta-282", "perdido-300"]);
    expect(r[0].description).toContain("também: o prazo acabou");
  });

  it("alertas que não são de pedidos não se tocam", () => {
    const lead = { ...a("lead-1", "alta", "Lead nova"), entityType: "lead", entityId: "1" };
    expect(umPorPedido([lead])).toEqual([lead]);
  });
});
