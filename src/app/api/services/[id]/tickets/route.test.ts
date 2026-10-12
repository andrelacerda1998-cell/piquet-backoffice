/**
 * @vitest-environment node
 *
 * Tickets ligados a um pedido: a equipa abre um em nome do cliente, que fica
 * em Suporte com o número do pedido, o cliente como requerente e a primeira
 * mensagem assinada por quem o abriu.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, mockState, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async () => ({ id: 282, customer_name: "Marta Santos", customer_phone: "912345678" })),
}));

import { GET, POST } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";

const ctx = (id = "282") => ({ params: Promise.resolve({ id }) });
const pedir = (metodo: "GET" | "POST", corpo?: unknown, id = "282") =>
  (metodo === "GET" ? GET : POST)(new Request(`http://x/api/services/${id}/tickets`, {
    method: metodo,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }), ctx(id));

const LINHA = {
  id: "TK-1200", subject: "Reclamação · pedido #282", status: "em_curso", priority: "alta", category: "Reclamação",
  opened_at: "2026-10-12T10:00:00Z", last_message_at: "2026-10-12T10:00:00Z", channel: "backoffice",
};

beforeEach(() => {
  resetMock(); _clearStaffCache();
  mockState.tables.staff = { data: { role: "operacoes", email: "ana@piquet.pt", name: "Ana Silva" } };
});

describe("/api/services/:id/tickets", () => {
  it("lista os tickets do pedido", async () => {
    setTable("support_tickets", { data: [LINHA], error: null });
    const r = await pedir("GET");
    expect(r.status).toBe(200);
    expect((await r.json()).data[0]).toMatchObject({ id: "TK-1200", assunto: "Reclamação · pedido #282", estado: "em_curso" });
  });

  it("abre um ticket ligado ao pedido, com o cliente do pedido e a mensagem assinada", async () => {
    setTable("support_tickets", { data: LINHA, error: null });
    const r = await pedir("POST", { mensagem: "Cliente ligou: a torneira continua a pingar.", categoria: "Reclamação", prioridade: "alta" });
    expect(r.status).toBe(201);
    const { row } = mockState.inserts.find((i) => i.table === "support_tickets")! as { row: Record<string, unknown> };
    expect(row).toMatchObject({
      channel: "backoffice", service_id: "282", requester_name: "Marta Santos", requester_phone: "912345678",
      category: "Reclamação", priority: "alta", status: "em_curso",
    });
    expect((row.messages as { authorName: string; from: string }[])[0]).toMatchObject({ from: "agente", authorName: "Ana Silva" });
  });

  it("sem mensagem não abre", async () => {
    const r = await pedir("POST", { mensagem: "ok" });
    expect(r.status).toBe(422);
    expect(mockState.inserts).toEqual([]);
  });

  it("valores fora da lista passam ao que é por omissão", async () => {
    setTable("support_tickets", { data: LINHA, error: null });
    await pedir("POST", { mensagem: "Cliente ligou a reclamar.", categoria: "Inventada", prioridade: "urgentissima" });
    const { row } = mockState.inserts.find((i) => i.table === "support_tickets")! as { row: Record<string, unknown> };
    expect(row).toMatchObject({ category: "Reclamação", priority: "media" });
  });

  it("um id que não é de pedido não abre ticket", async () => {
    expect((await pedir("POST", { mensagem: "Cliente ligou a reclamar." }, "abc")).status).toBe(404);
  });

  it("quem não trata do Suporte não vê nem abre tickets", async () => {
    mockState.tables.staff = { data: { role: "financeiro", email: "f@piquet.pt" } };
    expect((await pedir("GET")).status).toBe(403);
  });
});
