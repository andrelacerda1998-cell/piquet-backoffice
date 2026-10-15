import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequestComMeta } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import type { ProcuraEOferta, ProcuraPorCidade } from "@/services/vendorsService";

/**
 * GET /api/technicians/coverage — procura (serviços reais) vs oferta por
 * cidade (App\Http\Controllers\Api\Admin\VendorController::coverage()), não
 * mais as 6 cidades fixas do mock. A oferta vem do questionário antigo e,
 * desde o backend#185, também pelas cidades escolhidas na app. Desde o
 * backend#192 só vêm cidades do catálogo, e os pedidos que não ficam em
 * nenhuma vêm à parte no `metaData`.
 */
export const GET = withStaff(async () => {
  try {
    const { data, metaData } = await laravelAdminRequestComMeta<ProcuraEOferta[], { pedidos_fora_das_cidades: number }>(
      "/v1/admin/vendors/coverage"
    );
    const fora = metaData?.pedidos_fora_das_cidades;
    return apiOk<ProcuraPorCidade>({ cidades: data, foraDasCidades: typeof fora === "number" ? fora : null });
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler a cobertura por zona.", e instanceof ApiError ? e.status : 500);
  }
});
