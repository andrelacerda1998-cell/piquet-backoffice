import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/services/:id/fotos — as fotografias que o CLIENTE anexou ao pedido.
 *
 * O painel do serviço mostrava seis quadrados vazios, sempre seis, em qualquer
 * serviço: `Array.from({ length: 6 })`. Não lia nada. As fotos existem mesmo —
 * o cliente junta-as no checkout (até cinco), para o técnico perceber o
 * trabalho antes de chegar: a torneira que pinga, o quadro elétrico, o móvel
 * por montar.
 *
 * Os URL são temporários (60 minutos), assinados pelo Laravel. Não se guardam
 * nem se reencaminham: quem abre o painel vê, quem lá voltar amanhã pede de
 * novo.
 *
 * NÃO são as fotos do técnico. Essas são o antes/depois tirado no local, vivem
 * noutra coleção e servem para o proteger numa reclamação — mostrá-las aqui ao
 * lado das do cliente, sem dizer de quem são, confundiria as duas coisas.
 */

export interface FotoDoCliente {
  id: number;
  url: string;
}

export const GET = withStaff(async (_req, { params }) => {
  if (!LARAVEL_ADMIN_ENABLED) {
    return apiErr("As fotografias vivem no Laravel, e essa ligação não está ligada.", 503);
  }

  /*
    Só serviços do Laravel têm fotos. Os registados à mão no backoffice têm
    ids como `srv_0042` e vivem no Supabase — pedir as fotos desses ao Laravel
    daria um 404 que se leria como avaria.
  */
  const id = params.id;
  if (!/^\d+$/.test(id ?? "")) return apiOk<FotoDoCliente[]>([]);

  try {
    const servico = await laravelAdminRequest<{ customer_photos?: FotoDoCliente[] }>(
      `/v1/admin/services/${id}`,
    );
    return apiOk(servico.customer_photos ?? []);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler as fotografias.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
