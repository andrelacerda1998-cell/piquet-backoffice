/**
 * Janela de recolha do cron `ad-metrics`.
 *
 * Por omissão são os últimos 7 dias — as plataformas ajustam conversões
 * retroativamente durante esse prazo, por isso reprocessa-se. Mas se a
 * plataforma esteve dias sem gravar (token expirado, API em baixo), 7 dias não
 * chegam para recuperar o buraco, e ele fica lá para sempre: o cron seguinte
 * volta a pedir só 7 dias e nunca alcança o que ficou para trás.
 *
 * Aconteceu a sério: o refresh token do Google expirou a 21/07/2026 e ficaram
 * ~4 semanas por recolher.
 */
export const DIAS_NORMAIS = 7;
export const DIAS_MAX = 90;

const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * @param ultimaGravada última `date` já em `ad_metrics` para a plataforma
 *                      (null se a tabela ainda não tem nada dela)
 * @param agoraMs       instante de referência (injetado para o teste ser estável)
 */
export function janelaSince(ultimaGravada: string | null | undefined, agoraMs: number): string {
  const normal = iso(agoraMs - DIAS_NORMAIS * DIA);
  const teto = iso(agoraMs - DIAS_MAX * DIA);
  if (!ultimaGravada) return normal;

  // Recomeça no dia a seguir ao último gravado...
  const seguinte = iso(new Date(`${ultimaGravada}T00:00:00Z`).getTime() + DIA);
  // ...mas nunca encurta a janela normal (as conversões dos últimos 7 dias
  // ainda se mexem, mesmo que o dia já esteja gravado)...
  if (seguinte >= normal) return normal;
  // ...nem pede mais do que o teto.
  return seguinte < teto ? teto : seguinte;
}
