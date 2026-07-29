import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { VendorDocument } from "../../route";

/**
 * PUT /api/vendor-documents/:id/approve — aprova um documento KYC pendente.
 * Isto NOTIFICA o técnico a sério (email + push), tal como no Filament.
 */
export const PUT = withStaff(async (req, { params }) => {
  const body = await req.json().catch(() => ({}));
  try {
    const data = await laravelAdminRequest<VendorDocument>(`/v1/admin/vendor-documents/${params.id}/approve`, { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao aprovar o documento.", e instanceof ApiError ? e.status : 500);
  }
});
