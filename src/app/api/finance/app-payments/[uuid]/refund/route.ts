import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

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
 */
export const POST = withStaff(async (req, { params }) => {
  const b = (await req.json().catch(() => null)) as { amountCents?: number } | null;
  const amount = b?.amountCents;
  try {
    const data = await laravelAdminRequest<PaymentActionResult>(
      `/v1/admin/payment-orders/${encodeURIComponent(params.uuid)}/refund`,
      { method: "POST", body: amount ? { amount } : {} },
    );
    return apiOk(data);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao reembolsar.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
