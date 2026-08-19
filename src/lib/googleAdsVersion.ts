/**
 * Versões da Google Ads API que o código sabe usar, da mais recente para a
 * mais antiga.
 *
 * A Google reforma cada versão ao fim de ~1 ano e a partir daí devolve 404 em
 * HTML. Já aconteceu duas vezes: a v18 e, em agosto de 2026, a v21 — que ficou
 * a falhar em silêncio até alguém reparar.
 *
 * Por isso não fixamos uma versão: tenta-se a primeira e, se a Google
 * responder 404 (só nesse caso — 401/403 são problemas de credenciais, não de
 * versão), passa-se à seguinte. Assim a recolha sobrevive à próxima reforma
 * sem precisar de um deploy à pressa.
 */
export const GOOGLE_ADS_VERSIONS = ["v26", "v25", "v24", "v23", "v22"] as const;

/**
 * Ordem de tentativa. `preferida` (env GOOGLE_ADS_API_VERSION) vai à frente,
 * para dar forma de fixar uma versão sem editar código — útil se uma versão
 * nova mudar um campo e for preciso voltar atrás depressa.
 */
export function versionsToTry(preferida?: string | null): string[] {
  const base = [...GOOGLE_ADS_VERSIONS] as string[];
  const p = (preferida ?? "").trim();
  if (!p) return base;
  return [p, ...base.filter((v) => v !== p)];
}

/** Só um 404 significa "versão reformada" — vale a pena tentar a seguinte. */
export function shouldTryNextVersion(status: number): boolean {
  return status === 404;
}
