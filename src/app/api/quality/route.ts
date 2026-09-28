import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { servicesFromLaravel, fetchAllLaravelServices } from "../_lib/laravelServices";
import { ApiError } from "@/services/http";
import { construirQualidade, type Qualidade } from "@/lib/qualidade";

/**
 * GET /api/quality — qualidade a partir das avaliações REAIS dos clientes.
 *
 * Substitui o mock, que devolvia NPS 62 (não existe inquérito de NPS), uma
 * série mensal calculada por `4.3 + (i % 3) * 0.15`, uma distribuição de
 * estrelas com `star * 30` de recurso, e cinco motivos de reclamação com
 * percentagens escritas à mão no código.
 *
 * A nota que o cliente dá no fim do serviço existe — `rating_by_customer` —
 * e já vem na listagem da API de admin. É pouco e é verdade.
 */

export type { Qualidade };

export const GET = withStaff(async () => {
  if (!servicesFromLaravel()) {
    return apiErr(
      "As avaliações vivem nos serviços do Laravel, e essa ligação não está ligada.",
      503,
    );
  }
  try {
    const servicos = await fetchAllLaravelServices();
    return apiOk(construirQualidade(servicos));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler as avaliações.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
