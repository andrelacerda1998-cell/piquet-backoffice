import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { googleAdsConfigured, fetchAccessibleCustomers } from "../../_lib/googleads";

/**
 * Diagnóstico do acesso ao Google Ads: que contas é que o refresh token vê, e
 * se a conta configurada está entre elas.
 *
 * Um 403 USER_PERMISSION_DENIED não distingue "autorizei com a conta Google
 * errada" de "falta o login-customer-id da MCC". Isto distingue.
 */

export const dynamic = "force-dynamic";

export const GET = withStaff(async () => {
  if (!googleAdsConfigured()) return apiErr("Google Ads não configurado (faltam env vars).", 503);
  try {
    return apiOk(await fetchAccessibleCustomers());
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Falha ao consultar o Google Ads.", 502);
  }
});
