import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

interface PayResult {
  vendor_id: number;
  amount_paid: number;
}

/**
 * PUT /api/vendor-payments/:id/pay — marca o saldo do vendor como pago.
 * Isto NOTIFICA o vendor a sério (email + push) e zera o saldo interno —
 * a transferência bancária em si é feita manualmente pelo admin (por isso
 * o ecrã mostra o IBAN), tal como já acontecia no Filament.
 */
export const PUT = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<PayResult>(`/v1/admin/vendor-payments/${params.id}/pay`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao processar o pagamento.", e instanceof ApiError ? e.status : 500);
  }
});
