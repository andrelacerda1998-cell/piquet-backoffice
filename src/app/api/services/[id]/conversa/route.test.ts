/**
 * @vitest-environment node
 *
 * A conversa cliente-técnico no backoffice: só com um caso aberto, com motivo,
 * só para quem trata de reclamações, e desligada até às Políticas de Privacidade novas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, mockState, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

let ligado = false;
vi.mock("@/lib/conversaEmDisputa", async (original) => ({
  ...(await original<typeof import("@/lib/conversaEmDisputa")>()),
  conversasEmDisputasLigadas: () => ligado,
}));

let casosDoLaravel: Record<string, unknown> = { problema: null, falta: null, mensagens: 2 };
const pedidos: Array<{ caminho: string; opts?: Record<string, unknown> }> = [];
let falhaALer = false;
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string, opts?: Record<string, unknown>) => {
    pedidos.push({ caminho, opts });
    if (caminho.endsWith("/conversa/casos")) return casosDoLaravel;
    if (falhaALer) throw new Error("O Laravel não respondeu.");
    return { mensagens: [{ id: 1, de: "cliente", texto: "Combinámos 60 €", enviada_em: "2026-10-15T10:00:00Z", lida: true }] };
  }),
}));

import { GET, POST } from "./route";
import { _clearStaffCache } from "../../../_lib/handler";

const ctx = (id = "282") => ({ params: Promise.resolve({ id }) });
const pedir = (metodo: "GET" | "POST", corpo?: unknown, id = "282") =>
  (metodo === "GET" ? GET : POST)(new Request(`http://x/api/services/${id}/conversa`, {
    method: metodo,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }), ctx(id));

const TICKET_ABERTO = { id: "TK-1200", subject: "Cobrou a mais", status: "em_curso" };
const MOTIVO = "O cliente diz que combinaram 60 € no chat e pagou 90 €.";
const leuAConversa = () => pedidos.some((p) => p.caminho === "/v1/admin/services/282/conversa");
const registos = () => mockState.inserts.filter((i) => i.table === "acoes_da_equipa");

beforeEach(() => {
  resetMock(); _clearStaffCache();
  pedidos.length = 0;
  ligado = false;
  falhaALer = false;
  casosDoLaravel = { problema: null, falta: null, mensagens: 2 };
  mockState.tables.staff = { data: { role: "suporte", email: "ana@piquet.pt", name: "Ana Silva" } };
  setTable("support_tickets", { data: [TICKET_ABERTO], error: null });
  setTable("acoes_da_equipa", { data: { id: "registo-1" }, error: null });
});

describe("GET /api/services/:id/conversa", () => {
  it("diz os casos abertos e quem já leu, sem o conteúdo", async () => {
    casosDoLaravel = { problema: { em: "2026-10-15T09:00:00Z", por: "customer", motivo: "price" }, falta: null, mensagens: 2 };
    setTable("acoes_da_equipa", {
      data: [{ criado_em: "2026-10-15T12:00:00Z", staff_email: "rui@piquet.pt", motivo: "Ver o preço combinado", detalhe: { caso: "problema" } }],
      error: null,
    });

    const r = await pedir("GET");
    expect(r.status).toBe(200);
    const { data } = await r.json();

    expect(data.ligado).toBe(false);
    expect(data.casos.map((c: { id: string }) => c.id)).toEqual(["ticket:TK-1200", "problema"]);
    expect(data.mensagens).toBe(2);
    expect(data.leituras).toEqual([{ em: "2026-10-15T12:00:00Z", por: "rui@piquet.pt", motivo: "Ver o preço combinado", caso: "problema" }]);
    expect(leuAConversa()).toBe(false);
  });
});

describe("POST /api/services/:id/conversa", () => {
  it("desligada, não lê nem regista", async () => {
    const r = await pedir("POST", { caso: "ticket:TK-1200", motivo: MOTIVO });

    expect(r.status).toBe(403);
    expect(leuAConversa()).toBe(false);
    expect(registos()).toHaveLength(0);
  });

  it("lê com um caso aberto, regista quem leu e porquê, e diz ao Laravel quem é", async () => {
    ligado = true;

    const r = await pedir("POST", { caso: "ticket:TK-1200", motivo: MOTIVO });

    expect(r.status).toBe(200);
    expect((await r.json()).data.mensagens[0].texto).toBe("Combinámos 60 €");
    expect(registos()[0].row).toMatchObject({
      staff_email: "ana@piquet.pt", acao: "ler_conversa", entidade: "pedido", entidade_id: "282",
      motivo: MOTIVO, detalhe: { caso: "ticket:TK-1200" },
    });
    const leitura = pedidos.find((p) => p.caminho === "/v1/admin/services/282/conversa")!;
    expect(leitura.opts).toMatchObject({
      method: "POST",
      body: { caso: "ticket:TK-1200", motivo: MOTIVO },
      staff: { email: "ana@piquet.pt", nome: "Ana Silva" },
    });
  });

  /** O ecrã não decide: um caso que o pedido não tem é recusado no servidor. */
  it("sem esse caso aberto, recusa", async () => {
    ligado = true;
    setTable("support_tickets", { data: [{ ...TICKET_ABERTO, status: "resolvido" }], error: null });

    const r1 = await pedir("POST", { caso: "ticket:TK-1200", motivo: MOTIVO });
    const r2 = await pedir("POST", { caso: "falta", motivo: MOTIVO });

    expect([r1.status, r2.status]).toEqual([403, 403]);
    expect(leuAConversa()).toBe(false);
    expect(registos()).toHaveLength(0);
  });

  it("sem um motivo a sério, recusa", async () => {
    ligado = true;

    const r = await pedir("POST", { caso: "ticket:TK-1200", motivo: "ver chat" });

    expect(r.status).toBe(422);
    expect(leuAConversa()).toBe(false);
  });

  it("se o Laravel falha, devolve o erro", async () => {
    ligado = true;
    falhaALer = true;

    const r = await pedir("POST", { caso: "ticket:TK-1200", motivo: MOTIVO });

    expect(r.status).toBe(500);
  });

  /** Financeiro e gestão de técnicos não tratam reclamações: não leem conversas. */
  it("só Suporte, Operações e direção", async () => {
    ligado = true;
    for (const role of ["financeiro", "gestao_tecnicos", "marketing"]) {
      _clearStaffCache();
      mockState.tables.staff = { data: { role, email: "x@piquet.pt", name: "X" } };
      expect((await pedir("POST", { caso: "ticket:TK-1200", motivo: MOTIVO })).status, role).toBe(403);
      expect((await pedir("GET")).status, role).toBe(403);
    }
    setTable("acoes_da_equipa", { data: [], error: null });
    for (const role of ["operacoes", "ceo"]) {
      _clearStaffCache();
      mockState.tables.staff = { data: { role, email: "x@piquet.pt", name: "X" } };
      expect((await pedir("GET")).status, role).toBe(200);
    }
    expect(leuAConversa()).toBe(false);
  });
});
