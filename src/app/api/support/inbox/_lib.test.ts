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

import { assinarImagens } from "./_lib";

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
