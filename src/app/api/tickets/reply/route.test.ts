/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const estado = {
  ticket: null as null | Record<string, unknown>,
  guardado: null as null | Record<string, unknown>,
};

const single = vi.fn(async () => ({ data: estado.ticket, error: estado.ticket ? null : "nada" }));
const update = vi.fn((valores: Record<string, unknown>) => {
  estado.guardado = valores;
  return { eq: async () => ({ error: null }) };
});

vi.mock("@/lib/supabase/server", () => ({
  SUPABASE_ENABLED: true,
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }), update }),
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  }),
}));

import { POST } from "./route";

const TOKEN = "11111111-1111-4111-8111-111111111111";

const pedido = (corpo: Record<string, unknown>) =>
  new Request("http://x/api/tickets/reply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

beforeEach(() => {
  estado.ticket = { id: "TK-1", status: "resolvido", messages: [], requester_name: "Ana" };
  estado.guardado = null;
  update.mockClear();
});

describe("POST /api/tickets/reply", () => {
  it("junta a mensagem do cliente à conversa que já existe", async () => {
    estado.ticket!.messages = [{ id: "m1", from: "requester", body: "primeira" }];

    const res = await POST(pedido({ access_token: TOKEN, message: "e agora?" }));

    expect(res.status).toBe(201);
    const msgs = estado.guardado!.messages as { from: string; body: string }[];
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ from: "requester", body: "e agora?", authorName: "Ana" });
  });

  it("um token que não é uuid não chega a tocar na base de dados", async () => {
    // O id do ticket é sequencial ("TK-1101"). Se servisse como credencial,
    // qualquer pessoa escrevia no ticket de outra só a contar.
    const res = await POST(pedido({ access_token: "TK-1101", message: "olá" }));
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("um ticket que não existe responde igual a um que não é teu", async () => {
    // Distinguir os dois dizia a quem estivesse a adivinhar tokens quando é
    // que tinha acertado.
    estado.ticket = null;
    const res = await POST(pedido({ access_token: TOKEN, message: "olá" }));
    expect(res.status).toBe(403);
  });

  it("o cliente a escrever outra vez reabre o ticket", async () => {
    // Deixá-lo em "resolvido" era deixar a pergunta num sítio onde ninguém
    // volta a olhar.
    await POST(pedido({ access_token: TOKEN, message: "continua igual" }));
    expect(estado.guardado!.status).toBe("em_curso");
    expect(estado.guardado!.unread).toBe(1);
  });

  it("um ticket ainda por ver continua por ver", async () => {
    estado.ticket!.status = "novo";
    await POST(pedido({ access_token: TOKEN, message: "já agora" }));
    expect(estado.guardado!.status).toBe("novo");
  });

  it("um ticket fechado recusa em vez de engolir a mensagem", async () => {
    estado.ticket!.status = "fechado";
    const res = await POST(pedido({ access_token: TOKEN, message: "ainda cá estou" }));
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("uma mensagem vazia não é uma mensagem", async () => {
    const res = await POST(pedido({ access_token: TOKEN, message: "   " }));
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("o cliente não consegue escrever como agente nem mudar a prioridade", async () => {
    // O corpo é lido campo a campo, de propósito: um spread do que vem de fora
    // deixava passar isto.
    await POST(pedido({ access_token: TOKEN, message: "olá", from: "agente", priority: "critica", status: "fechado" }));
    const msgs = estado.guardado!.messages as { from: string }[];
    expect(msgs[msgs.length - 1].from).toBe("requester");
    expect(estado.guardado).not.toHaveProperty("priority");
    expect(estado.guardado!.status).toBe("em_curso");
  });
});
