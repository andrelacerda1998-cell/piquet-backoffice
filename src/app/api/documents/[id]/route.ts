import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { RequiredDocument } from "../route";

/** PUT /api/documents/:id — edita um documento. */
export const PUT = withStaff(async (req, { params }) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<RequiredDocument>(`/v1/admin/documents/${params.id}`, { method: "PUT", body });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao atualizar o documento.", e instanceof ApiError ? e.status : 500);
  }
});
