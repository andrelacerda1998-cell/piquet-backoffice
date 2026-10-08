import { apiOk, withStaff } from "../_lib/handler";
import { servicesFromLaravel } from "../_lib/laravelServices";
import { laravelAdminRequest } from "@/lib/laravelAdmin";

/**
 * GET /api/custom-requests — os pedidos personalizados REAIS.
 *
 * O ecrã mostrava seis inventados -- Helena Marques, Bruno Tavares, Condomínio
 * Estrela -- escritos à mão no código quando foi desenhado. Os verdadeiros
 * sempre existiram: são serviços com `is_custom`, com a descrição que o
 * cliente escreveu e as fotografias que anexou na app.
 *
 * Exposto pelo PR #83 do backend (22/09/2026).
 */

interface ServicoCru {
  id: string | number;
  is_custom?: boolean;
  custom_description?: string | null;
  custom_duration_minutes?: number | null;
  custom_categories?: string[] | null;
  customer_photos_count?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  city?: string | null;
  status?: string | null;
  requested_at?: string | null;
}

/** Estado do serviço → estado do pedido personalizado, como o ecrã os conhece. */
const ESTADO: Record<string, string> = {
  /*
    `PendingReview` é o estado em que um pedido personalizado NASCE: o cliente
    descreveu, e está à espera que a Piquet analise e defina o preço. É o que
    precisa de ação, por isso é o que aparece como "novo".

    Faltava aqui -- e sem ele todo o pedido acabado de chegar caía no ramo de
    omissão. Apanhado a 23/09/2026 ao preparar um teste de ponta a ponta,
    antes de o pedido existir.
  */
  PendingReview: "novo",
  /*
    Depois de a Piquet o despachar, é um pedido como os outros. Os nomes dos
    estados são os do ecrã antigo (que inventava um fluxo de "3 opções"); o
    ecrã mostra-os com o que querem dizer de verdade.
  */
  Pending: "em_analise",
  Matching: "em_analise",
  Accepted: "opcoes_enviadas",
  AwaitingPayment: "opcoes_enviadas",
  Pending3DS: "opcoes_enviadas",
  Scheduled: "opcoes_enviadas",
  Arrived: "opcoes_enviadas",
  ClosedPendingPayment: "opcoes_enviadas",
  Closed: "agendado",
  Finished: "agendado",
  /*
    Os que acabaram sem serviço caíam no ramo de omissão, "novo": um pedido
    que expirou ao fim do prazo de análise voltava a aparecer como novo, e o
    sino avisava dele.
  */
  MatchingFailed: "recusado",
  Canceled: "recusado",
  Refused: "recusado",
  Archived: "recusado",
  RefusedMbway: "recusado",
  ExpiredMbway: "recusado",
  CanceledMbway: "recusado",
  Expired3DS: "recusado",
};

export const GET = withStaff(async () => {
  if (!servicesFromLaravel()) return apiOk([]);

  /*
    Só os personalizados (`is_custom=1`), de TODAS as páginas.

    Lia antes o histórico inteiro para nada (o resultado não era usado) e
    depois só os 100 serviços mais recentes, onde procurava os
    personalizados: um mais antigo desaparecia do ecrã. E o sino pede isto a
    cada 45 segundos, a cada pessoa com o backoffice aberto. Um Laravel sem o
    filtro devolve todos e filtra-se aqui, como antes.
  */
  const crus: ServicoCru[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await laravelAdminRequest<{ items: ServicoCru[]; meta?: { last_page?: number } }>(
      `/v1/admin/services?is_custom=1&per_page=100&page=${pagina}`,
    );
    crus.push(...(r.items ?? []));
    if (pagina >= (r.meta?.last_page ?? 1)) break;
  }
  const personalizados = crus.filter((s) => s.is_custom);

  return apiOk(personalizados.map((s) => ({
    id: String(s.id),
    customerName: s.customer_name || "(sem nome)",
    phone: s.customer_phone || "",
    city: s.city || "",
    // Podem ser várias -- "montar um móvel e ligar uma tomada".
    category: (s.custom_categories ?? []).join(" · ") || "Por classificar",
    description: s.custom_description || "",
    // O Laravel não guarda urgência num pedido personalizado; não se inventa.
    urgency: null,
    // Um estado que não se conhece não é "novo": não pede ação a ninguém.
    status: ESTADO[String(s.status ?? "")] ?? "em_analise",
    createdAt: s.requested_at || "",
    estimatedHours: s.custom_duration_minutes != null ? s.custom_duration_minutes / 60 : null,
    photosCount: s.customer_photos_count ?? 0,
    proposals: [],
  })));
});
