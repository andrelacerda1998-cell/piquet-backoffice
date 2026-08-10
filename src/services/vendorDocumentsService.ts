import { apiGet, apiPut, API_URL, USE_REAL_API, currentToken } from "./api";

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

/**
 * Traz o ficheiro KYC já pronto a MOSTRAR (sem download) e devolve um `blob:`
 * para usar em <img>/<iframe>.
 *
 * Passa pelo proxy /vendor-documents/:id/file, que reenvia o documento com
 * `Content-Disposition: inline` (o armazenamento manda `attachment`, o que
 * obrigava o browser a descarregar). Como esse proxy exige sessão de staff e as
 * tags <img>/<iframe> não enviam o cabeçalho `Authorization`, buscamos aqui com
 * fetch autenticado e convertemos em object URL.
 *
 * Quem chama deve fazer `URL.revokeObjectURL(url)` ao fechar, para libertar
 * memória. Sem backend configurado devolve `null` (o chamador cai no file_url).
 */
export async function getVendorDocumentBlobUrl(id: number): Promise<string | null> {
  if (!USE_REAL_API || typeof window === "undefined") return null;
  const token = await currentToken();
  const res = await fetch(`${API_URL}/vendor-documents/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Não foi possível abrir o documento.");
  return URL.createObjectURL(await res.blob());
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
