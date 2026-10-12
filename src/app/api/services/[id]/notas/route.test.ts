/**
 * @vitest-environment node
 *
 * As notas internas: quem escreve fica gravado, uma nota vazia ou longa
 * demais não entra, e sem a migração a ficha não rebenta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, mockState, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

import { GET, POST } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";

const ctx = { params: Promise.resolve({ id: "282" }) };
const pedir = (metodo: "GET" | "POST", corpo?: unknown) =>
  (metodo === "GET" ? GET : POST)(new Request("http://x/api/services/282/notas", {
    method: metodo,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }), ctx);

const SEM_TABELA = { code: "42P01", message: 'relation "notas_internas" does not exist' };

beforeEach(() => {
  resetMock(); _clearStaffCache();
  mockState.tables.staff = { data: { role: "operacoes", email: "ana@piquet.pt", name: "Ana Silva" } };
});

describe("/api/services/:id/notas", () => {
  it("lista as notas com o autor", async () => {
    setTable("notas_internas", { data: [
      { id: "n1", criado_em: "2026-10-12T10:00:00Z", staff_email: "ana@piquet.pt", staff_nome: "Ana Silva", texto: "Remarcado para amanhã" },
      { id: "n2", criado_em: "2026-10-12T09:00:00Z", staff_email: "rui@piquet.pt", staff_nome: null, texto: "Cliente prefere WhatsApp" },
    ], error: null });
    const r = await pedir("GET");
    expect(r.status).toBe(200);
    const { data } = await r.json();
    expect(data.map((n: { autor: string }) => n.autor)).toEqual(["Ana Silva", "rui@piquet.pt"]);
  });

  it("sem a tabela, a lista vem vazia em vez de dar erro", async () => {
    setTable("notas_internas", { data: null, error: SEM_TABELA });
    const r = await pedir("GET");
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual([]);
  });

  it("grava a nota com quem a escreveu", async () => {
    setTable("notas_internas", { data: { id: "n3", criado_em: "2026-10-12T11:00:00Z", staff_email: "ana@piquet.pt", staff_nome: "Ana Silva", texto: "Ligou a pedir fatura" }, error: null });
    const r = await pedir("POST", { texto: "  Ligou a pedir fatura  " });
    expect(r.status).toBe(201);
    expect(mockState.inserts).toEqual([{ table: "notas_internas", row: expect.objectContaining({
      entidade: "pedido", entidade_id: "282", texto: "Ligou a pedir fatura", staff_email: "ana@piquet.pt", staff_nome: "Ana Silva",
    }) }]);
  });

  it("recusa notas vazias e longas demais", async () => {
    expect((await pedir("POST", { texto: "   " })).status).toBe(422);
    expect((await pedir("POST", { texto: "x".repeat(2001) })).status).toBe(422);
    expect(mockState.inserts).toEqual([]);
  });

  it("sem a tabela, escrever diz o que falta", async () => {
    setTable("notas_internas", { data: null, error: SEM_TABELA });
    const r = await pedir("POST", { texto: "Nota" });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("20261012100000");
  });

  it("quem não vê pedidos não lê nem escreve notas de pedidos", async () => {
    mockState.tables.staff = { data: { role: "marketing", email: "m@piquet.pt" } };
    expect((await pedir("GET")).status).toBe(403);
    expect((await pedir("POST", { texto: "Nota" })).status).toBe(403);
  });
});
