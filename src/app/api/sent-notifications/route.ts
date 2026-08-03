import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface SentNotification {
  id: string;
  recipient: { id: number; name: string } | null;
  recipient_type: "customer" | "vendor" | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export interface SentNotificationList {
  items: SentNotification[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/sent-notifications — histórico do que já foi enviado (equivalente ao Filament SentNotificationResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<SentNotificationList>(`/v1/admin/sent-notifications${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar as notificações enviadas.", e instanceof ApiError ? e.status : 500);
  }
});
