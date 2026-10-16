/**
 * @vitest-environment node
 *
 * Criar uma campanha de push: segue para o Laravel só com os campos da
 * campanha (nada de "is_active": nasce desligada) e com quem a criou.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, mockState, resetMock } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const pedidos: Array<{ caminho: string; opts?: Record<string, unknown> }> = [];
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string, opts?: Record<string, unknown>) => {
    pedidos.push({ caminho, opts });
    return { id: 9, name: "Voltar a pedir", is_active: false, rascunho: true };
  }),
}));

import { POST } from "./route";
import { _clearStaffCache } from "../../_lib/handler";

beforeEach(() => {
  resetMock(); _clearStaffCache();
  pedidos.length = 0;
  mockState.tables.staff = { data: { role: "marketing", email: "rita@piquet.pt", name: "Rita Sá" } };
});

describe("POST /api/marketing/push-campaigns", () => {
  it("cria o rascunho sem deixar passar o is_active, e diz quem o criou", async () => {
    const r = await POST(new Request("http://x/api/marketing/push-campaigns", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ name: "Voltar a pedir", title: { "pt-pt": "Olá", en: "" }, target_type: "customer", is_active: true }),
    }), { params: Promise.resolve({}) });

    expect(r.status).toBe(201);
    expect(pedidos[0]).toMatchObject({ caminho: "/v1/admin/notification-campaigns", opts: { method: "POST", staff: { email: "rita@piquet.pt" } } });
    expect(pedidos[0].opts?.body).not.toHaveProperty("is_active");
  });
});
