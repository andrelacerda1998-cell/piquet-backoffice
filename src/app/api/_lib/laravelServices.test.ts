/**
 * @vitest-environment node
 *
 * O MAPA DOS ESTADOS do Laravel para o backoffice.
 *
 * Faltavam oito dos dezanove, e caíam em silêncio em "Pedido recebido": um
 * técnico em casa do cliente aparecia como pedido novo, e o separador "Em
 * curso" esteve sempre vazio. Estes testes existem para que um estado novo no
 * Laravel não volte a desaparecer assim.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/laravelAdmin", () => ({ LARAVEL_ADMIN_ENABLED: false, laravelAdminRequest: vi.fn() }));

import { mapLaravelService } from "./laravelServices";

const estado = (status: string) => mapLaravelService({ id: 1, status }).status;

/** Copiado de app/Enums/Services/ServiceStatus.php (backend). Atualizar os dois juntos. */
const ESTADOS_DO_LARAVEL = [
  "Pending", "Matching", "PendingReview", "AwaitingPayment", "MatchingFailed", "Pending3DS",
  "Canceled", "Accepted", "Closed", "ClosedPendingPayment", "Refused", "Finished", "Arrived",
  "Scheduled", "Archived", "RefusedMbway", "ExpiredMbway", "CanceledMbway", "Expired3DS",
];

describe("mapa de estados do Laravel", () => {
  it("conhece os 19, e só o Pending é um pedido acabado de chegar", () => {
    expect(ESTADOS_DO_LARAVEL).toHaveLength(19);
    const caemNoRecebido = ESTADOS_DO_LARAVEL.filter((s) => estado(s) === "pedido_recebido");

    expect(caemNoRecebido).toEqual(["Pending"]);
  });

  it("o técnico em casa do cliente está em curso", () => {
    expect(estado("Arrived")).toBe("em_execucao");
  });

  it("um serviço marcado está agendado", () => {
    expect(estado("Scheduled")).toBe("agendado");
  });

  /**
   * O técnico diz que acabou; o cliente ainda não confirmou e o pagamento
   * ainda não foi capturado. Contá-lo como concluído punha no GMV dinheiro que
   * pode não entrar.
   */
  it("terminado pelo técnico ainda não é concluído", () => {
    expect(estado("Finished")).toBe("a_aguardar_confirmacao");
    expect(estado("Finished")).not.toBe("concluido");
  });

  it("só o fecho pelo cliente é concluído", () => {
    const concluidos = ESTADOS_DO_LARAVEL.filter((s) => estado(s) === "concluido");

    expect(concluidos).toEqual(["Closed"]);
  });

  /** Trabalho feito e captura falhada: o contrário de "à espera de pagar". */
  it("a captura falhada não se confunde com um pedido à espera de pagamento", () => {
    expect(estado("ClosedPendingPayment")).toBe("pagamento_por_capturar");
    expect(estado("AwaitingPayment")).toBe("a_aguardar_pagamento");
  });

  /**
   * O Filament só deixa arquivar a partir de Pending, Pending3DS e Scheduled:
   * pedidos que nunca foram executados.
   */
  it("arquivado não é concluído", () => {
    expect(estado("Archived")).toBe("arquivado");
  });

  it("as quatro perdas no pagamento terminam o pedido em vez de o deixar aberto", () => {
    for (const s of ["RefusedMbway", "ExpiredMbway", "CanceledMbway", "Expired3DS"]) {
      expect(estado(s), s).toBe("cancelado_cliente");
    }
  });

  it("um estado que ainda não existe cai em recebido, e não rebenta", () => {
    expect(estado("EstadoQueAindaNaoExiste")).toBe("pedido_recebido");
  });
});

/**
 * O Laravel não envia o estado da fatura nem o IVA. O mapa preenchia "não
 * emitida" e 0 €, e o detalhe do serviço mostrava as duas coisas como factos.
 */
describe("o que o Laravel não envia não se inventa", () => {
  it("sem estado de fatura fica sem estado, e não «não emitida»", () => {
    expect(mapLaravelService({ id: 1 }).invoiceStatus).toBeUndefined();
    expect(mapLaravelService({ id: 1, invoice_status: "emitida" }).invoiceStatus).toBe("emitida");
  });

  it("sem IVA fica sem IVA, e não 0 €", () => {
    expect(mapLaravelService({ id: 1 }).vatValue).toBeUndefined();
    expect(mapLaravelService({ id: 1, vat_value: 4.6 }).vatValue).toBe(4.6);
  });
});
