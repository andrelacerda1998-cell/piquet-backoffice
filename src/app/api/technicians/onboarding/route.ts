import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { construirFunil, type Funil } from "@/lib/onboardingTecnicos";

/**
 * GET /api/technicians/onboarding — o funil de quem se inscreveu e ficou a meio.
 *
 * Agrega no SERVIDOR: são centenas de técnicos, e o ecrã precisa de contagens
 * e dos mais antigos por resolver, não da lista toda no browser.
 *
 * Lê todas as páginas: o Laravel limita a 100 por página, e foi exatamente
 * assim que a sincronização de contactos leu 100 de 438 e ninguém deu por
 * isso durante semanas.
 */

interface VendorCru {
  id: number;
  name?: string | null;
  phone_number?: string | null;
  account_blocker?: string | null;
  created_at?: string | null;
  operation_areas?: string[] | null;
  suspended_at?: string | null;
}

export type { Funil };

export const GET = withStaff(async () => {
  if (!LARAVEL_ADMIN_ENABLED) {
    return apiErr("A API de admin do Laravel não está configurada — os técnicos vivem lá.", 503);
  }

  try {
    const todos: VendorCru[] = [];
    for (let pagina = 1; pagina <= 60; pagina++) {
      const r = await laravelAdminRequest<{ items: VendorCru[]; meta: { last_page: number } }>(
        `/v1/admin/vendors?per_page=100&page=${pagina}`,
      );
      todos.push(...(r.items ?? []));
      if (pagina >= (r.meta?.last_page ?? 1)) break;
    }

    /*
      Se o backend ainda não expuser `account_blocker` (PR #98), TODOS vêm sem
      etapa e o funil diria "443 prontos" — uma boa notícia falsa. Mais vale
      dizer que não se sabe.
    */
    const semCampo = todos.length > 0 && todos.every((v) => v.account_blocker === undefined);
    if (semCampo) {
      return apiErr(
        "O backend ainda não diz o que falta a cada técnico (account_blocker). Falta publicar o PR #98.",
        503,
      );
    }

    return apiOk(construirFunil(todos));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler o funil de técnicos.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
