import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { servicesFromLaravel, type LaravelServiceRow } from "../../../../_lib/laravelServices";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

/**
 * GET /api/marketing/leads/:id/timeline — o que aconteceu a este pedido.
 *
 * Só acontecimentos com data REAL. Um pedido que mudou de estado à mão no
 * backoffice não deixa rasto em lado nenhum -- não há tabela de histórico --
 * e inventar "mudou para Com técnico" a partir do estado atual seria escrever
 * ficção com ar de registo.
 *
 * Por isso a cronologia só é rica para os pedidos vindos da app: esses têm um
 * serviço no Laravel, com as horas de cada passo e quem foi convidado.
 */

interface Evento {
  em: string;
  titulo: string;
  detalhe?: string;
}

export const GET = withStaff(async (_req, { params }) => {
  const { data: lead, error } = await supabaseAdmin()
    .from("leads").select("created_at, source, laravel_service_id, technician_name")
    .eq("id", params.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);

  const l = lead as { created_at: string; source: string; laravel_service_id: string | null; technician_name: string | null };
  const eventos: Evento[] = [{
    em: l.created_at,
    titulo: "Pedido recebido",
    detalhe: l.source === "app" ? "Pela app" : l.source === "whatsapp" ? "Por WhatsApp" : "Pelo site",
  }];

  // Sem serviço na app não há mais nada verdadeiro para contar.
  if (!l.laravel_service_id || !servicesFromLaravel()) {
    return apiOk({ eventos, completo: false });
  }

  try {
    const s = await laravelAdminRequest<LaravelServiceRow>(`/v1/admin/services/${l.laravel_service_id}`);

    const c = s.candidates;
    if (c?.notified) {
      eventos.push({
        em: s.requested_at ?? l.created_at,
        titulo: `Perguntou-se a ${c.notified} ${c.notified === 1 ? "técnico" : "técnicos"}`,
        detalhe: [
          c.accepted ? `${c.accepted} aceitou` : null,
          c.declined ? `${c.declined} recusou` : null,
          c.expired ? `${c.expired} não respondeu` : null,
        ].filter(Boolean).join(" · ") || undefined,
      });
    }
    if (s.scheduled_at) eventos.push({ em: s.scheduled_at, titulo: "Marcado", detalhe: l.technician_name || undefined });
    if (s.on_the_way_at) eventos.push({ em: s.on_the_way_at, titulo: "Técnico a caminho" });
    if (s.started_at) eventos.push({ em: s.started_at, titulo: "Serviço começou" });
    if (s.completed_at) eventos.push({ em: s.completed_at, titulo: "Serviço concluído" });

    eventos.sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
    return apiOk({ eventos, completo: true });
  } catch {
    // O Laravel em baixo não deve esconder o que já sabemos.
    return apiOk({ eventos, completo: false });
  }
});
