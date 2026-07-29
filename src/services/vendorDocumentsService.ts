import { apiGet, apiPut } from "./api";

/**
 * Revisão de documentos KYC dos técnicos — migrado do Filament
 * (VendorDocumentTextEntry: ações "Verificar"/"Recusar") para a API de admin
 * do Laravel. Ver src/lib/laravelAdmin.ts e src/app/api/vendor-documents/*.
 *
 * Aprovar/recusar aqui é uma ação real: o Laravel notifica o técnico (email +
 * push), tal como no Filament — não é um formulário local.
 */
export type VendorDocumentStatus = "pending" | "approved" | "declined";

export interface VendorDocument {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  document_type: string | null;
  status: VendorDocumentStatus;
  reason: string | null;
  expiration_date: string | null;
  file_url: string | null;
  created_at: string | null;
}

export interface VendorDocumentsData {
  items: VendorDocument[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getVendorDocuments(status: VendorDocumentStatus = "pending", page = 1, perPage = 20): Promise<VendorDocumentsData> {
  return apiGet<VendorDocumentsData>(
    "/vendor-documents",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: perPage, total: 0 } }),
    { status, page, per_page: perPage }
  ).then((r) => r.data);
}

export async function approveVendorDocument(id: number, expirationDate?: string | null): Promise<VendorDocument> {
  return apiPut<VendorDocument>(`/vendor-documents/${id}/approve`, { expiration_date: expirationDate || null }, () => {
    throw new Error("Documentos KYC precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function declineVendorDocument(id: number, reason: string): Promise<VendorDocument> {
  return apiPut<VendorDocument>(`/vendor-documents/${id}/decline`, { reason }, () => {
    throw new Error("Documentos KYC precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
