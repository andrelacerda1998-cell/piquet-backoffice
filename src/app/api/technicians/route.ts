import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface AdminVendor {
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

export interface AdminVendorsData {
  items: AdminVendor[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/**
 * GET /api/technicians — lista de técnicos, migrado do Filament
 * (App\Filament\Resources\VendorResource) para a API de admin do Laravel.
 * Substitui a versão anterior (Supabase, vista `technicians_enriched` com
 * dados de seed fictícios) -- ver App\Http\Controllers\Api\Admin\
 * VendorController no backend. Os restantes endpoints /technicians/* (metrics,
 * by-category, by-location, top, coverage) continuam ligados ao Supabase por
 * agora -- "Visão geral" fica para uma fatia futura.
 */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const qs = url.search;
  try {
    const data = await laravelAdminRequest<AdminVendorsData>(`/v1/admin/vendors${qs}`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler os técnicos.", e instanceof ApiError ? e.status : 500);
  }
});
