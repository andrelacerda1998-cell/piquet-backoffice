import { describe, it, expect } from "vitest";
import { proximoPasso, haQuanto, type DadosDoPedido } from "./proximoPasso";
import type { EventoDoPedido } from "./historicoPedido";

const AGORA = Date.parse("2026-10-12T14:00:00Z");
const antes = (min: number) => new Date(AGORA - min * 60_000).toISOString();
const depois = (min: number) => new Date(AGORA + min * 60_000).toISOString();
const evento = (min: number, para: string): EventoDoPedido => ({
  tipo: "estado", de: null, para, vendor_id: null, vendor_name: null, dados: null, em: antes(min),
});
const pedido = (p: Partial<DadosDoPedido>): DadosDoPedido => ({ status: "a_procurar_tecnico", temTecnico: false, ...p });

describe("proximoPasso", () => {
  it("personalizado à espera da Piquet: despachar", () => {
    const r = proximoPasso(pedido({ status: "a_aguardar_orcamento", estadoLaravel: "PendingReview", personalizado: true, pedidoEm: antes(30) }), AGORA);
    expect(r).toMatchObject({ tom: "agir", acao: "despachar" });
    expect(r?.texto).toContain("há 30 min");
  });

  it("à procura com convidados por responder: esperar", () => {
    const r = proximoPasso(pedido({ convidados: { total: 6, aceitaram: 0, porResponder: 3 }, pedidoEm: antes(2) }), AGORA);
    expect(r).toMatchObject({ tom: "esperar" });
    expect(r?.texto).toContain("3 de 6");
  });

  it("todos os convidados recusaram ou deixaram expirar: ligar ao cliente", () => {
    const r = proximoPasso(pedido({ convidados: { total: 4, aceitaram: 0, porResponder: 0 } }), AGORA);
    expect(r).toMatchObject({ tom: "agir", acao: "ligar_cliente" });
  });

  it("ninguém convidado há mais de 10 min: ligar ao cliente; antes disso, esperar", () => {
    expect(proximoPasso(pedido({ convidados: { total: 0, aceitaram: 0, porResponder: 0 }, pedidoEm: antes(25) }), AGORA))
      .toMatchObject({ acao: "ligar_cliente" });
    expect(proximoPasso(pedido({ convidados: { total: 0, aceitaram: 0, porResponder: 0 }, pedidoEm: antes(3) }), AGORA))
      .toMatchObject({ tom: "esperar" });
  });

  it("acabou sem técnico há pouco: ligar; passado um dia, nada", () => {
    expect(proximoPasso(pedido({ status: "sem_tecnico_disponivel", eventos: [evento(4, "MatchingFailed")] }), AGORA))
      .toMatchObject({ acao: "ligar_cliente" });
    expect(proximoPasso(pedido({ status: "sem_tecnico_disponivel", eventos: [evento(60 * 30, "MatchingFailed")] }), AGORA)).toBeNull();
  });

  it("agendado: atrasado liga ao técnico; em breve avisa; longe espera", () => {
    expect(proximoPasso(pedido({ status: "agendado", temTecnico: true, marcadoPara: antes(40) }), AGORA))
      .toMatchObject({ tom: "agir", acao: "ligar_tecnico" });
    expect(proximoPasso(pedido({ status: "agendado", temTecnico: true, marcadoPara: depois(20) }), AGORA))
      .toMatchObject({ tom: "esperar" });
    expect(proximoPasso(pedido({ status: "agendado", temTecnico: true, marcadoPara: depois(60 * 48) }), AGORA)?.texto)
      .toContain("Nada a fazer");
  });

  it("à espera do pagamento há mais de 30 min: ligar ao cliente", () => {
    expect(proximoPasso(pedido({ status: "a_aguardar_pagamento", eventos: [evento(45, "AwaitingPayment")] }), AGORA))
      .toMatchObject({ acao: "ligar_cliente" });
    expect(proximoPasso(pedido({ status: "a_aguardar_pagamento", eventos: [evento(5, "AwaitingPayment")] }), AGORA))
      .toMatchObject({ tom: "esperar" });
  });

  it("técnico terminou e o cliente não confirmou num dia: fechar", () => {
    expect(proximoPasso(pedido({ status: "a_aguardar_confirmacao", temTecnico: true, eventos: [evento(60 * 30, "Finished")] }), AGORA))
      .toMatchObject({ tom: "agir", acao: "fechar" });
    expect(proximoPasso(pedido({ status: "a_aguardar_confirmacao", temTecnico: true, eventos: [evento(60, "Finished")] }), AGORA))
      .toMatchObject({ tom: "esperar" });
  });

  it("cobrança falhada: tentar cobrar", () => {
    expect(proximoPasso(pedido({ status: "pagamento_por_capturar", temTecnico: true }), AGORA))
      .toMatchObject({ tom: "agir", acao: "tentar_cobrar" });
  });

  it("reclamação passa à frente de tudo", () => {
    expect(proximoPasso(pedido({ status: "concluido", temReclamacao: true }), AGORA)).toMatchObject({ acao: "ver_ticket" });
  });

  it("concluído e cancelado: nada a fazer", () => {
    expect(proximoPasso(pedido({ status: "concluido", temTecnico: true }), AGORA)).toBeNull();
    expect(proximoPasso(pedido({ status: "cancelado_cliente" }), AGORA)).toBeNull();
  });

  it("usa o evento mais recente como 'desde', não a hora do pedido", () => {
    const r = proximoPasso(pedido({ status: "em_execucao", temTecnico: true, pedidoEm: antes(60 * 20), eventos: [evento(60 * 20, "Accepted"), evento(30, "Arrived")] }), AGORA);
    expect(r).toMatchObject({ tom: "esperar" });
    expect(r?.texto).toContain("há 30 min");
  });
});

describe("desde quando, sem histórico", () => {
  it("em curso conta desde que o técnico começou, não desde o pedido", () => {
    const r = proximoPasso(pedido({ status: "em_execucao", temTecnico: true, pedidoEm: antes(60 * 24 * 3), iniciadoEm: antes(45) }), AGORA);
    expect(r).toMatchObject({ tom: "esperar" });
    expect(r?.texto).toContain("há 45 min");
  });
});

describe("haQuanto", () => {
  it("minutos, horas e dias", () => {
    expect(haQuanto(AGORA - 4 * 60_000, AGORA)).toBe("há 4 min");
    expect(haQuanto(AGORA - 2 * 3_600_000, AGORA)).toBe("há 2 h");
    expect(haQuanto(AGORA - 3 * 86_400_000, AGORA)).toBe("há 3 dias");
    expect(haQuanto(AGORA - 86_400_000, AGORA)).toBe("há 1 dia");
  });
});
