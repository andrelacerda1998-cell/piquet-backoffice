/**
 * @vitest-environment node
 *
 * Node de propósito: é o `Request`/`FormData` do runtime do servidor que tem de
 * ser exercitado, o mesmo que o Next usa. O ambiente de browser do vitest traz
 * outra implementação, e passar lá não provava nada sobre produção.
 */
import { describe, it, expect } from "vitest";
import { lerPedido } from "./_lib";

const pedidoJson = (corpo: unknown) =>
  new Request("http://x/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

const pedidoForm = (form: FormData) =>
  new Request("http://x/api/tickets", { method: "POST", body: form });

const foto = (nome: string, bytes = 12) =>
  new File([new Uint8Array(bytes)], nome, { type: "image/jpeg" });

describe("lerPedido", () => {
  it("lê o JSON que as versões da app já instaladas mandam", async () => {
    // Esta é a que não pode partir nunca: quem não actualiza a app continua a
    // conseguir pedir ajuda.
    const { body, imagens } = await lerPedido(pedidoJson({ message: "a torneira pinga" }));
    expect(body.message).toBe("a torneira pinga");
    expect(imagens).toEqual([]);
  });

  it("lê os campos e as fotos de um formulário", async () => {
    const form = new FormData();
    form.append("message", "o quadro disparou");
    form.append("channel", "app_cliente");
    form.append("images", foto("a.jpg"));
    form.append("images", foto("b.jpg"));

    const { body, imagens } = await lerPedido(pedidoForm(form));

    expect(body.message).toBe("o quadro disparou");
    expect(body.channel).toBe("app_cliente");
    expect(imagens.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("um formulário sem fotos é um formulário válido", async () => {
    const form = new FormData();
    form.append("message", "sem fotos");
    const { body, imagens } = await lerPedido(pedidoForm(form));
    expect(body.message).toBe("sem fotos");
    expect(imagens).toEqual([]);
  });

  it("não confunde os campos de texto com ficheiros", async () => {
    // O `body` alimenta a validação e a base de dados. Se um File escorregasse
    // para lá, ia para a coluna como "[object File]".
    const form = new FormData();
    form.append("subject", "Assunto");
    form.append("images", foto("c.jpg"));
    const { body } = await lerPedido(pedidoForm(form));
    expect(Object.keys(body)).toEqual(["subject"]);
  });
});
