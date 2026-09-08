import { describe, it, expect } from "vitest";
import { interpretarResposta, fone9, resumirDifusoes, fazCategoria, validarCorpoTecnico, type Difusao } from "./despacho";

describe("interpretarResposta", () => {
  it("lê as formas de aceitar que um técnico escreve mesmo", () => {
    for (const t of ["Sim", "sim", "SIM!", "s", "ok", "Aceito", "posso", "vou eu", "Confirmo", "disponível"]) {
      expect(interpretarResposta(t), t).toBe("aceite");
    }
  });

  it("lê as formas de recusar", () => {
    for (const t of ["Não", "nao", "N", "não posso", "estou ocupado", "hoje não consigo"]) {
      expect(interpretarResposta(t), t).toBe("recusado");
    }
  });

  /*
    O caso que justifica a ordem do código: "não posso" contém "posso".
    Ao contrário, uma recusa virava aceitação e mandava-se ao cliente um
    técnico que tinha dito que não podia.
  */
  it("uma recusa que contém uma palavra de aceitação continua a ser recusa", () => {
    expect(interpretarResposta("não posso")).toBe("recusado");
    expect(interpretarResposta("nao vou conseguir")).toBe("recusado");
    expect(interpretarResposta("hoje não aceito")).toBe("recusado");
  });

  it("uma pergunta não é resposta nenhuma", () => {
    expect(interpretarResposta("a que horas?")).toBeNull();
    expect(interpretarResposta("onde é?")).toBeNull();
    expect(interpretarResposta("")).toBeNull();
    expect(interpretarResposta("   ")).toBeNull();
  });

  /*
    "sim" tem de ser palavra, não pedaço de palavra: senão "simplesmente não"
    era lido como aceitação.
  */
  it("não confunde uma palavra que começa por sim", () => {
    expect(interpretarResposta("simpático")).toBeNull();
    expect(interpretarResposta("simplesmente")).toBeNull();
  });
});

describe("fone9", () => {
  it("iguala o número do Laravel e o do webhook da Meta", () => {
    expect(fone9("912345678")).toBe("912345678");
    expect(fone9("351912345678")).toBe("912345678");
    expect(fone9("+351 912 345 678")).toBe("912345678");
  });

  it("aguenta lixo sem rebentar", () => {
    expect(fone9("")).toBe("");
    expect(fone9("sem número")).toBe("");
  });
});

describe("resumirDifusoes", () => {
  const d = (status: Difusao["status"]): Difusao => ({
    id: Math.random().toString(), technicianId: "1", technicianName: "T",
    phone: "912345678", status, error: "", respondedAt: null, createdAt: "",
  });

  it("conta cada estado", () => {
    const r = resumirDifusoes([d("enviado"), d("enviado"), d("aceite"), d("recusado"), d("falhou")]);
    expect(r).toEqual({ enviadas: 5, aceites: 1, recusadas: 1, falhadas: 1, porResponder: 2 });
  });

  it("sem difusões, tudo a zero", () => {
    expect(resumirDifusoes([])).toEqual({
      enviadas: 0, aceites: 0, recusadas: 0, falhadas: 0, porResponder: 0,
    });
  });
});

describe("fazCategoria", () => {
  it("aceita a mesma categoria escrita de outra maneira", () => {
    expect(fazCategoria(["Canalização"], "Canalização")).toBe(true);
    expect(fazCategoria(["Canalizador"], "Canalização")).toBe(true);
    expect(fazCategoria(["Canalização e água"], "Canalização")).toBe(true);
    expect(fazCategoria(["canalizacao"], "Canalização")).toBe(true);
  });

  it("não mistura ofícios diferentes", () => {
    expect(fazCategoria(["Eletricidade"], "Canalização")).toBe(false);
    expect(fazCategoria(["Limpeza Doméstica"], "Fechaduras e Portas")).toBe(false);
  });

  it("um técnico com vários ofícios entra por qualquer um deles", () => {
    expect(fazCategoria(["Eletricidade", "Canalização"], "Canalização")).toBe(true);
  });

  it("sem categoria no pedido não afirma nada", () => {
    expect(fazCategoria(["Canalização"], "")).toBe(false);
    expect(fazCategoria([], "Canalização")).toBe(false);
  });
});

describe("validarCorpoTecnico", () => {
  const bom = "Novo pedido na Piquet: {{1}}.\nUrgencia: {{2}}.\nResponda SIM ou NAO.";

  it("aceita um texto que pede a resposta que sabemos ler", () => {
    expect(validarCorpoTecnico(bom)).toBeNull();
  });

  /*
    O caso que justifica esta validação existir: trocar as palavras não parte
    nada de visível — os pedidos continuam a sair — mas as aceitações deixam
    de ser reconhecidas, e só se descobre com um cliente sem técnico.
  */
  it("aceita sinónimos que a leitura das respostas também reconhece", () => {
    expect(validarCorpoTecnico("Pedido {{1}} ({{2}}). Responda ACEITO ou RECUSO.")).toBeNull();
  });

  it("recusa um texto que pede palavras que não sabemos ler", () => {
    const mau = "Pedido {{1}} ({{2}}). Responda com o polegar para cima ou para baixo.";
    expect(validarCorpoTecnico(mau)).toMatch(/saiba ler/);
  });

  it("exige os dois parâmetros", () => {
    expect(validarCorpoTecnico("Pedido {{1}}. Responda SIM ou NAO.")).toMatch(/\{\{2\}\}/);
    expect(validarCorpoTecnico("Urgencia {{2}}. Responda SIM ou NAO.")).toMatch(/\{\{1\}\}/);
  });

  it("recusa texto vazio", () => {
    expect(validarCorpoTecnico("   ")).toMatch(/vazio/);
  });
});
