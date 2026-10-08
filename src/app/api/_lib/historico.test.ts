/**
 * @vitest-environment node
 *
 * O withStaff regista no histórico da equipa cada escrita que corre bem --
 * e só essas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock, mockState } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

import { withStaff, _clearStaffCache } from "./handler";

const chamar = async (metodo: string, caminho: string, status = 200, params: Record<string, string> = { id: "412" }) => {
  const rota = withStaff(async () => new Response("{}", { status }));
  return rota(
    new Request(`https://piquet.test${caminho}`, { method: metodo, headers: { authorization: "Bearer t" } }),
    { params: Promise.resolve(params) },
  );
};

const registos = () => mockState.inserts.filter((i) => i.table === "acoes_da_equipa").map((i) => i.row as Record<string, unknown>);

beforeEach(() => { resetMock(); _clearStaffCache(); });

describe("histórico da equipa", () => {
  it("uma escrita que corre bem fica registada, com quem, o quê e o registo", async () => {
    await chamar("PUT", "/api/customers/412/restore");
    expect(registos()).toEqual([expect.objectContaining({
      staff_id: "staff-1", staff_email: "rodrigo@piquet.pt",
      acao: "PUT /customers/[id]/restore", entidade: "cliente", entidade_id: "412", motivo: null,
    })]);
  });

  it("uma escrita que falha não fica", async () => {
    await chamar("PUT", "/api/customers/412/restore", 500);
    expect(registos()).toEqual([]);
  });

  it("leituras, conversa interna e rotas que já gravam com motivo não se repetem", async () => {
    await chamar("GET", "/api/customers");
    await chamar("POST", "/api/team/messages", 200, {});
    await chamar("PUT", "/api/customers/412/block");
    expect(registos()).toEqual([]);
  });
});
