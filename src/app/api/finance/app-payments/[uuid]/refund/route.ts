import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { motivoValido } from "@/lib/motivo";
import { anularRegisto, registarAcao } from "../../../../_lib/acoesDaEquipa";

export interface PaymentActionResult {
  uuid: string;
  status: string;
  amount: number;
  refunded: number;
}

/**
 * POST /api/finance/app-payments/:uuid/refund — devolve ao cliente dinheiro
 * já cobrado.
 *
 * Delega no Laravel (PaymentOrderController) em vez de chamar a API do
 * Paylands diretamente: o dinheiro da app já creditou a carteira do técnico e
 * a comissão do sistema, e só o backend sabe desfazer isso. O backend recusa
 * a operação se o serviço associado ainda estiver vivo.
 *
 * Pede um motivo, que fica em `acoes_da_equipa` com o nome de quem
 * reembolsou (o Laravel só vê o token partilhado do backoffice).
 */
export const POST = withStaff(async (req, { params, staff }) => {
  const b = (await req.json().catch(() => null)) as { amountCents?: number; motivo?: unknown; servicoId?: unknown } | null;
  const amount = b?.amountCents;
  const motivo = motivoValido(b?.motivo);
  if (!motivo) return apiErr("Escreve o motivo do reembolso (pelo menos 5 letras). Fica registado com o teu nome.", 422);

  const registo = await registarAcao(staff, "reembolsar_pagamento", "pagamento", params.uuid, motivo, {
    amountCents: amount ?? null,
    servicoId: typeof b?.servicoId === "string" ? b.servicoId : null,
  });
  if (!registo.ok) return apiErr(registo.erro, registo.status);
  try {
    const data = await laravelAdminRequest<PaymentActionResult>(
      `/v1/admin/payment-orders/${encodeURIComponent(params.uuid)}/refund`,
      { method: "POST", body: amount ? { amount } : {} },
    );
    return apiOk(data);
  } catch (e) {
    await anularRegisto(registo.id);
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao reembolsar.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
