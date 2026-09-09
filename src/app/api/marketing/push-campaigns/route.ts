import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/marketing/push-campaigns — campanhas de push, com os números reais.
 *
 * Substitui o separador "Push" que guardava campanhas em localStorage e gerava
 * entregas, aberturas e conversões com Math.random(). As campanhas sempre
 * existiram, mas no Laravel (App\Models\NotificationCampaign) e só visíveis no
 * Filament.
 */

export interface PushCampaignStats {
  enviados: number; entregues: number; falhados: number;
  abertos: number; cliques: number; saidas: number;
  /** `null` quando não há base para a percentagem. */
  taxa_entrega: number | null;
  taxa_abertura: number | null;
}

export interface PushCampaign {
  id: number;
  name: string;
  title: string;
  body: string;
  /** Quem recebe: "vendor" · "customer" · "both". */
  target_type: string | null;
  frequency_type: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  stats: PushCampaignStats;
}

interface Resposta {
  items: PushCampaign[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export const GET = withStaff(async (req) => {
  const qs = new URL(req.url).search;
  try {
    return apiOk(await laravelAdminRequest<Resposta>(`/v1/admin/notification-campaigns${qs}`));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler as campanhas de push.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
