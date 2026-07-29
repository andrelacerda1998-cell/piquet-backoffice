import { apiGet, apiPut } from "./api";
import type { PaginatedResult } from "@/types";

/**
 * Técnicos reais — migrado do Filament (App\Filament\Resources\VendorResource)
 * para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts e
 * App\Http\Controllers\Api\Admin\VendorController no backend.
 *
 * Só a "Lista" (+ Suspender/Reativar) desta fatia -- "Visão geral" continua a
 * usar techniciansService.ts (mock, ver mocks/data.ts) até uma fatia futura.
 * Forma mínima (id, nome, nif, contacto, preço/h, zonas, elegibilidade,
 * validação AT, estado, suspenso_em, criado_em) -- não os campos fictícios do
 * antigo `Technician` (categorias, avaliação, receita, serviços concluídos,
 * ...), que continuam a existir só para a Visão geral. Ver `Technician` em
 * src/types para essa forma antiga.
 */
export interface RealVendor {
  id: number;
  name: string | null;
  nif: string | null;
  phone_number: string | null;
  price_rate: number | null;
  operation_areas: string[];
  can_accept_service: boolean;
  at_valid: boolean;
  at_validated_at: string | null;
  status: string | null;
  suspended_at: string | null;
  created_at: string | null;
}

interface VendorsApiData {
  items: RealVendor[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getVendors(
  page = 1,
  pageSize = 20,
  search?: string,
  suspendedOnly = false
): Promise<PaginatedResult<RealVendor>> {
  const raw = await apiGet<VendorsApiData>(
    "/technicians",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: pageSize, total: 0 } }),
    { page, per_page: pageSize, search, suspended: suspendedOnly ? 1 : undefined }
  ).then((r) => r.data);

  return {
    data: raw.items,
    total: raw.meta.total,
    page: raw.meta.current_page,
    pageSize: raw.meta.per_page,
    totalPages: raw.meta.last_page,
  };
}

/**
 * Suspender/Reativar = soft-delete real do Vendor no Laravel. NOTA: no
 * Filament, só o super-admin pode mutar um vendor (o IBAN redireciona
 * payouts); a API de admin usa um token único partilhado por todo o staff
 * com acesso ao backoffice, por isso esta ação aqui NÃO tem essa restrição
 * -- decisão explícita (ver VendorController no backend).
 */
export async function suspendVendor(id: number): Promise<RealVendor> {
  return apiPut<RealVendor>(`/technicians/${id}/suspend`, {}, () => {
    throw new Error("Suspender técnicos precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function restoreVendor(id: number): Promise<RealVendor> {
  return apiPut<RealVendor>(`/technicians/${id}/restore`, {}, () => {
    throw new Error("Reativar técnicos precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
