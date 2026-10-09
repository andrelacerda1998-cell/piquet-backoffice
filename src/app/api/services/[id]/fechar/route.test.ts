/**
 * @vitest-environment node
 *
 * As ações do pedido: fechar (cobra) e desistir pedem motivo, gravado antes;
 * despachar e tentar cobrar não. Um Laravel sem as rotas diz o que falta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock, setTable, mockState } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const chamadas: Array<{ caminho: string; body: unknown }> = [];
let erro: number | null = null;
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string, opts?: { body?: unknown }) => {
    chamadas.push({ caminho, body: opts?.body });
    if (erro) {
      const { ApiError } = await import("@/services/http");
      throw new ApiError("Laravel diz que não.", erro);
    }
    return { id: "282", status: "Closed", payment_status: "Paid" };
  }),
}));

import { POST as fechar } from "./route";
import { POST as despachar } from "../despachar/route";
import { _clearStaffCache } from "../../../_lib/handler";

const pedir = (rota: typeof fechar, corpo: unknown) =>
  rota(new Request(`http://x/api/services/282/${rota === fechar ? "fechar" : "despachar"}`, {
    method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: "282" }) });

beforeEach(() => {
  resetMock(); _clearStaffCache(); chamadas.length = 0; erro = null;
  setTable("acoes_da_equipa", { data: { id: "reg-1" }, error: null });
});

describe("ações do pedido", () => {
  it("fechar sem motivo não chega ao Laravel", async () => {
    expect((await pedir(fechar, {})).status).toBe(422);
    expect(chamadas).toEqual([]);
  });

  it("fechar com motivo grava o motivo e fecha", async () => {
    const r = await pedir(fechar, { motivo: "O cliente confirmou por telefone." });
    expect(r.status).toBe(200);
    expect(chamadas.map((c) => c.caminho)).toEqual(["/v1/admin/services/282/fechar"]);
    expect(mockState.inserts.find((i) => i.table === "acoes_da_equipa")?.row).toEqual(
      expect.objectContaining({ acao: "fechar_pedido", entidade: "pedido", entidade_id: "282", motivo: "O cliente confirmou por telefone." }),
    );
  });

  it("despachar passa a duração e as categorias, sem motivo", async () => {
    const r = await pedir(despachar, { minutos: 90, areas: [3, 7] });
    expect(r.status).toBe(200);
    expect(chamadas).toEqual([{ caminho: "/v1/admin/services/282/despachar", body: { minutos: 90, areas: [3, 7] } }]);
  });

  it("um Laravel sem a rota diz que falta o deploy", async () => {
    erro = 404;
    const r = await pedir(despachar, { minutos: 90, areas: [3] });
    expect(r.status).toBe(503);
    expect((await r.json()).error ?? "").toBeDefined();
  });
});
