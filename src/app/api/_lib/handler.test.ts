import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

let perfil: string | null = "ceo";
vi.mock("@/lib/supabase/server", () => ({
  SUPABASE_ENABLED: true,
  supabaseAdmin: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: perfil ? { role: perfil, email: "x@piquet.pt" } : null }),
        }),
      }),
    }),
  }),
}));

import { withStaff, _clearStaffCache } from "./handler";

const chamar = async (metodo: string, caminho: string) => {
  const handler = vi.fn(async () => new Response("ok"));
  const rota = withStaff(handler);
  const res = await rota(
    new Request(`https://piquet.test${caminho}`, { method: metodo, headers: { authorization: "Bearer t" } }),
    { params: Promise.resolve({ id: "7" }) },
  );
  return { status: res.status, correu: handler.mock.calls.length > 0 };
};

beforeEach(() => _clearStaffCache());

describe("withStaff aplica as permissões no servidor", () => {
  it("quem pode, passa", async () => {
    perfil = "financeiro";
    expect(await chamar("POST", "/api/finance/payout-lotes/7/pagar")).toEqual({ status: 200, correu: true });
  });

  it("quem não pode recebe 403 e o handler nem corre", async () => {
    perfil = "marketing";
    expect(await chamar("POST", "/api/finance/payout-lotes/7/pagar")).toEqual({ status: 403, correu: false });
  });

  it("sem sessão de staff continua a ser 401", async () => {
    perfil = null;
    expect((await chamar("GET", "/api/finance/gmv")).status).toBe(401);
  });

  it("uma rota sem regra é recusada mesmo ao CEO", async () => {
    perfil = "ceo";
    expect(await chamar("GET", "/api/rota-nova-sem-regra")).toEqual({ status: 403, correu: false });
  });
});
