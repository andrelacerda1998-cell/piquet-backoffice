import { apiGet, apiPost, apiPut } from "./api";

/**
 * Catálogo (tipos de serviço) + Categorias — migrado do Filament
 * (ServicesTypeResource/OperationAreaResource) para a API de admin do
 * Laravel. Ver src/lib/laravelAdmin.ts e
 * src/app/api/{services-types,operation-areas}/*.
 *
 * Fatia "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29).
 * Sem Zonas/AllowedZone (conceito de geografia, não de categoria — fica para
 * uma fatia futura; a aba "Zonas" em configuracao/_tabs continua fictícia).
 * Sem upload de imagem nem gestão de certificações (documents) por
 * simplicidade — ver notas nos controllers do Laravel.
 */

export interface OperationArea {
  id: number;
  name: string;
  vendors_count: number;
  services_types_count: number;
  created_at: string | null;
}

export interface OperationAreasData {
  items: OperationArea[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getOperationAreas(): Promise<OperationAreasData> {
  return apiGet<OperationAreasData>(
    "/operation-areas",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: 200, total: 0 } }),
    { per_page: 200 }
  ).then((r) => r.data);
}

export interface OperationAreaInput {
  name: string;
}

export async function createOperationArea(input: OperationAreaInput): Promise<OperationArea> {
  return apiPost<OperationArea>("/operation-areas", input, () => {
    throw new Error("Categorias precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function updateOperationArea(id: number, patch: Partial<OperationAreaInput>): Promise<OperationArea> {
  return apiPut<OperationArea>(`/operation-areas/${id}`, patch, () => {
    throw new Error("Categorias precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

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

export interface ServiceTypesData {
  items: ServiceType[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getServiceTypes(params?: { search?: string; operation_area_id?: number }): Promise<ServiceTypesData> {
  return apiGet<ServiceTypesData>(
    "/services-types",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } }),
    { per_page: 100, ...params }
  ).then((r) => r.data);
}

export interface ServiceTypeInput {
  name: string;
  operation_area_id: number;
  time: number;
  starts_from?: number | null;
  includes?: string[];
  excludes?: string[];
}

export async function createServiceType(input: ServiceTypeInput): Promise<ServiceType> {
  return apiPost<ServiceType>("/services-types", input, () => {
    throw new Error("Catálogo precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function updateServiceType(id: number, patch: Partial<ServiceTypeInput>): Promise<ServiceType> {
  return apiPut<ServiceType>(`/services-types/${id}`, patch, () => {
    throw new Error("Catálogo precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
