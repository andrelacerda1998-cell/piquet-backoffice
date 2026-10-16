import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { soOsCampos } from "@/lib/campanhasPush";

/**
 * GET /api/marketing/push-campaigns — campanhas de push, com os números reais.
 *
 * Substitui o separador "Push" que guardava campanhas em localStorage e gerava
 * entregas, aberturas e conversões com Math.random(). As campanhas sempre
 * existiram, mas no Laravel (App\Models\NotificationCampaign) e só visíveis no
 * Filament.
 *
 * POST — cria uma campanha como RASCUNHO, desligada (ver src/lib/campanhasPush.ts).
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
  /** Desligada e nunca enviada: edita-se e apaga-se. */
  rascunho?: boolean;
  /** Há inglês por rever: enquanto houver, não se liga. */
  ingles_por_rever?: boolean;
  textos?: { title: { "pt-pt": string; en: string }; body: { "pt-pt": string; en: string } };
  user_status?: string | null;
  vendor_eligibility?: string | null;
  vendor_missing_schedule_address?: boolean;
  customer_never_requested?: boolean;
  inactive_days?: number | null;
  open_type?: string | null;
  open_id?: number | null;
  frequency_value?: number | null;
  frequency_unit?: string | null;
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

export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiErr("Falta a campanha.");
  try {
    const campanha = await laravelAdminRequest<PushCampaign>("/v1/admin/notification-campaigns", {
      method: "POST",
      body: soOsCampos(b),
      staff: { email: staff.email, nome: staff.name },
    });
    return apiOk(campanha, 201);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Não foi possível guardar a campanha.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
