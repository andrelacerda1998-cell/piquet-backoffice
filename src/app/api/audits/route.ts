import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface AuditEntry {
  id: number;
  who: string;
  action: string;
  entity: string;
  old_value: string | null;
  new_value: string | null;
  at: string | null;
}

export interface AuditList {
  items: AuditEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** GET /api/audits — feed de atividade (staff), a partir da tabela audits do Laravel. */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  try {
    const data = await laravelAdminRequest<AuditList>(`/v1/admin/audits${url.search}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar a atividade.", e instanceof ApiError ? e.status : 500);
  }
});
