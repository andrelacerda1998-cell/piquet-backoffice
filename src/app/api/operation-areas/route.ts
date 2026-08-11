import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface OperationArea {
  id: number;
  name: string;
  vendors_count: number;
  services_types_count: number;
  created_at: string | null;
}

export interface OperationAreaList {
  items: OperationArea[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/operation-areas — lista de categorias (equivalente ao Filament OperationAreaResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<OperationAreaList>(`/v1/admin/operation-areas${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar as categorias.", e instanceof ApiError ? e.status : 500);
  }
});

/** POST /api/operation-areas — cria uma categoria. */
export const POST = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<OperationArea>("/v1/admin/operation-areas", { method: "POST", body });
    return apiOk(data, 201);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao criar a categoria.", e instanceof ApiError ? e.status : 500);
  }
});
