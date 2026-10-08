import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { ultimosRegistos, type AcaoDaEquipa } from "../_lib/acoesDaEquipa";

const ACOES: AcaoDaEquipa[] = ["bloquear_cliente", "suspender_tecnico"];

/**
 * GET /api/acoes-da-equipa?acao=bloquear_cliente — o último registo de cada
 * cliente (ou técnico) para essa ação: quem foi, quando e com que motivo.
 * `ativo: false` quando a tabela ainda não existe.
 */
export const GET = withStaff(async (req) => {
  const acao = new URL(req.url).searchParams.get("acao") as AcaoDaEquipa | null;
  if (!acao || !ACOES.includes(acao)) return apiErr("Ação desconhecida.", 400);
  try {
    const registos = await ultimosRegistos(acao);
    return apiOk({ ativo: registos !== null, registos: registos ?? [] });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao ler o registo.", 500);
  }
});
