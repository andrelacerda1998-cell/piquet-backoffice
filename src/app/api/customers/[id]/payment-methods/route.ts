import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

export interface CustomerPaymentMethod {
  id: number;
  type: string;
  brand: string | null;
  brand_description: string | null;
  last4: string | null;
  phone_number: string | null;
  holder: string | null;
  expire_month: string | null;
  expire_year: string | null;
  created_at: string | null;
}

interface CustomerPaymentMethodList {
  items: CustomerPaymentMethod[];
}

/** GET /api/customers/:id/payment-methods — cartões/MBWay guardados (equivalente ao Filament PaymentMethodsRelationManager). */
export const GET = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<CustomerPaymentMethodList>(`/v1/admin/customers/${params.id}/payment-methods`);
    return apiOk(data);
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Erro ao listar os métodos de pagamento.", e instanceof ApiError ? e.status : 500);
  }
});
