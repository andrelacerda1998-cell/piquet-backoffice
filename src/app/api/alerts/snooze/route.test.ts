/**
 * @vitest-environment node
 *
 * "Não é preciso": tira um alerta da fila de vez, com motivo e nome. Só para
 * um caso concreto -- um resumo de vários casos só se adia.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

import { POST } from "./route";
import { _clearStaffCache } from "../../_lib/handler";

const pedir = (corpo: unknown) =>
  POST(new Request("http://x/api/alerts/snooze", {
    method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(corpo),
  }), { params: Promise.resolve({}) });

beforeEach(() => {
  resetMock(); _clearStaffCache();
  setTable("alert_snoozes", { data: null, error: null });
});

describe("POST /api/alerts/snooze — não é preciso", () => {
  it("pede motivo", async () => {
    const r = await pedir({ alertId: "perdido-282", naoEPreciso: true, motivo: "ok" });
    expect(r.status).toBe(422);
  });

  it("um resumo de vários casos só se adia", async () => {
    const r = await pedir({ alertId: "grupo-leads-sem-resposta", naoEPreciso: true, motivo: "Já tratámos todos" });
    expect(r.status).toBe(422);
  });

  it("com motivo, sai da fila sem data de volta e fica com quem decidiu", async () => {
    const r = await pedir({ alertId: "perdido-282", naoEPreciso: true, motivo: "Cliente remarcou por telefone" });
    expect(r.status).toBe(200);
    // O upsert não passa pelo `insert` do mock: confirma-se pela resposta.
    expect((await r.json()).data.until).toMatch(/^9999-/);
  });

  it("adiar continua a exigir uma data no futuro", async () => {
    const r = await pedir({ alertId: "perdido-282", until: "2020-01-01T00:00:00Z" });
    expect(r.status).toBe(400);
  });
});
