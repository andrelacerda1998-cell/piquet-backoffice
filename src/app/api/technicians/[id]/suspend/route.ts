import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

interface SuspendedVendor {
  id: number;
  suspended_at: string | null;
}

/**
 * PUT /api/technicians/:id/suspend — suspende o técnico (soft-delete real do
 * Vendor no Laravel). Ver nota sobre a restrição de super-admin do Filament
 * NÃO ser replicada aqui, em App\Http\Controllers\Api\Admin\VendorController.
 */
export const PUT = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<SuspendedVendor>(`/v1/admin/vendors/${params.id}/suspend`, { method: "PUT" });
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao suspender o técnico.", e instanceof ApiError ? e.status : 500);
  }
});
