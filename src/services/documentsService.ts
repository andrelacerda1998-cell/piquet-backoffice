import { apiGet, apiPost, apiPut } from "./api";

/**
 * Documentos — migrado do Filament (DocumentResource) para a API de admin do
 * Laravel. Ver src/lib/laravelAdmin.ts e src/app/api/documents/*.
 *
 * Fatia "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29,
 * mesmo padrão de Catálogo/Categorias/Zonas). 'name'/'description' são
 * traduzíveis no Filament (EN + PT-PT); aqui usam-se campos únicos,
 * gravados nas duas línguas pelo backend.
 */

export interface RequiredDocument {
  id: number;
  name: string;
  description: string | null;
  required: boolean;
  created_at: string | null;
}

export interface DocumentsData {
  items: RequiredDocument[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getDocuments(): Promise<DocumentsData> {
  return apiGet<DocumentsData>(
    "/documents",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: 200, total: 0 } }),
    { per_page: 200 }
  ).then((r) => r.data);
}

export interface DocumentInput {
  name: string;
  description?: string | null;
  required?: boolean;
}

export async function createDocument(input: DocumentInput): Promise<RequiredDocument> {
  return apiPost<RequiredDocument>("/documents", input, () => {
    throw new Error("Documentos precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function updateDocument(id: number, patch: Partial<DocumentInput>): Promise<RequiredDocument> {
  return apiPut<RequiredDocument>(`/documents/${id}`, patch, () => {
    throw new Error("Documentos precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
