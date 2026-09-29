import { describe, it, expect } from "vitest";
import { construirOperacao, mediana, minutosEntre, type ServicoOperacional } from "./operacao";

const s = (over: Partial<ServicoOperacional> = {}): ServicoOperacional => ({
  id: "1", status: "concluido", ...over,
});

describe("mediana", () => {
  it("ímpar: o do meio", () => expect(mediana([5, 1, 3])).toBe(3));
  it("par: a média dos dois do meio", () => expect(mediana([1, 2, 3, 4])).toBe(3));
  it("sem valores não inventa zero", () => expect(mediana([])).toBeNull());

  it("um caso extremo não a desloca", () => {
    // É por isto que é mediana e não média: um serviço esquecido em aberto
    // durante três semanas punha a "média de resposta" em horas.
    expect(mediana([10, 12, 11, 30000])).toBe(12);
  });
});

describe("minutosEntre", () => {
  it("conta minutos", () => {
    expect(minutosEntre("2026-09-10T10:00:00Z", "2026-09-10T11:30:00Z")).toBe(90);
  });
  it("sem uma das datas devolve null", () => {
    expect(minutosEntre(undefined, "2026-09-10T11:00:00Z")).toBeNull();
    expect(minutosEntre("2026-09-10T11:00:00Z", undefined)).toBeNull();
  });
  it("fim antes do início é dado estragado, não duração negativa", () => {
    expect(minutosEntre("2026-09-10T12:00:00Z", "2026-09-10T11:00:00Z")).toBeNull();
  });
});

describe("construirOperacao", () => {
  it("o funil encolhe passo a passo", () => {
    const o = construirOperacao([
      s({ id: "1", status: "novo" }),
      s({ id: "2", status: "orcamento_enviado", technicianId: "t1" }),
      s({ id: "3", status: "pago", technicianId: "t1" }),
      s({ id: "4", status: "concluido", technicianId: "t2" }),
    ]);

    expect(o.total).toBe(4);
    expect(o.funil.map((p) => p.quantos)).toEqual([4, 3, 3, 2, 1, 1]);
    // Um pedido sem técnico perdeu-se logo no primeiro passo: 25%.
    expect(o.funil[1].perdaNoPasso).toBe(25);
  });

  it("o primeiro passo nunca tem perda", () => {
    const o = construirOperacao([s({ status: "novo" })]);
    expect(o.funil[0].perdaNoPasso).toBe(0);
    expect(o.funil[0].percentagem).toBe(100);
  });

  it("conta os estados do mais comum para o menos", () => {
    const o = construirOperacao([
      s({ id: "1", status: "novo" }), s({ id: "2", status: "concluido" }),
      s({ id: "3", status: "concluido" }), s({ id: "4", status: "concluido" }),
    ]);
    expect(o.porEstado[0]).toEqual({ estado: "concluido", quantos: 3 });
    expect(o.porEstado[1]).toEqual({ estado: "novo", quantos: 1 });
  });

  it("apanha qualquer forma de cancelado", () => {
    const o = construirOperacao([
      s({ id: "1", status: "cancelado_cliente" }),
      s({ id: "2", status: "cancelado_tecnico" }),
      s({ id: "3", status: "concluido" }),
      s({ id: "4", status: "novo" }),
    ]);
    expect(o.taxaCancelamento).toBe(50);
    expect(o.taxaConclusao).toBe(25);
  });

  it("os tempos vêm dos serviços que os têm, e diz quantos são", () => {
    const o = construirOperacao([
      s({ id: "1", responseTimeMinutes: 10 }),
      s({ id: "2", responseTimeMinutes: 20 }),
      s({ id: "3" }), // sem dado
    ]);
    expect(o.tempoAteResponder).toBe(15);
    // Sem a amostra, "15 minutos" podia ser de um serviço só.
    expect(o.amostras.responder).toBe(2);
  });

  it("sem nenhum serviço com tempo, o tempo é desconhecido e não zero", () => {
    const o = construirOperacao([s({ id: "1" }), s({ id: "2" })]);
    expect(o.tempoAteResponder).toBeNull();
    expect(o.tempoAteEncontrarTecnico).toBeNull();
    expect(o.duracaoDoServico).toBeNull();
    expect(o.amostras).toEqual({ responder: 0, encontrar: 0, duracao: 0 });
  });

  it("a duração sai das datas de início e fim", () => {
    const o = construirOperacao([
      s({ id: "1", startedAt: "2026-09-10T09:00:00Z", completedAt: "2026-09-10T11:00:00Z" }),
      s({ id: "2", startedAt: "2026-09-11T09:00:00Z", completedAt: "2026-09-11T10:00:00Z" }),
    ]);
    expect(o.duracaoDoServico).toBe(90);
    expect(o.amostras.duracao).toBe(2);
  });

  it("um tempo negativo não conta", () => {
    const o = construirOperacao([s({ id: "1", responseTimeMinutes: -5 })]);
    expect(o.tempoAteResponder).toBeNull();
  });

  it("sem serviços nenhuns não rebenta nem divide por zero", () => {
    const o = construirOperacao([]);
    expect(o.total).toBe(0);
    expect(o.taxaConclusao).toBe(0);
    expect(o.porEstado).toEqual([]);
    expect(o.funil.every((p) => p.quantos === 0 && p.perdaNoPasso === 0)).toBe(true);
  });
});
