import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * PUT /api/technicians/:id/at-validation — valida (ou retira a validação do)
 * subutilizador do Portal das Finanças que o técnico deu à Piquet para emitir
 * faturas em nome dele.
 *
 * Validar testa as credenciais no InvoiceXpress, como o "Validar AT" do
 * Filament: se forem recusadas, o Laravel responde com a razão (409, 422 ou
 * 502) e a mensagem passa tal e qual.
 *
 * Depende de `PUT /v1/admin/vendors/{id}/at-validation` no Laravel
 * (backend#185). Se essa rota ainda não existir, devolvemos uma mensagem que
 * o diz claramente — o backoffice não deve fingir que gravou uma validação
 * fiscal.
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
    const mensagem = e instanceof ApiError ? e.message : "";
    /*
      Um 404 tanto pode ser a rota que falta como o técnico que já não existe.
      O Laravel distingue-os na mensagem: "The route … could not be found." vs
      "No query results for model …". Tratar os dois como rota em falta dizia
      "falar com o Rodrigo" quando só faltava atualizar a lista.
    */
    if (status === 405 || (status === 404 && /could not be found/i.test(mensagem))) {
      return apiErr(
        "O backend ainda não tem a rota de validação AT (PUT /v1/admin/vendors/{id}/at-validation). Falar com o Rodrigo.",
        501,
      );
    }
    if (status === 404) return apiErr("Este técnico já não existe. Atualiza a lista.", 404);
    return apiErr(mensagem || "Erro ao gravar a validação AT.", status);
  }
});
