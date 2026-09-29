import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { PaymentActionResult } from "../refund/route";

/**
 * POST /api/finance/app-payments/:uuid/cancel — liberta o valor cativo.
 *
 * Não é reembolso: o dinheiro nunca saiu da conta do cliente, estava reservado.
 * Só funciona em pagamentos com cativo ativo (PENDING_CONFIRMATION).
 */
export const POST = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<PaymentActionResult>(
      `/v1/admin/payment-orders/${encodeURIComponent(params.uuid)}/cancel`,
      { method: "POST" },
    );
    return apiOk(data);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao libertar o cativo.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
