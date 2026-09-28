import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { servicesFromLaravel, fetchAllLaravelServices } from "../../_lib/laravelServices";
import { ApiError } from "@/services/http";
import { construirOperacao, type Operacao } from "@/lib/operacao";

/**
 * GET /api/services/operacao — funil, distribuição de estados e tempos, dos
 * serviços REAIS.
 *
 * Num só endpoint de propósito: as três leituras saem da MESMA lista, e a
 * lista custa uma travessia paginada ao Laravel. Três endpoints separados
 * faziam três travessias para responder à mesma pergunta.
 */

export type { Operacao };

export const GET = withStaff(async () => {
  if (!servicesFromLaravel()) {
    return apiErr("Os serviços vivem no Laravel, e essa ligação não está ligada.", 503);
  }
  try {
    const servicos = await fetchAllLaravelServices();
    return apiOk(construirOperacao(servicos));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler os serviços.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
