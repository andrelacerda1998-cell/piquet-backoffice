import { apiGet, apiPost, apiPut } from "./api";

/**
 * Zonas — migrado do Filament (AllowedZoneResource) para a API de admin do
 * Laravel. Ver src/lib/laravelAdmin.ts e src/app/api/allowed-zones/*.
 *
 * Fatia "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29):
 * sem apagar (o modelo não tem soft-delete no Laravel), sem controlo de
 * acesso (o Filament restringe a super-admin; o backoffice ainda não tem
 * perfis) e "city"/"district" são texto livre em vez do autocomplete do
 * Google Places usado no Filament.
 */

export interface AllowedZone {
  id: number;
  city: string;
  district: string | null;
  vendors_count: number;
  created_at: string | null;
}

export interface AllowedZonesData {
  items: AllowedZone[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getZones(search?: string): Promise<AllowedZonesData> {
  return apiGet<AllowedZonesData>(
    "/allowed-zones",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: 200, total: 0 } }),
    { per_page: 200, search }
  ).then((r) => r.data);
}

export interface AllowedZoneInput {
  city: string;
  district?: string | null;
}

export async function createZone(input: AllowedZoneInput): Promise<AllowedZone> {
  return apiPost<AllowedZone>("/allowed-zones", input, () => {
    throw new Error("Zonas precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function updateZone(id: number, patch: Partial<AllowedZoneInput>): Promise<AllowedZone> {
  return apiPut<AllowedZone>(`/allowed-zones/${id}`, patch, () => {
    throw new Error("Zonas precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
