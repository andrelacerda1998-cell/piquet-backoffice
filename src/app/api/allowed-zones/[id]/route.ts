import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { AllowedZone } from "../route";

/** PUT /api/allowed-zones/:id — edita uma zona. */
export const PUT = withStaff(async (req, { params }) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<AllowedZone>(`/v1/admin/allowed-zones/${params.id}`, { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao atualizar a zona.", e instanceof ApiError ? e.status : 500);
  }
});
