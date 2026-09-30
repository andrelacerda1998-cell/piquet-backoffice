import { describe, it, expect } from "vitest";
import {
  avisosDeServicos, avisosDeDocumentos, valorDoAviso, ultimasDatas,
  type ServicoParaAviso, type DocumentoParaAviso,
} from "./avisosOperacao";

const AGORA = new Date("2026-09-30T12:00:00Z");

const servico = (p: Partial<ServicoParaAviso> = {}): ServicoParaAviso => ({
  id: "282",
  status: "concluido",
  customerName: "Maria Silva",
  serviceName: "Canalização",
  city: "Porto",
  totalCustomerValue: 85,
  completedAt: "2026-09-30T10:00:00Z",
  ...p,
});

/*
  O pt-PT separa o número do símbolo com um espaço INQUEBRÁVEL (U+00A0), não
  com um espaço normal. Escrito à mão o teste falhava com "esperava 85,00 € e
  recebeu 85,00 €", que é das mensagens mais enlouquecedoras que há.
*/
const EUR = (n: string) => `${n}\u00A0€`;

describe("valorDoAviso", () => {
  it("escreve o valor em euros", () => {
    expect(valorDoAviso(85)).toBe(EUR("85,00"));
  });

  it("zero não é grátis, é por definir", () => {
    // Um serviço agendado pode ainda estar à espera de orçamento. Dizer
    // "0,00 €" seria afirmar uma coisa falsa sobre dinheiro.
    expect(valorDoAviso(0)).toBe("valor por definir");
  });
});

describe("avisosDeServicos", () => {
  it("o título leva o estado e o valor", () => {
    // É o título que sobrevive ao agrupamento: com várias coisas novas, a
    // notificação mostra só títulos. O valor no corpo desaparecia nos dias
    // com movimento, que são justamente aqueles em que interessa.
    const [a] = avisosDeServicos([servico()], { agora: AGORA });
    expect(a.titulo).toBe(`Serviço concluído · ${EUR("85,00")}`);
  });

  it("distingue agendado de concluído", () => {
    const [a] = avisosDeServicos(
      [servico({ status: "agendado", scheduledAt: "2026-10-01T14:30:00Z", completedAt: undefined })],
      { agora: AGORA },
    );
    expect(a.titulo).toBe(`Serviço agendado · ${EUR("85,00")}`);
  });

  it("o corpo diz o tipo de serviço e a cidade, e não quem pediu", () => {
    // Numa notificação cabem poucas palavras antes de serem cortadas, e o
    // nome de quem pediu não ajuda a decidir nada de relance.
    const [a] = avisosDeServicos([servico()], { agora: AGORA });
    expect(a.corpo).toBe("Canalização | Porto");
    expect(a.corpo).not.toContain("Maria Silva");
  });

  it("um agendamento diz a que horas", () => {
    const [a] = avisosDeServicos(
      [servico({ status: "agendado", scheduledAt: "2026-10-01T14:30:00Z" })],
      { agora: AGORA },
    );
    // Lisboa está em UTC+1 a 1 de outubro, por isso 14:30 UTC são 15:30.
    expect(a.corpo).toBe("Canalização | Porto · 1/10, 15:30");
  });

  it("o mesmo serviço avisa duas vezes na vida, uma por estado", () => {
    // Sem o estado no id, o aviso de "concluído" nunca saía: o serviço já
    // tinha sido avisado quando ficou agendado.
    const agendado = avisosDeServicos(
      [servico({ status: "agendado", scheduledAt: "2026-09-30T14:00:00Z" })], { agora: AGORA });
    const concluido = avisosDeServicos([servico()], { agora: AGORA });
    expect(agendado[0].id).not.toBe(concluido[0].id);
  });

  it("ignora os estados que não foram pedidos", () => {
    expect(avisosDeServicos([servico({ status: "em_execucao" })], { agora: AGORA })).toEqual([]);
    expect(avisosDeServicos([servico({ status: "cancelado_cliente" })], { agora: AGORA })).toEqual([]);
  });

  it("não desenterra o que é antigo", () => {
    // Sem janela, a primeira corrida anunciava todos os serviços concluídos
    // desde sempre.
    const velho = servico({ completedAt: "2026-08-01T10:00:00Z" });
    expect(avisosDeServicos([velho], { agora: AGORA })).toEqual([]);
  });

  it("um agendamento futuro está dentro da janela", () => {
    // Agendamentos são no futuro: uma janela que só olhasse para trás
    // deixava-os todos de fora.
    const amanha = servico({ status: "agendado", scheduledAt: "2026-10-01T09:00:00Z" });
    expect(avisosDeServicos([amanha], { agora: AGORA })).toHaveLength(1);
  });

  it("sem data não avisa", () => {
    // Não se sabe se foi agora ou há um ano. Um aviso a horas erradas custa
    // mais do que um aviso que falta.
    const semData = servico({ completedAt: undefined, requestedAt: undefined });
    expect(avisosDeServicos([semData], { agora: AGORA })).toEqual([]);
  });

  it("uma data impossível não rebenta nem passa", () => {
    const mau = servico({ completedAt: "nao-e-uma-data" });
    expect(avisosDeServicos([mau], { agora: AGORA })).toEqual([]);
  });

  it("sem nome de cliente ainda diz de que serviço se trata", () => {
    const anonimo = servico({ serviceName: undefined, city: undefined });
    expect(avisosDeServicos([anonimo], { agora: AGORA })[0].corpo).toBe("Serviço 282");
  });

  it("leva ao serviço certo", () => {
    expect(avisosDeServicos([servico()], { agora: AGORA })[0].url).toBe("/servicos?servico=282");
  });
});

