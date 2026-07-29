import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface VendorDocument {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  document_type: string | null;
  status: "pending" | "approved" | "declined";
  reason: string | null;
  expiration_date: string | null;
  file_url: string | null;
  created_at: string | null;
}

export interface VendorDocumentsData {
  items: VendorDocument[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/**
 * GET /api/vendor-documents — fila de revisão KYC dos técnicos. Equivalente
 * às ações "Verificar"/"Recusar" do Filament (VendorDocumentTextEntry).
 */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const qs = url.search; // reencaminha status/page/per_page tal como recebidos
  try {
    const data = await laravelAdminRequest<VendorDocumentsData>(`/v1/admin/vendor-documents${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os documentos.", e instanceof ApiError ? e.status : 500);
  }
});
