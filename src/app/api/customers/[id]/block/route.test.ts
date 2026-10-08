/**
 * @vitest-environment node
 *
 * Bloquear um cliente exige motivo, e o motivo fica guardado ANTES de o
 * Laravel bloquear -- e sai outra vez se o Laravel falhar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const chamadas: string[] = [];
let falhar = false;
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string) => {
    chamadas.push(caminho);
    if (falhar) {
      const { ApiError } = await import("@/services/http");
      throw new ApiError("Cliente não encontrado.", 404);
    }
    return { id: 412, blocked_at: "2026-10-08T15:00:00Z" };
  }),
}));

import { PUT } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";

const bloquear = (corpo: unknown) =>
  PUT(new Request("http://x/api/customers/412/block", {
    method: "PUT", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: "412" }) });

beforeEach(() => {
  resetMock(); _clearStaffCache(); chamadas.length = 0; falhar = false;
  setTable("acoes_da_equipa", { data: { id: "reg-1" }, error: null });
});

describe("PUT /api/customers/:id/block", () => {
  it("sem motivo não bloqueia nem chama o Laravel", async () => {
    for (const corpo of [{}, { motivo: "" }, { motivo: "ok" }]) {
      const r = await bloquear(corpo);
      expect(r.status).toBe(422);
    }
    expect(chamadas).toEqual([]);
  });

  it("com motivo, regista e bloqueia", async () => {
    const r = await bloquear({ motivo: "Três pagamentos recusados seguidos" });
    expect(r.status).toBe(200);
    expect(chamadas).toEqual(["/v1/admin/customers/412/block"]);
  });

  it("sem a tabela do registo, não bloqueia", async () => {
    setTable("acoes_da_equipa", { data: null, error: { code: "42P01", message: 'relation "acoes_da_equipa" does not exist' } });
    const r = await bloquear({ motivo: "Três pagamentos recusados seguidos" });
    expect(r.status).toBe(503);
    expect(chamadas).toEqual([]);
  });

  it("se o Laravel falhar, devolve o erro dele", async () => {
    falhar = true;
    const r = await bloquear({ motivo: "Três pagamentos recusados seguidos" });
    expect(r.status).toBe(404);
  });
});
