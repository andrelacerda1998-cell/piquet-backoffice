import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface SmsCode {
  id: string;
  phone_number: string | null;
  code: string;
  type: string;
  user: { id: number; name: string } | null;
  created_at: string | null;
}

export interface SmsCodeList {
  items: SmsCode[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/sms-codes — histórico de códigos SMS emitidos (equivalente ao Filament SmsCodeResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<SmsCodeList>(`/v1/admin/sms-codes${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar os códigos SMS.", e instanceof ApiError ? e.status : 500);
  }
});