const documento = (p: Partial<DocumentoParaAviso> = {}): DocumentoParaAviso => ({
  id: 77,
  vendorName: "Danúbia Trintrim",
  documentType: "Cartão de cidadão",
  status: "pending",
  createdAt: "2026-09-29T09:00:00Z",
  ...p,
});

describe("avisosDeDocumentos", () => {
  it("avisa de um documento submetido", () => {
    const [a] = avisosDeDocumentos([documento()], { agora: AGORA });
    expect(a.titulo).toBe("Documento de técnico por validar");
    expect(a.corpo).toBe("Danúbia Trintrim — Cartão de cidadão");
    expect(a.url).toBe("/tecnicos?documento=77");
  });

  it("só os que ainda ninguém viu", () => {
    // Um documento já validado ou recusado não está à espera de ninguém.
    expect(avisosDeDocumentos([documento({ status: "approved" })], { agora: AGORA })).toEqual([]);
    expect(avisosDeDocumentos([documento({ status: "declined" })], { agora: AGORA })).toEqual([]);
  });

  it("a janela é mais larga do que a dos serviços", () => {
    // Um documento por validar continua por validar no dia seguinte, e vale
    // a pena voltar a lembrar. É a memória dos avisos que trata de não
    // repetir, não a janela.
    const hatrêsDias = documento({ createdAt: "2026-09-27T09:00:00Z" });
    expect(avisosDeDocumentos([hatrêsDias], { agora: AGORA })).toHaveLength(1);
  });

  it("mas não é infinita", () => {
    expect(avisosDeDocumentos([documento({ createdAt: "2026-08-01T09:00:00Z" })], { agora: AGORA })).toEqual([]);
  });

  it("sem nome do técnico ainda identifica o documento", () => {
    const anonimo = documento({ vendorName: null, documentType: null });
    expect(avisosDeDocumentos([anonimo], { agora: AGORA })[0].corpo).toBe("Documento 77");
  });
});

