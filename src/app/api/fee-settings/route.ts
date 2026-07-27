import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface FeeSettings {
  daytime: number;
  evening: number;
  night: number;
  late_night: number;
  midnight: number;
  kilometer_price: number;
  system_commission: number;
}

/** GET /api/fee-settings — definições globais de taxas (equivalente ao Filament FeeSettings). */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<FeeSettings>("/v1/admin/fee-settings");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler as definições de taxas.", e instanceof ApiError ? e.status : 500);
  }
});

/** PUT /api/fee-settings — atualiza as definições globais de taxas. */
export const PUT = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<FeeSettings>("/v1/admin/fee-settings", { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao gravar as definições de taxas.", e instanceof ApiError ? e.status : 500);
  }
});
