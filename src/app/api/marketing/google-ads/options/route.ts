import { apiOk, withStaff } from "../../../_lib/handler";
import { googleAdsConfigured, listarCampanhasGoogle, listarGruposGoogle } from "../../../_lib/googleAdsWrite";

/** GET /api/marketing/google-ads/options — campanhas e grupos para o formulário. */
export const GET = withStaff(async () => {
  if (!googleAdsConfigured()) return apiOk({ configured: false, campaigns: [], adGroups: [], error: null });
  try {
    const [campaigns, adGroups] = await Promise.all([listarCampanhasGoogle(), listarGruposGoogle()]);
    return apiOk({ configured: true, campaigns, adGroups, error: null });
  } catch (e) {
    return apiOk({ configured: true, campaigns: [], adGroups: [], error: e instanceof Error ? e.message : "Erro." });
  }
});
