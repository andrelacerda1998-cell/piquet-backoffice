import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * DELETE /api/technicians/:id/permanent — apaga o técnico DE VEZ.
 *
 * Não é o `suspend`, que faz soft delete e tem volta. Aqui o utilizador é
 * removido e leva atrás o técnico e tudo o que pende dele: avaliações,
 * documentos, candidaturas a pedidos, zonas, tickets, agenda.
 *
 * O QUE FICA: os serviços que a pessoa executou, sem dono (`vendor_id` passa a
 * NULL no Laravel). O GMV total continua certo; o GMV por técnico deixa de
 * fechar. O Laravel devolve quantos ficaram assim em `orphan_services`, e esse
 * número sobe até ao ecrã em vez de ficar num log -- quem carrega no botão
 * merece saber o que custou.
 */
export const DELETE = withStaff(async (_req, { params }) => {
  try {
    const data = await laravelAdminRequest<{ id: number; deleted: boolean; orphan_services: number }>(
      `/v1/admin/vendors/${params.id}/permanent`,
      { method: "DELETE" },
    );
    return apiOk(data);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao apagar o técnico.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
