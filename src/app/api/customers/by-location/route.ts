import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/** GET /api/customers/by-location — contagem real por cidade (morada principal). */
export const GET = withStaff(async () => {
  try {
    const data = await laravelAdminRequest<Array<{ name: string; value: number }>>("/v1/admin/customers/by-location");
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler clientes por localização.", e instanceof ApiError ? e.status : 500);
  }
});
