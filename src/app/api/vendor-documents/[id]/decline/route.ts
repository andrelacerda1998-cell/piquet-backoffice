import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { VendorDocument } from "../../route";

/**
 * PUT /api/vendor-documents/:id/decline — recusa um documento KYC pendente,
 * com motivo obrigatório. NOTIFICA o técnico a sério (email + push).
 */
export const PUT = withStaff(async (req, { params }) => {
  const body = await req.json().catch(() => ({}));
  try {
    const data = await laravelAdminRequest<VendorDocument>(`/v1/admin/vendor-documents/${params.id}/decline`, { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao recusar o documento.", e instanceof ApiError ? e.status : 500);
  }
});
