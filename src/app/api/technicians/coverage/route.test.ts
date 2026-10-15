/**
 * @vitest-environment node
 *
 * A procura por cidade e os pedidos que ficam fora de todas as cidades: o
 * Laravel manda estes à parte no `metaData` (backend#192), para a lista ter só
 * cidades sem os esconder. Antes dele não vem nada, e o ecrã não inventa zero.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, resetMock } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

let resposta: { data: unknown; metaData: unknown } = { data: [], metaData: undefined };

vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequestComMeta: vi.fn(async () => resposta),
}));

import { GET } from "./route";
import { _clearStaffCache } from "@/app/api/_lib/handler";

async function ler() {
  const res = await GET(
    new Request("http://x/api/technicians/coverage", { headers: { authorization: "Bearer tok" } }),
    { params: Promise.resolve({}) },
  );
  expect(res.status).toBe(200);
  return (await res.json()).data as { cidades: Array<{ name: string }>; foraDasCidades: number | null };
}

const almada = { name: "Almada", district: "Setúbal", procura: 183, oferta: 0, ratio: 183, oferta_cidades: 3, podem_trabalhar: 0, contagem: "raio" };

beforeEach(() => { _clearStaffCache(); resetMock(); });

describe("procura por cidade", () => {
  it("passa as cidades e os pedidos fora delas", async () => {
    resposta = { data: [almada], metaData: { message: "Successfully", pedidos_fora_das_cidades: 4 } };

    const dados = await ler();

    expect(dados.cidades.map((c) => c.name)).toEqual(["Almada"]);
    expect(dados.foraDasCidades).toBe(4);
  });

  it("sem o número no metaData (backend antigo), fica null e não zero", async () => {
    resposta = { data: [almada], metaData: { message: "Successfully" } };

    expect((await ler()).foraDasCidades).toBeNull();
  });
});
