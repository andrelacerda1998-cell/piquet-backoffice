import { apiOk, withStaff } from "../../_lib/handler";
import { gmvDe, lerPagamentos } from "../../_lib/gmv";
import { inicioDoAnoLisboa, inicioDoMesLisboa, inicioDoMesSeguinteLisboa } from "@/lib/periodo";

/**
 * GET /api/finance/gmv — GMV e comissão do mês e do ano, com o período
 * anterior para comparação. O GMV é o cobrado no Payshop (ver _lib/gmv.ts).
 *
 * Meses e anos de Lisboa, como o resto do Financeiro. Eram de UTC: um
 * pagamento das 00:30 de dia 1 (hora de Lisboa) caía no mês anterior.
 */
export const GET = withStaff(async () => {
  const agora = new Date();
  const pagamentos = await lerPagamentos();

  const inicioMes = inicioDoMesLisboa(agora);
  const inicioMesAnterior = inicioDoMesLisboa(new Date(inicioMes.getTime() - 1));
  const inicioAno = inicioDoAnoLisboa(agora);
  // Homólogo: de 1 de janeiro do ano passado até este mesmo dia, há um ano.
  const haUmAno = new Date(agora);
  haUmAno.setFullYear(agora.getFullYear() - 1);

  return apiOk({
    month: gmvDe(pagamentos, inicioMes, inicioDoMesSeguinteLisboa(agora)),
    prevMonth: gmvDe(pagamentos, inicioMesAnterior, inicioMes),
    year: gmvDe(pagamentos, inicioAno),
    prevYearSame: gmvDe(pagamentos, inicioDoAnoLisboa(haUmAno), haUmAno),
  });
});
