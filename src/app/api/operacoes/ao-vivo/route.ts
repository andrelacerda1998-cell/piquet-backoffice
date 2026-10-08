import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { estadoDoBackoffice } from "../../_lib/laravelServices";
import type { AoVivo, PedidoBase } from "@/lib/aoVivo";

/**
 * GET /api/operacoes/ao-vivo — o estado do marketplace agora (Laravel:
 * GET /v1/admin/operacoes/ao-vivo). `?incluir_testes=1` junta as contas de
 * teste, para experimentar o fluxo sem mexer nos números reais.
 *
 * Só traduz o estado de cada pedido para o vocabulário do backoffice: as
 * contas são todas do Laravel, que é onde estão os convites e os prazos.
 */
type Bruto = Omit<AoVivo, "a_procura" | "em_curso" | "perdidos"> & {
  a_procura: Array<Omit<AoVivo["a_procura"][number], "estadoBackoffice">>;
  em_curso: Array<Omit<AoVivo["em_curso"][number], "estadoBackoffice">>;
  perdidos: Array<Omit<AoVivo["perdidos"][number], "estadoBackoffice">>;
};

const comEstado = <T extends Omit<PedidoBase, "estadoBackoffice">>(lista: T[]) =>
  lista.map((p) => ({ ...p, estadoBackoffice: estadoDoBackoffice(p.estado) }));

export const GET = withStaff(async (req) => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr("API de admin do Laravel não configurada.", 503);
  const testes = new URL(req.url).searchParams.get("incluir_testes") === "1";

  try {
    const d = await laravelAdminRequest<Bruto>(`/v1/admin/operacoes/ao-vivo${testes ? "?incluir_testes=1" : ""}`);
    return apiOk<AoVivo>({
      ...d,
      a_procura: comEstado(d.a_procura ?? []),
      em_curso: comEstado(d.em_curso ?? []),
      perdidos: comEstado(d.perdidos ?? []),
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return apiErr("O Laravel ainda não tem as Operações ao vivo (falta o deploy do backend #158).", 503);
    }
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler as operações.", e instanceof ApiError ? e.status : 500);
  }
});
