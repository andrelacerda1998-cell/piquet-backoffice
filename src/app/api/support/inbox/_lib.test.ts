/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

// O Storage não está no mock partilhado (nenhum endpoint precisava dele até
// agora). Aqui só interessa o que se faz com o que ele devolve.
const createSignedUrls = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  SUPABASE_ENABLED: true,
  supabaseAdmin: () => ({ storage: { from: () => ({ createSignedUrls }) } }),
}));

import { assinarImagens, toInboxTicket, type TicketRow } from "./_lib";

const ticket = (images?: string[]) => ({
  messages: [{ id: "m1", from: "requester", body: "olá", ...(images ? { images } : {}) }],
});

describe("assinarImagens", () => {
  it("troca cada caminho pelo URL assinado", async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [{ signedUrl: "https://s/a?tok=1" }, { signedUrl: "https://s/b?tok=2" }],
    });

    const [t] = await assinarImagens([ticket(["tickets/a.jpg", "tickets/b.jpg"])]);

    expect((t.messages[0] as { images: string[] }).images).toEqual([
      "https://s/a?tok=1",
      "https://s/b?tok=2",
    ]);
  });

  it("não fala com o Storage quando não há fotos", async () => {
    createSignedUrls.mockClear();
    await assinarImagens([ticket()]);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("deita fora a foto que não assina, em vez de deixar um ícone partido", async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [{ signedUrl: "https://s/a?tok=1" }, { signedUrl: null, error: "não existe" }],
    });

    const [t] = await assinarImagens([ticket(["tickets/a.jpg", "tickets/perdida.jpg"])]);

    expect((t.messages[0] as { images: string[] }).images).toEqual(["https://s/a?tok=1"]);
  });

  it("pede cada caminho uma só vez, mesmo repetido entre tickets", async () => {
    // Dois clientes a mandar a mesma foto é raro; a MESMA foto em duas
    // mensagens do mesmo ticket não é. Assinar duas vezes é uma chamada a mais
    // por cada miniatura repetida na caixa de entrada inteira.
    createSignedUrls.mockClear();
    createSignedUrls.mockResolvedValueOnce({ data: [{ signedUrl: "https://s/a" }] });

    await assinarImagens([ticket(["tickets/a.jpg"]), ticket(["tickets/a.jpg"])]);

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(["tickets/a.jpg"], expect.any(Number));
  });
});

/**
 * O SELO DE ORIGEM que o ecrã do suporte mostra em cada linha sai daqui.
 *
 * Quem responde precisa de saber, antes de escrever a primeira palavra, se
 * está a falar com um técnico ou com um cliente: o contexto, o tratamento e o
 * que se pode prometer são diferentes.
 */
describe("toInboxTicket — de onde vem o ticket", () => {
  const linha = (extra: Partial<TicketRow> = {}): TicketRow => ({
    id: "TK-1", channel: "app_cliente", requester_type: "cliente",
    requester_name: "Ana Marques", requester_email: "ana@x.pt", requester_phone: "",
    subject: "Assunto", category: "", service_id: "", priority: "media",
    status: "novo", messages: [], unread: 1,
    opened_at: "2026-10-01T09:00:00Z", last_message_at: "2026-10-01T09:00:00Z",
    ...extra,
  });

  it("deixa passar a origem tal como está guardada", () => {
    expect(toInboxTicket(linha({ requester_type: "tecnico" })).requesterType).toBe("tecnico");
    expect(toInboxTicket(linha({ requester_type: "cliente" })).requesterType).toBe("cliente");
  });

  it("sem nome, usa o telefone — que é por onde se lhe liga", () => {
    const t = toInboxTicket(linha({ requester_name: "", requester_phone: "+351912345678" }));

    expect(t.requesterName).toBe("+351912345678");
  });

  /**
   * Sem nome nem telefone é preciso escrever ALGUMA coisa na linha. O que lá
   * estava era «Cliente» para toda a gente, incluindo para quem tinha o selo
   * «Técnico» ao lado — a mesma linha a dizer as duas coisas.
   */
  it("sem nome nem telefone, trata cada um pelo que é", () => {
    expect(toInboxTicket(linha({ requester_name: "", requester_phone: "", requester_type: "tecnico" })).requesterName)
      .toBe("Técnico");
    expect(toInboxTicket(linha({ requester_name: "", requester_phone: "", requester_type: "cliente" })).requesterName)
      .toBe("Cliente");
  });

  it("uma categoria vazia não vira texto vazio no ecrã", () => {
    expect(toInboxTicket(linha({ category: "" })).category).toBeUndefined();
    expect(toInboxTicket(linha({ category: "Pagamentos" })).category).toBe("Pagamentos");
  });

  it("messages que não seja uma lista não parte o ecrã", () => {
    expect(toInboxTicket(linha({ messages: null })).messages).toEqual([]);
    expect(toInboxTicket(linha({ messages: "{}" })).messages).toEqual([]);
  });
});
