/**
 * @vitest-environment node
 *
 * A PORTA PÚBLICA do suporte: é por aqui que entram os pedidos de ajuda das
 * duas apps, e é o único endpoint /api sem autenticação. Duas famílias de
 * cenários, e as duas já custaram caro noutros sítios:
 *
 *  - DE ONDE VEM o ticket. O backoffice mostra um selo «Técnico»/«Cliente» e
 *    decide-o aqui, numa linha só. Se essa linha errar, quem responde no
 *    suporte fala com um técnico a pensar que fala com um cliente.
 *  - QUEM PODE LER. O `ids` foi removido do GET a 03/08/2026 porque o id é
 *    sequencial e permitia enumerar tickets de terceiros. Isso não tinha teste
 *    nenhum a segurá-lo, e um `ids` de volta ao código passaria despercebido.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const estado = {
  inserido: null as null | Record<string, unknown>,
  filtro: null as null | { coluna: string; valores: unknown },
  linhas: [] as Record<string, unknown>[],
  erroAoInserir: false,
};

vi.mock("@/lib/supabase/server", () => ({
  SUPABASE_ENABLED: true,
  supabaseAdmin: () => ({
    from: () => ({
      insert: (valores: Record<string, unknown>) => {
        estado.inserido = valores;
        return {
          select: () => ({
            single: async () =>
              estado.erroAoInserir
                ? { data: null, error: { message: "boom" } }
                : { data: { id: "TK-9001", access_token: "tok-novo" }, error: null },
          }),
        };
      },
      select: () => ({
        in: async (coluna: string, valores: unknown) => {
          estado.filtro = { coluna, valores };
          return { data: estado.linhas, error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrls: async () => ({ data: [] }),
      }),
    },
  }),
}));

import { GET, POST } from "./route";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

const enviar = (corpo: Record<string, unknown>) =>
  POST(new Request("http://x/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  }));

const pedir = (query: string) => GET(new Request(`http://x/api/tickets?${query}`));

beforeEach(() => {
  estado.inserido = null;
  estado.filtro = null;
  estado.linhas = [];
  estado.erroAoInserir = false;
});

describe("POST /api/tickets — de onde vem o ticket", () => {
  it("marca como técnico o que vem da app dos técnicos", async () => {
    const res = await enviar({ channel: "app_tecnico", name: "Rui", message: "A app não me deixa faturar." });

    expect(res.status).toBe(201);
    expect(estado.inserido).toMatchObject({ channel: "app_tecnico", requester_type: "tecnico" });
  });

  it("marca como cliente o que vem da app dos clientes", async () => {
    await enviar({ channel: "app_cliente", name: "Ana", message: "O técnico não apareceu." });

    expect(estado.inserido).toMatchObject({ channel: "app_cliente", requester_type: "cliente" });
  });

  it("sem canal, assume cliente", async () => {
    await enviar({ name: "Ana", message: "Olá." });

    expect(estado.inserido).toMatchObject({ channel: "app_cliente", requester_type: "cliente" });
  });

  /**
   * O PONTO ÚNICO DE FALHA, escrito para ficar à vista.
   *
   * A origem é decidida por uma igualdade exacta a "app_tecnico": tudo o resto
   * — um canal novo, um erro de escrita, uma app antiga — cai em «cliente».
   * Falha para o lado errado: um técnico tratado como cliente é uma conversa
   * com o contexto trocado, e ninguém repara porque o selo parece confiante.
   */
  it("qualquer outro canal cai em cliente, e é por isso que o nome tem de bater certo", async () => {
    for (const canal of ["whatsapp", "web", "app_vendor", "App_Tecnico", ""]) {
      estado.inserido = null;
      await enviar({ channel: canal, name: "X", message: "m" });
      expect(estado.inserido, `canal ${canal || "(vazio)"}`).toMatchObject({ requester_type: "cliente" });
    }
  });

  /**
   * O selo e o nome na MESMA linha não se podem contradizer.
   *
   * Um técnico que escreva da app sem nome preenchido ficava com o autor da
   * mensagem a dizer «Cliente» enquanto o selo ao lado dizia «Técnico».
   */
  it("técnico sem nome não é tratado por «Cliente»", async () => {
    await enviar({ channel: "app_tecnico", email: "rui@piquetpro.pt", message: "Preciso de ajuda." });

    const mensagens = (estado.inserido as { messages: { authorName: string }[] }).messages;
    expect(mensagens[0].authorName).not.toBe("Cliente");
  });
});

