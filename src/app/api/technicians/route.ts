import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface AdminVendor {
  id: number;
  name: string | null;
  nif: string | null;
  phone_number: string | null;
  price_rate: number | null;
  /*
    Categorias (CANALIZAÇÃO, LIMPEZAS, ...). Apesar do nome, não são zonas
    geográficas -- e estão preenchidas em pouquíssimos técnicos.
  */
  operation_areas: string[];
  /*
    Os serviços do catálogo que o técnico escolheu fazer ("Montar Cama de
    Solteiro", "Instalação de Torneira", ...). É por aqui que o matching
    decide se ele serve para um pedido, e é a resposta certa a "o que é que
    este técnico faz". Exposto pelo PR #70 do backend (18/09/2026).
  */
  services_types?: string[];
  can_accept_service: boolean;
  at_valid: boolean;
  at_validated_at: string | null;
  at_user?: string | null;
  company_name?: string | null;
  iban?: string | null;
  /** Workspace de faturação (InvoiceXpress). `null` = ainda não criado. */
  invoice_workspace?: string | null;
  /** Porque é que ainda não se pode criar o workspace (`null` = pode). */
  invoice_workspace_blocker?: string | null;
  /*
    O MESMO bloqueio, em código em vez de frase: "documents_pending",
    "iban_missing", "fiscal_address_missing", "contact_unverified", ou `null`
    quando não falta nada. A frase é para mostrar ao lado de um botão; o
    código é o que se pode agrupar e testar.
  */
  account_blocker?: string | null;
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
