/**
 * @vitest-environment node
 *
 * Os pedidos personalizados: só esses, de todas as páginas — e sem o
 * histórico inteiro que se lia antes para nada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());
vi.mock("./../_lib/laravelServices", async (orig) => ({ ...(await orig<object>()), servicesFromLaravel: () => true }));

const pedidos: string[] = [];
let paginas: Array<Array<Record<string, unknown>>> = [];
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string) => {
    pedidos.push(caminho);
    const n = Number(new URL(`http://x${caminho}`).searchParams.get("page"));
    return { items: paginas[n - 1] ?? [], meta: { last_page: paginas.length } };
  }),
}));

import { GET } from "./route";
import { _clearStaffCache } from "../_lib/handler";

const chamar = async () => (await (await GET(new Request("http://x/api/custom-requests", { headers: { authorization: "Bearer t" } }), { params: Promise.resolve({}) })).json()).data as Array<{ id: string }>;

beforeEach(() => { resetMock(); _clearStaffCache(); pedidos.length = 0; });

describe("GET /api/custom-requests", () => {
  it("pede só os personalizados e lê todas as páginas", async () => {
    paginas = [[{ id: 1, is_custom: true }], [{ id: 2, is_custom: true }]];
    const r = await chamar();
    expect(r.map((x) => x.id)).toEqual(["1", "2"]);
    expect(pedidos.every((p) => p.includes("is_custom=1"))).toBe(true);
    expect(pedidos.some((p) => !p.includes("is_custom"))).toBe(false); // nada de ler o histórico inteiro
  });

  it("um Laravel sem o filtro devolve tudo, e filtra-se aqui", async () => {
    paginas = [[{ id: 1, is_custom: true }, { id: 2, is_custom: false }]];
    expect((await chamar()).map((x) => x.id)).toEqual(["1"]);
  });
});
