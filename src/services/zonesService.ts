import { apiGet, apiPost, apiPut } from "./api";
import type { ContagemPelasCidades, SemCidades } from "@/lib/pelasCidades";

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
  /** Quem marcou a zona no questionário antigo da app, que parou no tempo. */
  vendors_count: number;
  /**
   * Quem recebe um pedido no centro da zona, pelas cidades que escolheu na
   * app, e desses quantos já podem trabalhar (ver lib/pelasCidades). Só vêm
   * do backend a partir do backend#185 -- até lá, `undefined`.
   */
  tecnicos_nas_cidades?: number;
  podem_trabalhar?: number;
  contagem?: ContagemPelasCidades;
  created_at: string | null;
}

export interface AllowedZonesData {
  items: AllowedZone[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    /** Quem não escolheu cidades: no matching recebe de qualquer zona. */
    sem_cidades?: SemCidades;
  };
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
