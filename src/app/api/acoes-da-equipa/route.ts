import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { historicoDe, ultimasAcoes, ultimosRegistos, type AcaoDaEquipa } from "../_lib/acoesDaEquipa";

const ACOES: AcaoDaEquipa[] = ["bloquear_cliente", "suspender_tecnico", "reembolsar_pagamento"];
const ENTIDADES = new Set(["pedido", "cliente", "tecnico", "pagamento", "lote", "contacto", "ticket", "documento"]);

/**
 * GET /api/acoes-da-equipa — o que a equipa fez no backoffice.
 *
 *  - `?acao=bloquear_cliente` — o último registo de cada cliente (ou técnico)
 *    para essa ação: quem, quando e com que motivo.
 *  - `?entidade=pedido&id=282` — o histórico de um registo.
 *  - sem parâmetros — as últimas 200 ações de toda a equipa.
 *
 * `ativo: false` quando a tabela ainda não existe.
 */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams;
  try {
    const acao = q.get("acao") as AcaoDaEquipa | null;
    if (acao) {
      if (!ACOES.includes(acao)) return apiErr("Ação desconhecida.", 400);
      const registos = await ultimosRegistos(acao);
      return apiOk({ ativo: registos !== null, registos: registos ?? [] });
    }
    const entidade = q.get("entidade");
    const id = q.get("id");
    if (entidade || id) {
      if (!entidade || !ENTIDADES.has(entidade) || !id || !/^[\w-]{1,64}$/.test(id)) return apiErr("Registo desconhecido.", 400);
      const registos = await historicoDe(entidade, id);
      return apiOk({ ativo: registos !== null, registos: registos ?? [] });
    }
    const registos = await ultimasAcoes();
    return apiOk({ ativo: registos !== null, registos: registos ?? [] });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Erro ao ler o histórico.", 500);
  }
});
