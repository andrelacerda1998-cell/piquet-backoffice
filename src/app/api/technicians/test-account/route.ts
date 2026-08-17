import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface NewTestVendor {
  id: number;
  name: string;
  email: string;
  password: string;
  phone_number: string;
}

/**
 * POST /api/technicians/test-account — cria um técnico de teste (is_test=
 * true) já pronto a ficar Online na app (App\Http\Controllers\Api\Admin\
 * VendorController::createTestAccount()). A password vem na resposta uma
 * única vez — não fica guardada em lado nenhum do backoffice.
 */
export const POST = withStaff(async (req) => {
  const body = await req.json();
  try {
    const data = await laravelAdminRequest<NewTestVendor>("/v1/admin/vendors/test-account", {
      method: "POST",
      body,
    });
    return apiOk(data);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao criar a conta de teste.",
      e instanceof ApiError ? e.status : 500
    );
  }
});
