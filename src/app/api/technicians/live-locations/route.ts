import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface VendorLiveLocation {
  id: number;
  name: string | null;
  is_test: boolean;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
  categories: string[];
}

/**
 * GET /api/technicians/live-locations — técnicos Online com localização
 * atualizada nos últimos 10 min (App\Http\Controllers\Api\Admin\
 * VendorController::liveLocations()). Só informativo: mostra onde os
 * técnicos disponíveis andam, não interfere no matching/fluxo de pedidos
 * (esse continua inteiramente na app). `?include_test=1` passa a incluir
 * contas de teste (excluídas por omissão) — usado só para validar o mapa.
 */
export const GET = withStaff(async (req) => {
  const qs = new URL(req.url).search;
  try {
    const data = await laravelAdminRequest<VendorLiveLocation[]>(`/v1/admin/vendors/live-locations${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler as localizações dos técnicos.", e instanceof ApiError ? e.status : 500);
  }
});
