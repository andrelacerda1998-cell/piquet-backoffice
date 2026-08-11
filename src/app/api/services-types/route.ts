import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface ServiceType {
  id: number;
  name: string;
  operation_area_id: number;
  operation_area_name: string | null;
  time: number | null;
  starts_from: number | null;
  includes: string[];
  excludes: string[];
  vendors_count: number;
  created_at: string | null;
}

export interface ServiceTypeList {
  items: ServiceType[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/services-types — lista do catálogo (equivalente ao Filament ServicesTypeResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<ServiceTypeList>(`/v1/admin/services-types${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar o catálogo.", e instanceof ApiError ? e.status : 500);
  }
});

/** POST /api/services-types — cria um tipo de serviço. */
export const POST = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<ServiceType>("/v1/admin/services-types", { method: "POST", body });
    return apiOk(data, 201);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao criar o tipo de serviço.", e instanceof ApiError ? e.status : 500);
  }
});
