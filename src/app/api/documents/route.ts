import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface RequiredDocument {
  id: number;
  name: string;
  description: string | null;
  required: boolean;
  created_at: string | null;
}

export interface DocumentList {
  items: RequiredDocument[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/documents — lista de documentos (equivalente ao Filament DocumentResource). */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<DocumentList>(`/v1/admin/documents${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar os documentos.", e instanceof ApiError ? e.status : 500);
  }
});

/** POST /api/documents — cria um documento. */
export const POST = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<RequiredDocument>("/v1/admin/documents", { method: "POST", body });
    return apiOk(data, 201);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao criar o documento.", e instanceof ApiError ? e.status : 500);
  }
});
