/**
 * @vitest-environment node
 *
 * Ligar uma campanha de push pede motivo e fica no histórico; desligar é um
 * clique e acontece mesmo que o histórico não grave.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, mockState, resetMock, setTable } from "@/test/supabaseMock";
import { ApiError } from "@/services/http";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const pedidos: Array<{ caminho: string; opts?: Record<string, unknown> }> = [];
let recusa: ApiError | null = null;
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string, opts?: Record<string, unknown>) => {
    pedidos.push({ caminho, opts });
    if (recusa) throw recusa;
    return { id: 7, is_active: (opts?.body as { active: boolean }).active };
  }),
}));

import { PUT } from "./route";
import { _clearStaffCache } from "../../../../_lib/handler";

const pedir = (corpo: unknown, id = "7") => PUT(new Request(`http://x/api/marketing/push-campaigns/${id}/active`, {
  method: "PUT",
  headers: { authorization: "Bearer t", "content-type": "application/json" },
  body: JSON.stringify(corpo),
}), { params: Promise.resolve({ id }) });

const registos = () => mockState.inserts.filter((i) => i.table === "acoes_da_equipa").map((i) => i.row as Record<string, unknown>);

beforeEach(() => {
  resetMock(); _clearStaffCache();
  pedidos.length = 0;
  recusa = null;
  mockState.tables.staff = { data: { role: "marketing", email: "rita@piquet.pt", name: "Rita Sá" } };
  setTable("acoes_da_equipa", { data: { id: "registo-1" }, error: null });
});

describe("ligar e desligar uma campanha de push", () => {
  it("ligar sem motivo não liga", async () => {
    const r = await pedir({ active: true });

    expect(r.status).toBe(422);
    expect(pedidos).toHaveLength(0);
    expect(registos()).toHaveLength(0);
  });

  it("ligar regista quem, porquê e para quantas pessoas, e diz ao Laravel quem é", async () => {
    const r = await pedir({ active: true, motivo: "Reativar clientes de Almada", pessoas: 412 });

    expect(r.status).toBe(200);
    expect(registos()[0]).toMatchObject({
      acao: "ligar_campanha_push", entidade: "campanha", entidade_id: "7",
      motivo: "Reativar clientes de Almada", detalhe: { pessoas: 412 }, staff_email: "rita@piquet.pt",
    });
    expect(pedidos[0].opts).toMatchObject({ method: "PUT", body: { active: true }, staff: { email: "rita@piquet.pt", nome: "Rita Sá" } });
  });

  /** O Laravel recusa com o inglês por rever: o erro chega ao ecrã tal como é. */
  it("se o Laravel recusa, devolve a recusa", async () => {
    recusa = new ApiError("Revê a tradução inglesa antes de a ligar.", 409);

    const r = await pedir({ active: true, motivo: "Reativar clientes" });

    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("tradução inglesa");
  });

  it("desligar é um clique", async () => {
    const r = await pedir({ active: false });

    expect(r.status).toBe(200);
    expect(registos()[0]).toMatchObject({ acao: "desligar_campanha_push", motivo: "Desligada no backoffice" });
  });

  /** Um travão que dependesse do histórico deixava uma campanha errada a correr. */
  it("desligar acontece mesmo que o histórico não grave; ligar não", async () => {
    setTable("acoes_da_equipa", { data: null, error: { message: "falhou" } });

    expect((await pedir({ active: false })).status).toBe(200);
    expect((await pedir({ active: true, motivo: "Reativar clientes" })).status).toBe(500);
    expect(pedidos.map((p) => (p.opts?.body as { active: boolean }).active)).toEqual([false]);
  });

  it("só o Marketing e a direção", async () => {
    for (const role of ["operacoes", "suporte", "financeiro"]) {
      _clearStaffCache();
      mockState.tables.staff = { data: { role, email: "x@piquet.pt", name: "X" } };
      expect((await pedir({ active: false })).status, role).toBe(403);
    }
    expect(pedidos).toHaveLength(0);
  });
});
