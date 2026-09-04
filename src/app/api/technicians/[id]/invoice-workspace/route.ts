import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { AdminVendor } from "../../route";

/**
 * POST /api/technicians/:id/invoice-workspace — cria o workspace de faturação
 * do técnico no InvoiceXpress.
 *
 * Sem workspace a Piquet não emite fatura em nome do técnico no fim do
 * serviço. As condições (contacto verificado, documentos aprovados, IBAN,
 * morada fiscal) são validadas no Laravel, que devolve 409 com a razão exata.
 */
export const POST = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<AdminVendor>(
      `/v1/admin/vendors/${params.id}/invoice-workspace`,
      { method: "POST" },
    );
    return apiOk(data);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao criar o workspace de faturação.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
