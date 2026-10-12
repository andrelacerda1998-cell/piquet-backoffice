/**
 * @vitest-environment node
 *
 * Dar como falta cobra a penalização ao técnico: exige motivo, e o motivo fica
 * guardado ANTES de o Laravel cobrar -- e sai outra vez se o Laravel falhar.
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
      throw new ApiError("Esta falta já foi registada.", 409);
    }
    return { service: { id: 282, penalty: 2000 } };
  }),
}));

import { POST } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";

const declarar = (corpo: unknown) =>
  POST(new Request("http://x/api/vendor-no-shows/282/declare", {
    method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({ id: "282" }) });

beforeEach(() => {
  resetMock(); _clearStaffCache(); chamadas.length = 0; falhar = false;
  setTable("acoes_da_equipa", { data: { id: "reg-1" }, error: null });
});

describe("POST /api/vendor-no-shows/:id/declare", () => {
  it("sem motivo não cobra nem chama o Laravel", async () => {
    for (const corpo of [{}, { motivo: "" }, { motivo: "ok" }]) {
      const r = await declarar(corpo);
      expect(r.status).toBe(422);
    }
    expect(chamadas).toEqual([]);
  });

  it("com motivo, regista e declara a falta", async () => {
    const r = await declarar({ motivo: "O cliente ligou: ninguém apareceu às 14:00" });
    expect(r.status).toBe(200);
    expect(chamadas).toEqual(["/v1/admin/services/282/vendor-no-show"]);
  });

  it("sem a tabela do registo, não cobra", async () => {
    setTable("acoes_da_equipa", { data: null, error: { code: "42P01", message: 'relation "acoes_da_equipa" does not exist' } });
    const r = await declarar({ motivo: "O cliente ligou: ninguém apareceu às 14:00" });
    expect(r.status).toBe(503);
    expect(chamadas).toEqual([]);
  });

  it("se o Laravel recusar (falta já registada), devolve o erro dele", async () => {
    falhar = true;
    const r = await declarar({ motivo: "O cliente ligou: ninguém apareceu às 14:00" });
    expect(r.status).toBe(409);
  });
});
