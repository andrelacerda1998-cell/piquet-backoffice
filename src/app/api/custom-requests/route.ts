import { apiOk, withStaff } from "../_lib/handler";
import { servicesFromLaravel, fetchAllLaravelServices } from "../_lib/laravelServices";
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
  Pending: "novo",
  Matching: "em_analise",
  Accepted: "opcoes_enviadas",
  AwaitingPayment: "opcoes_enviadas",
  Closed: "agendado",
  Finished: "agendado",
};

export const GET = withStaff(async () => {
  if (!servicesFromLaravel()) return apiOk([]);

  const todos = await fetchAllLaravelServices();
  /*
    `fetchAllLaravelServices` devolve a forma que o resto do backoffice usa e
    perde os campos do pedido personalizado pelo caminho. Uma segunda leitura
    crua é mais barata do que alargar aquele mapeamento a campos que só este
    ecrã precisa.
  */
  const crus = await laravelAdminRequest<{ items: ServicoCru[] }>("/v1/admin/services?per_page=100");

  const personalizados = (crus.items ?? []).filter((s) => s.is_custom);

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
    status: ESTADO[String(s.status ?? "")] ?? "novo",
    createdAt: s.requested_at || "",
    estimatedHours: s.custom_duration_minutes != null ? s.custom_duration_minutes / 60 : null,
    photosCount: s.customer_photos_count ?? 0,
    proposals: [],
  })));
});
