/**
 * @vitest-environment node
 *
 * Cancelar pela Piquet: devolve dinheiro ao cliente, por isso pede motivo,
 * gravado com o autor antes de chegar ao Laravel. Quando o Laravel recusa (o
 * pedido já começou), a frase dele chega à equipa tal e qual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock, setTable, mockState } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const chamadas: string[] = [];
let recusa: { mensagem: string; status: number } | null = null;
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string) => {
    chamadas.push(caminho);
    if (recusa) {
      const { ApiError } = await import("@/services/http");
      throw new ApiError(recusa.mensagem, recusa.status);
    }
    return { id: "44", status: "Canceled", payment_status: "Refunded" };
  }),
}));

import { POST as cancelar } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";

const pedir = (corpo: unknown) =>
  cancelar(new Request("http://x/api/services/44/cancelar", {
    method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: "44" }) });

beforeEach(() => {
  resetMock(); _clearStaffCache(); chamadas.length = 0; recusa = null;
  setTable("acoes_da_equipa", { data: { id: "reg-1" }, error: null });
});

describe("cancelar um pedido", () => {
  it("sem motivo não chega ao Laravel", async () => {
    expect((await pedir({})).status).toBe(422);
    expect(chamadas).toEqual([]);
  });

  it("com motivo grava quem e porquê, e cancela", async () => {
    const r = await pedir({ motivo: "Pedido parado desde fevereiro; cliente já não precisa." });
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({ id: "44", status: "Canceled", payment_status: "Refunded" });
    expect(chamadas).toEqual(["/v1/admin/services/44/cancelar"]);
    expect(mockState.inserts.find((i) => i.table === "acoes_da_equipa")?.row).toEqual(
      expect.objectContaining({ acao: "cancelar_pedido", entidade: "pedido", entidade_id: "44" }),
    );
  });

  it("um pedido que já começou: a frase do Laravel chega tal e qual", async () => {
    recusa = { mensagem: "O técnico já está no local: com trabalho começado, isto não se cancela daqui.", status: 409 };
    const r = await pedir({ motivo: "O cliente pediu para cancelar." });
    expect(r.status).toBe(409);
    expect(JSON.stringify(await r.json())).toContain("O técnico já está no local");
  });
});
