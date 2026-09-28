import { describe, it, expect } from "vitest";
import { construirQualidade, type ServicoAvaliavel } from "./qualidade";

const servico = (over: Partial<ServicoAvaliavel> = {}): ServicoAvaliavel => ({
  id: "s1", status: "concluido", completedAt: "2026-09-10T10:00:00Z", ...over,
});

describe("construirQualidade", () => {
  it("só conta serviços concluídos", () => {
    const q = construirQualidade([
      servico({ id: "1", status: "concluido", rating: 5 }),
      servico({ id: "2", status: "agendado", rating: 5 }),
      servico({ id: "3", status: "cancelado", rating: 1 }),
    ]);
    expect(q.concluidos).toBe(1);
    expect(q.avaliados).toBe(1);
  });

  it("sem avaliações nenhumas devolve média nula e não 4,6", () => {
    // O mock devolvia 4.6 quando não havia dados. Uma média inventada num
    // ecrã de qualidade é pior do que um traço.
    const q = construirQualidade([servico({ rating: undefined })]);
    expect(q.media).toBeNull();
    expect(q.avaliados).toBe(0);
    expect(q.concluidos).toBe(1);
  });

  it("calcula a média com duas casas", () => {
    const q = construirQualidade([
      servico({ id: "1", rating: 5 }),
      servico({ id: "2", rating: 4 }),
      servico({ id: "3", rating: 4 }),
    ]);
    expect(q.media).toBe(4.33);
  });

  it("zero não é uma nota", () => {
    // `rating` a 0 é ausência gravada como número; contá-lo puxava a média
    // para baixo com uma avaliação que ninguém deu.
    const q = construirQualidade([
      servico({ id: "1", rating: 0 }),
      servico({ id: "2", rating: 4 }),
    ]);
    expect(q.avaliados).toBe(1);
    expect(q.media).toBe(4);
  });

  it("ignora notas fora do intervalo", () => {
    const q = construirQualidade([
      servico({ id: "1", rating: 7 }),
      servico({ id: "2", rating: -1 }),
      servico({ id: "3", rating: 3 }),
    ]);
    expect(q.avaliados).toBe(1);
    expect(q.media).toBe(3);
  });

  it("distribui por estrela, sempre com as cinco", () => {
    const q = construirQualidade([
      servico({ id: "1", rating: 5 }),
      servico({ id: "2", rating: 5 }),
      servico({ id: "3", rating: 1 }),
    ]);
    expect(q.distribuicao).toHaveLength(5);
    expect(q.distribuicao.find((d) => d.estrelas === 5)?.quantos).toBe(2);
    expect(q.distribuicao.find((d) => d.estrelas === 1)?.quantos).toBe(1);
    // Zero é uma resposta: a barra existe e está vazia.
    expect(q.distribuicao.find((d) => d.estrelas === 3)?.quantos).toBe(0);
  });

  it("agrupa por mês e não inventa meses vazios", () => {
    const q = construirQualidade([
      servico({ id: "1", rating: 4, completedAt: "2026-07-05T00:00:00Z" }),
      servico({ id: "2", rating: 2, completedAt: "2026-07-20T00:00:00Z" }),
      servico({ id: "3", rating: 5, completedAt: "2026-09-01T00:00:00Z" }),
    ]);
    // Agosto não aparece: não houve avaliações, e uma barra a zero leria-se
    // como uma queda.
    expect(q.porMes.map((m) => m.mes)).toEqual(["2026-07", "2026-09"]);
    expect(q.porMes[0]).toEqual({ mes: "2026-07", media: 3, avaliados: 2 });
  });

  it("usa a data do pedido quando não há data de conclusão", () => {
    const q = construirQualidade([
      servico({ id: "1", rating: 4, completedAt: undefined, requestedAt: "2026-06-02T00:00:00Z" }),
    ]);
    expect(q.porMes[0].mes).toBe("2026-06");
  });

  it("junta quem deu uma ou duas estrelas, do mais recente para trás", () => {
    const q = construirQualidade([
      servico({ id: "antigo", rating: 1, completedAt: "2026-07-01T00:00:00Z", technicianName: "Rui" }),
      servico({ id: "recente", rating: 2, completedAt: "2026-09-20T00:00:00Z", technicianName: "Ana" }),
      servico({ id: "bom", rating: 5, completedAt: "2026-09-21T00:00:00Z" }),
    ]);
    expect(q.insatisfeitos.map((i) => i.id)).toEqual(["recente", "antigo"]);
    expect(q.insatisfeitos[0].tecnico).toBe("Ana");
  });

  it("três estrelas não é insatisfeito", () => {
    const q = construirQualidade([servico({ rating: 3 })]);
    expect(q.insatisfeitos).toEqual([]);
  });

  it("sem serviços nenhuns não rebenta", () => {
    const q = construirQualidade([]);
    expect(q).toMatchObject({ concluidos: 0, avaliados: 0, media: null, porMes: [], insatisfeitos: [] });
    expect(q.distribuicao).toHaveLength(5);
  });

  it("aguenta um serviço sem técnico nem cliente", () => {
    const q = construirQualidade([servico({ rating: 1 })]);
    expect(q.insatisfeitos[0].tecnico).toBeNull();
    expect(q.insatisfeitos[0].cliente).toBeNull();
  });
});
