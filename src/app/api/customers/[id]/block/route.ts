import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { motivoValido } from "@/lib/motivo";
import { anularRegisto, registarAcao } from "../../../_lib/acoesDaEquipa";

interface BlockedCustomer {
  id: number;
  blocked_at: string | null;
}

/**
 * PUT /api/customers/:id/block — bloqueia o cliente (soft-delete real do
 * User no Laravel). Sem conceito nativo de "bloqueado" no backend -- reaproveita
 * o soft-delete, que já o remove das listagens normais.
 */
export const PUT = withStaff(async (req, { params, staff }) => {
  const body = (await req.json().catch(() => ({}))) as { motivo?: unknown };
  const motivo = motivoValido(body.motivo);
  if (!motivo) return apiErr("Escreve o motivo (pelo menos 5 letras). Fica registado com o teu nome.", 422);

  const registo = await registarAcao(staff, "bloquear_cliente", "cliente", params.id, motivo);
  if (!registo.ok) return apiErr(registo.erro, registo.status);
  try {
    const data = await laravelAdminRequest<BlockedCustomer>(`/v1/admin/customers/${params.id}/block`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    await anularRegisto(registo.id);
    return apiErr(e instanceof ApiError ? e.message : "Erro ao bloquear o cliente.", e instanceof ApiError ? e.status : 500);
  }
});
