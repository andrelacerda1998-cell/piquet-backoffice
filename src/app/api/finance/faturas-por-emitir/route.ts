import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { FaturasPorEmitir } from "@/lib/faturasPorEmitir";

/**
 * GET /api/finance/faturas-por-emitir — as faturas de serviços fechados que
 * ficaram por emitir, com o que falta a cada uma (backend#176). O dinheiro
 * desses serviços só se paga depois de a fatura sair.
 *
 * Um backend sem a rota (antes do deploy do #176) responde 404: aqui isso é
 * `ativo: false` e a secção não aparece, em vez de um erro no Financeiro.
 */
export const GET = withStaff(async () => {
  try {
    return apiOk(await laravelAdminRequest<FaturasPorEmitir>("/v1/admin/faturas-por-emitir"));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return apiOk({ ativo: false, items: [], total: 0 });
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler as faturas por emitir.", e instanceof ApiError ? e.status : 500);
  }
});
