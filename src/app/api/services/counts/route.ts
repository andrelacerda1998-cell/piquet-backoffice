import { apiOk, withStaff } from "../../_lib/handler";
import { serviceCountsForPeriod } from "../../_lib/metrics";
import { servicesFromLaravel, fetchAllLaravelServices } from "../../_lib/laravelServices";
import { contarExecutadosEAgendados } from "@/lib/contagemServicos";

/**
 * GET /api/services/counts — quantos serviços foram executados e quantos estão
 * agendados, no mês corrente e no ano corrente.
 *
 * O ano vai até ao FIM do ano (e não até hoje) porque os agendamentos são
 * futuros por definição: cortar em "hoje" dava sempre zero agendados.
 */
export const GET = withStaff(async () => {
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const iso = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1)).toISOString();

  /*
    Os serviços da app vivem no Laravel. Esta rota contava só o Supabase, onde
    em produção estão apenas os registados à mão -- e por isso os cartões de
    volume da Visão Geral nunca viam um serviço feito pela app.

    Uma travessia para as duas contas: o mês está dentro do ano.
  */
  if (servicesFromLaravel()) {
    const todos = await fetchAllLaravelServices();
    return apiOk({
      mes: contarExecutadosEAgendados(todos, iso(y, m), iso(y, m + 1)),
      ano: contarExecutadosEAgendados(todos, iso(y, 0), iso(y + 1, 0)),
    });
  }

  const [mes, ano] = await Promise.all([
    serviceCountsForPeriod(iso(y, m), iso(y, m + 1)),
    serviceCountsForPeriod(iso(y, 0), iso(y + 1, 0)),
  ]);

  return apiOk({ mes, ano });
});
