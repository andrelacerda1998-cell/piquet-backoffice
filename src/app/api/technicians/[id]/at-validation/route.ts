import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * PUT /api/technicians/:id/at-validation — valida (ou retira a validação do)
 * subutilizador do Portal das Finanças que o técnico deu à Piquet para emitir
 * faturas em nome dele.
 *
 * Depende de `PUT /v1/admin/vendors/{id}/at-validation` no Laravel. Se essa
 * rota ainda não existir, devolvemos uma mensagem que o diz claramente — o
 * backoffice não deve fingir que gravou uma validação fiscal.
 */
export const PUT = withStaff(async (req, { params }) => {
  const body = (await req.json().catch(() => ({}))) as { valid?: boolean };
  const valid = body.valid !== false; // por omissão, validar

  try {
    const data = await laravelAdminRequest<{ id: number; at_valid: boolean; at_validated_at: string | null }>(
      `/v1/admin/vendors/${params.id}/at-validation`,
      { method: "PUT", body: { valid } },
    );
    return apiOk(data);
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    if (status === 404 || status === 405) {
      return apiErr(
        "O backend ainda não tem a rota de validação AT (PUT /v1/admin/vendors/{id}/at-validation). Falar com o Rodrigo.",
        501,
      );
    }
    return apiErr(e instanceof ApiError ? e.message : "Erro ao gravar a validação AT.", status);
  }
});
