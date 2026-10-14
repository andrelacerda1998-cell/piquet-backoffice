/**
 * @vitest-environment node
 *
 * Validar / retirar a AT: o que o Laravel responde chega ao ecrã tal e qual, e
 * um 404 só é "falta a rota" quando é mesmo a rota que falta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const chamadas: Array<{ caminho: string; corpo: unknown }> = [];
let resposta: () => Promise<unknown> = async () => ({ id: 7, at_valid: true, at_validated_at: "2026-10-14T15:00:00+00:00" });
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string, opts: { body?: unknown }) => {
    chamadas.push({ caminho, corpo: opts?.body });
    return resposta();
  }),
}));

import { PUT } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";
import { ApiError } from "@/services/http";

const pedir = async (corpo: unknown) => {
  const r = await PUT(new Request("http://x/api/technicians/7/at-validation", {
    method: "PUT", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: "7" }) });
  return { status: r.status, corpo: await r.json() };
};
const falha = (mensagem: string, status: number) => async () => { throw new ApiError(mensagem, status); };

beforeEach(() => {
  resetMock(); _clearStaffCache(); chamadas.length = 0;
  setTable("acoes_da_equipa", { data: { id: "reg-1" }, error: null });
  resposta = async () => ({ id: 7, at_valid: true, at_validated_at: "2026-10-14T15:00:00+00:00" });
});

describe("PUT /api/technicians/:id/at-validation", () => {
  it("valida: devolve o que o Laravel gravou", async () => {
    const r = await pedir({ valid: true });
    expect(r.status).toBe(200);
    expect(r.corpo.data.at_valid).toBe(true);
    expect(chamadas).toEqual([{ caminho: "/v1/admin/vendors/7/at-validation", corpo: { valid: true } }]);
  });

  it("retirar manda valid: false", async () => {
    await pedir({ valid: false });
    expect(chamadas[0].corpo).toEqual({ valid: false });
  });

  it("credenciais recusadas: a razão do Laravel chega tal e qual", async () => {
    resposta = falha("O InvoiceXpress recusou as credenciais da AT. Confirma com o técnico o subutilizador e a palavra-passe.", 422);
    const r = await pedir({ valid: true });
    expect(r.status).toBe(422);
    expect(r.corpo.error).toContain("recusou as credenciais");
  });

  it("técnico que já não existe: não é 'falta a rota'", async () => {
    resposta = falha("No query results for model [App\\Models\\Vendor] 7", 404);
    const r = await pedir({ valid: true });
    expect(r.status).toBe(404);
    expect(r.corpo.error).toBe("Este técnico já não existe. Atualiza a lista.");
  });

  it("rota em falta no backend: diz-o, sem fingir que gravou", async () => {
    resposta = falha("The route api/v1/admin/vendors/7/at-validation could not be found.", 404);
    expect((await pedir({ valid: true })).status).toBe(501);
    resposta = falha("Method not allowed", 405);
    expect((await pedir({ valid: true })).status).toBe(501);
  });

  it("sem a permissão de gerir técnicos nem chega ao Laravel", async () => {
    setTable("staff", { data: { role: "marketing", email: "marketing@piquet.pt" } });
    const r = await pedir({ valid: true });
    expect(r.status).toBe(403);
    expect(chamadas).toEqual([]);
  });
});
