import { describe, it, expect } from "vitest";
import { POLITICA } from "./acessoApi";
import { ESCRITAS, NAO_REGISTAR, oQueRegistar, rotuloDaAcao } from "./registoDaEquipa";

describe("o histórico da equipa cobre todas as escritas", () => {
  const escritas = Object.keys(POLITICA).filter((k) => !k.startsWith("GET "));

  it("cada rota de escrita está classificada: regista-se, ou diz porque não", () => {
    const porClassificar = escritas.filter((k) => !(k in ESCRITAS) && !(k in NAO_REGISTAR));
    expect(porClassificar).toEqual([]);
  });

  it("não há classificações para rotas que já não existem", () => {
    for (const k of [...Object.keys(ESCRITAS), ...Object.keys(NAO_REGISTAR)]) expect(escritas, k).toContain(k);
  });

  it("o id vem do parâmetro certo da rota", () => {
    for (const [k, e] of Object.entries(ESCRITAS)) {
      if (e.id) expect(k, k).toContain(`[${e.id}]`);
    }
  });
});

describe("oQueRegistar", () => {
  it("regista com a entidade e o id da rota", () => {
    expect(oQueRegistar("PUT /customers/[id]/restore", { id: "412" }))
      .toEqual({ acao: "PUT /customers/[id]/restore", entidade: "cliente", entidadeId: "412" });
  });

  it("não repete o que a própria rota já grava com motivo", () => {
    expect(oQueRegistar("PUT /customers/[id]/block", { id: "412" })).toBeNull();
  });

  it("não regista o que está fora (conversa, tarefas) nem rotas desconhecidas", () => {
    expect(oQueRegistar("POST /team/messages", {})).toBeNull();
    expect(oQueRegistar(null, {})).toBeNull();
  });

  it("lê-se em português, seja pela rota ou pelo nome próprio", () => {
    expect(rotuloDaAcao("PUT /customers/[id]/restore")).toBe("Reativou o cliente");
    expect(rotuloDaAcao("bloquear_cliente")).toBe("Bloqueou o cliente");
  });
});
