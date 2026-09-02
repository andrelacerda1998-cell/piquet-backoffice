import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { ServiceType } from "../route";

/** PUT /api/services-types/:id — edita um tipo de serviço. */
export const PUT = withStaff(async (req, { params }) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<ServiceType>(`/v1/admin/services-types/${params.id}`, { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao atualizar o tipo de serviço.", e instanceof ApiError ? e.status : 500);
  }
});

/**
 * DELETE /api/services-types/:id — remove o tipo de serviço do catálogo.
 * SoftDelete no backend: o histórico de serviços continua a resolver o nome.
 */
export const DELETE = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<{ id: number; deleted: boolean }>(
      `/v1/admin/services-types/${params.id}`,
      { method: "DELETE" },
    );
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao eliminar o tipo de serviço.", e instanceof ApiError ? e.status : 500);
  }
});
