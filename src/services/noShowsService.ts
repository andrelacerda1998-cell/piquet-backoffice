import { apiGet, apiPost } from "./api";

/**
 * Faltas de técnicos — a fila para declarar e o histórico do que foi cobrado.
 *
 * Via API de admin do Laravel (ver src/lib/laravelAdmin.ts e
 * App\Http\Controllers\Api\Admin\VendorNoShowListController /
 * VendorNoShowController no backend). Não há versão mock: isto tira dinheiro
 * a pessoas, e uma lista inventada aqui seria um botão que "funciona" sem
 * fazer nada.
 */

export interface NoShowService {
  service_id: number;
  status: string;
  service_type: string | null;
  scheduled_day: string | null;
  scheduled_time: string | null;
  customer: { id: number; name: string | null; phone_number: string | null } | null;
  vendor: { id: number | null; name: string | null; phone_number: string | null };
  on_the_way_at: string | null;
  /** Cêntimos. */
  amount_for_vendor: number;
  /** Cêntimos — o que a falta custaria ao técnico se for declarada. */
  penalty_if_declared: number;
  vendor_no_show_at: string | null;
  /** Cêntimos — o que foi mesmo cobrado. */
  vendor_no_show_penalty: number | null;
}

export interface NoShowsData {
  suspected: NoShowService[];
  declared: NoShowService[];
  penalty_ratio: number;
}

export async function getVendorNoShows(): Promise<NoShowsData> {
  return apiGet<NoShowsData>("/vendor-no-shows", () => ({ suspected: [], declared: [], penalty_ratio: 0.5 })).then(
    (r) => r.data
  );
}

export interface DeclareResult {
  service: { id: number; vendor_no_show_at: string | null; penalty: number };
}

export async function declareVendorNoShow(serviceId: number): Promise<DeclareResult> {
  return apiPost<DeclareResult>(`/vendor-no-shows/${serviceId}/declare`, {}, () => {
    throw new Error("Declarar faltas precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
