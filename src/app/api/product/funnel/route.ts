import { apiOk, withStaff } from "../../_lib/handler";
import { mixpanelConfigured, fetchAppFunnel, type FunnelResult } from "../../_lib/mixpanel";

/**
 * GET /api/product/funnel — funil da jornada na app (Mixpanel). Onde os
 * utilizadores param. Sem credenciais Mixpanel, devolve `configured:false`
 * (a UI mostra o passo-a-passo de configuração, não um funil inventado).
 */
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  const to = q.get("to") || iso(new Date());
  const from = q.get("from") || iso(new Date(Date.now() - 30 * 864e5));

  if (!mixpanelConfigured()) {
    const empty: FunnelResult = { configured: false, funnelId: null, name: null, from, to, steps: [] };
    return apiOk(empty);
  }
  try {
    return apiOk(await fetchAppFunnel(from, to));
  } catch (e) {
    // Configurado mas com erro (creds, região UE, sem funil): mostra-se o erro
    // na aba em vez de partir a página.
    const failed: FunnelResult = {
      configured: true, funnelId: null, name: null, from, to, steps: [],
      error: e instanceof Error ? e.message : String(e),
    };
    return apiOk(failed);
  }
});
