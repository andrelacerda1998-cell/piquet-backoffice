import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { motivoValido } from "@/lib/motivo";
import { anularRegisto, registarAcao } from "../../../_lib/acoesDaEquipa";

interface SuspendedVendor {
  id: number;
  suspended_at: string | null;
}

/**
 * PUT /api/technicians/:id/suspend — suspende o técnico (soft-delete real do
 * Vendor no Laravel). Ver nota sobre a restrição de super-admin do Filament
 * NÃO ser replicada aqui, em App\Http\Controllers\Api\Admin\VendorController.
 */
export const PUT = withStaff(async (req, { params, staff }) => {
  const body = (await req.json().catch(() => ({}))) as { motivo?: unknown };
  const motivo = motivoValido(body.motivo);
  if (!motivo) return apiErr("Escreve o motivo (pelo menos 5 letras). Fica registado com o teu nome.", 422);

  const registo = await registarAcao(staff, "suspender_tecnico", "tecnico", params.id, motivo);
  if (!registo.ok) return apiErr(registo.erro, registo.status);
  try {
    const data = await laravelAdminRequest<SuspendedVendor>(`/v1/admin/vendors/${params.id}/suspend`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    await anularRegisto(registo.id);
    return apiErr(e instanceof ApiError ? e.message : "Erro ao suspender o técnico.", e instanceof ApiError ? e.status : 500);
  }
});