describe("ultimasDatas", () => {
  const s = (p: Partial<ServicoParaAviso>): ServicoParaAviso => servico({ completedAt: undefined, ...p });

  it("dá a data mais recente de cada estado", () => {
    const r = ultimasDatas([
      s({ status: "concluido", completedAt: "2026-09-01T10:00:00Z" }),
      s({ status: "concluido", completedAt: "2026-09-20T10:00:00Z" }),
      s({ status: "agendado", scheduledAt: "2026-10-05T10:00:00Z" }),
    ]);
    expect(r.concluido).toBe("2026-09-20T10:00:00Z");
    expect(r.agendado).toBe("2026-10-05T10:00:00Z");
  });

  it("conta quantos há de cada", () => {
    // É a contagem que distingue "nada aconteceu" de "nada é reconhecido
    // como concluído porque a tradução dos estados está errada".
    const r = ultimasDatas([
      s({ status: "concluido", completedAt: "2026-09-01T10:00:00Z" }),
      s({ status: "pedido_recebido" }),
      s({ status: "pedido_recebido" }),
    ]);
    expect(r.contagem).toEqual({ concluido: 1, agendado: 0 });
  });

  it("sem nenhum, devolve nulo em vez de uma data inventada", () => {
    const r = ultimasDatas([s({ status: "cancelado_cliente" })]);
    expect(r).toMatchObject({ concluido: null, agendado: null });
  });

  it("uma data impossível não ganha à boa", () => {
    const r = ultimasDatas([
      s({ status: "concluido", completedAt: "2026-09-01T10:00:00Z" }),
      s({ status: "concluido", completedAt: "nao-e-uma-data" }),
    ]);
    expect(r.concluido).toBe("2026-09-01T10:00:00Z");
  });
});

describe("avisosDeServicos — agendamento pela data, não pelo estado", () => {
  it("avisa um serviço com data marcada, seja qual for o estado", () => {
    /*
      O caso que faltava. "agendado" NÃO É UM ESTADO nos dados: o Laravel
      traduz onze estados e nenhum deles dá "agendado". Um serviço marcado
      chega como "tecnico_encontrado" com scheduled_at preenchido, e o filtro
      antigo -- status === "agendado" -- nunca o apanhava.
    */
    const r = avisosDeServicos(
      [servico({ status: "tecnico_encontrado", completedAt: undefined, scheduledAt: "2026-10-02T09:00:00Z" })],
      { agora: AGORA },
    );
    expect(r).toHaveLength(1);
    expect(r[0].titulo).toBe(`Serviço agendado · ${EUR("85,00")}`);
    expect(r[0].id).toBe("servico:282:agendado");
  });

  it("uma marcação para daqui a duas semanas conta", () => {
    // A janela de 48h é para o que JÁ aconteceu. Uma marcação futura não
    // deixa de interessar por estar longe -- pelo contrário.
    const r = avisosDeServicos(
      [servico({ status: "pago", completedAt: undefined, scheduledAt: "2026-10-14T09:00:00Z" })],
      { agora: AGORA },
    );
    expect(r).toHaveLength(1);
  });

  it("um serviço já concluído não volta a avisar que está agendado", () => {
    const r = avisosDeServicos(
      [servico({ status: "concluido", scheduledAt: "2026-10-02T09:00:00Z" })],
      { agora: AGORA },
    );
    expect(r.map((x) => x.id)).toEqual(["servico:282:concluido"]);
  });

  it("um serviço cancelado com marcação não avisa", () => {
    for (const status of ["cancelado_cliente", "cancelado_tecnico", "reembolsado"]) {
      const r = avisosDeServicos(
        [servico({ status, completedAt: undefined, scheduledAt: "2026-10-02T09:00:00Z" })],
        { agora: AGORA },
      );
      expect(r, status).toEqual([]);
    }
  });

  it("uma marcação antiga já não interessa", () => {
    const r = avisosDeServicos(
      [servico({ status: "pago", completedAt: undefined, scheduledAt: "2026-08-01T09:00:00Z" })],
      { agora: AGORA },
    );
    expect(r).toEqual([]);
  });

  it("sem data marcada não há aviso de agendamento", () => {
    const r = avisosDeServicos(
      [servico({ status: "pago", completedAt: undefined, scheduledAt: undefined })],
      { agora: AGORA },
    );
    expect(r).toEqual([]);
  });
});
