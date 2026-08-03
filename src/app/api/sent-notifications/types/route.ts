import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface NotificationTypeOption {
  value: string;
  label: string;
}

/** GET /api/sent-notifications/types — opções para o filtro por tipo. */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<{ items: NotificationTypeOption[] }>("/v1/admin/sent-notifications/types");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar os tipos de notificação.", e instanceof ApiError ? e.status : 500);
  }
});