describe("POST /api/tickets — o que não entra", () => {
  it("recusa sem mensagem", async () => {
    const res = await enviar({ name: "Ana", message: "   " });

    expect(res.status).toBe(400);
    expect(estado.inserido).toBeNull();
  });

  it("recusa sem nome, email nem telefone", async () => {
    const res = await enviar({ message: "Olá." });

    expect(res.status).toBe(400);
    expect(estado.inserido).toBeNull();
  });

  it("aceita só com telefone", async () => {
    const res = await enviar({ phone: "+351912345678", message: "Olá." });

    expect(res.status).toBe(201);
  });

  /** Honeypot: o bot recebe um sim e a base de dados não vê nada. */
  it("finge aceitar o bot e não guarda", async () => {
    const res = await enviar({ website: "http://spam", name: "Bot", message: "compre" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(estado.inserido).toBeNull();
  });

  it("corta os campos longos em vez de os recusar", async () => {
    await enviar({ name: "a".repeat(500), message: "m".repeat(5000) });

    const t = estado.inserido as { requester_name: string; messages: { body: string }[] };
    expect(t.requester_name).toHaveLength(200);
    expect(t.messages[0].body).toHaveLength(4000);
  });

  it("sem assunto, usa os primeiros 80 caracteres da mensagem", async () => {
    const mensagem = "O esquentador deixou de aquecer desde ontem à noite, já tentei reiniciar e não dá nada.";
    expect(mensagem.length).toBeGreaterThan(80); // senão este teste não testava o corte
    await enviar({ name: "Ana", message: mensagem });

    const t = estado.inserido as { subject: string };
    expect(t.subject).toBe(mensagem.slice(0, 80));
  });

  it("uma mensagem curta fica inteira no assunto", async () => {
    await enviar({ name: "Ana", message: "Não consigo pagar." });

    expect((estado.inserido as { subject: string }).subject).toBe("Não consigo pagar.");
  });

  it("devolve o access_token uma vez, na criação", async () => {
    const res = await enviar({ name: "Ana", message: "Olá." });

    expect(await res.json()).toEqual({ ok: true, ticket_id: "TK-9001", access_token: "tok-novo" });
  });

  it("não deixa escapar o erro da base de dados para quem está na app", async () => {
    estado.erroAoInserir = true;
    const res = await enviar({ name: "Ana", message: "Olá." });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("erro ao guardar");
  });

  it("um corpo que não é JSON dá 400 e não rebenta", async () => {
    const res = await POST(new Request("http://x/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{isto não é json",
    }));

    expect(res.status).toBe(400);
  });
});

describe("GET /api/tickets — só quem tem o token lê", () => {
  /**
   * A regressão que este teste existe para apanhar: o `ids` foi removido
   * porque "TK-1101" + 1 é o ticket de outra pessoa.
   */
  it("ignora o ids e não vai sequer à base de dados", async () => {
    const res = await pedir("ids=TK-1101,TK-1102");

    expect(await res.json()).toEqual({ ok: true, tickets: [] });
    expect(estado.filtro).toBeNull();
  });

  it("deita fora o que não é uuid antes de consultar", async () => {
    await pedir(`tokens=${UUID_A},nao-e-uuid,' OR 1=1 --,${UUID_B}`);

    expect(estado.filtro).toEqual({ coluna: "access_token", valores: [UUID_A, UUID_B] });
  });

  it("sem tokens válidos devolve vazio sem consultar", async () => {
    const res = await pedir("tokens=lixo,outro-lixo");

    expect(await res.json()).toEqual({ ok: true, tickets: [] });
    expect(estado.filtro).toBeNull();
  });

  it("não aceita mais de 50 tokens de uma vez", async () => {
    const muitos = Array.from({ length: 80 }, (_, i) =>
      `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`);
    await pedir(`tokens=${muitos.join(",")}`);

    expect((estado.filtro!.valores as string[])).toHaveLength(50);
  });

  it("um ticket fechado não aceita resposta; os outros aceitam", async () => {
    estado.linhas = [
      { id: "TK-1", subject: "a", status: "fechado", messages: [], access_token: UUID_A },
      { id: "TK-2", subject: "b", status: "resolvido", messages: [], access_token: UUID_B },
    ];
    const res = await pedir(`tokens=${UUID_A},${UUID_B}`);

    const { tickets } = await res.json();
    expect(tickets.map((t: { can_reply: boolean }) => t.can_reply)).toEqual([false, true]);
  });

  it("traduz o estado para o que a app mostra ao utilizador", async () => {
    estado.linhas = [{ id: "TK-1", subject: "a", status: "aguarda_cliente", messages: [], access_token: UUID_A }];
    const res = await pedir(`tokens=${UUID_A}`);

    expect((await res.json()).tickets[0].status_label).toBe("À espera de ti");
  });

  it("devolve a conversa inteira, e não só a última resposta", async () => {
    estado.linhas = [{
      id: "TK-1", subject: "a", status: "em_curso", access_token: UUID_A,
      messages: [
        { id: "1", from: "requester", body: "primeira" },
        { id: "2", from: "agente", body: "respondemos" },
        { id: "3", from: "requester", body: "obrigado" },
      ],
    }];
    const res = await pedir(`tokens=${UUID_A}`);

    const t = (await res.json()).tickets[0];
    expect(t.messages).toHaveLength(3);
    // Mantido para as versões da app que só sabem ler isto.
    expect(t.reply_preview).toBe("respondemos");
    expect(t.has_reply).toBe(true);
  });
});
