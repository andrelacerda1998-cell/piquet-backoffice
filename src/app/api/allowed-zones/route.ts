import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface AllowedZone {
  id: number;
  city: string;
  district: string | null;
  vendors_count: number;
  created_at: string | null;
}

export interface AllowedZoneList {
  items: AllowedZone[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/allowed-zones — lista de zonas (equivalente ao Filament AllowedZoneResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<AllowedZoneList>(`/v1/admin/allowed-zones${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar as zonas.", e instanceof ApiError ? e.status : 500);
  }
});

/** POST /api/allowed-zones — cria uma zona. */
export const POST = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<AllowedZone>("/v1/admin/allowed-zones", { method: "POST", body });
    return apiOk(data, 201);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao criar a zona.", e instanceof ApiError ? e.status : 500);
  }
});
