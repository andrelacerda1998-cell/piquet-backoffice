import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { estadoDoBackoffice, mapLaravelService, type LaravelServiceRow } from "../../../_lib/laravelServices";
import type { EventoDoPedido } from "@/lib/historicoPedido";
import type { ServiceRequest } from "@/types";

/**
 * GET /api/services/:id/detalhe — um serviço do Laravel, com os técnicos que
 * foram convidados e o que cada um respondeu.
 *
 * Duas utilidades:
 *
 *  - O MATCHING de um pedido. O Laravel regista cada convite (onda, distância,
 *    preço cotado, se aceitou, recusou ou deixou expirar), e o backoffice não o
 *    mostrava em lado nenhum. É a primeira coisa a ver quando um cliente diz
 *    "ninguém pegou no meu pedido".
 *  - ABRIR um serviço pelo número, vindo da pesquisa global (⌘K). A lista de
 *    Operações é paginada; o serviço 282 pode não estar na página aberta.
 */

/** Um técnico convidado, como o Laravel o apresenta (Admin\ServiceController::show). */
export interface CandidatoLaravel {
  vendor_id: number;
  vendor_name: string | null;
  status: string;
  rank: number | null;
  wave: number | null;
  rating_average: number | null;
  quoted_amount: number | null;
  quoted_distance: number | null;
  notified_at: string | null;
  responded_at: string | null;
}

export interface DetalheDoServico {
  servico: ServiceRequest;
  candidatos: CandidatoLaravel[];
  /** O histórico (service_events, backend #160). Vazio antes de 08/10/2026. */
  eventos: EventoDoPedido[];
}

type RespostaLaravel = LaravelServiceRow & {
  candidates?: CandidatoLaravel[] | LaravelServiceRow["candidates"];
  candidate_counts?: LaravelServiceRow["candidates"];
  events?: EventoDoPedido[];
};

/** As colunas `decimal` do Laravel chegam como texto ("3.00"). */
const numOuNada = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function numeros(c: CandidatoLaravel): CandidatoLaravel {
  return {
    ...c,
    rating_average: numOuNada(c.rating_average),
    quoted_amount: numOuNada(c.quoted_amount),
    quoted_distance: numOuNada(c.quoted_distance),
  };
}

export const GET = withStaff(async (_req, { params }) => {
  if (!LARAVEL_ADMIN_ENABLED) {
    return apiErr("API de admin do Laravel não configurada.", 503);
  }
  // Os ids do Laravel são números; tudo o resto é engano de quem chamou.
  if (!/^\d+$/.test(params.id)) {
    return apiErr("Serviço não encontrado.", 404);
  }

  try {
    const d = await laravelAdminRequest<RespostaLaravel>(`/v1/admin/services/${params.id}`);
    /*
      No detalhe, `candidates` é a LISTA e as contagens vêm em
      `candidate_counts` (backend #151). Um backend anterior manda as
      contagens a zero com o nome de sempre: passa-se o que houver.
    */
    const lista = (Array.isArray(d.candidates) ? d.candidates : []).map(numeros);
    const servico = mapLaravelService({ ...d, candidates: d.candidate_counts ?? null });

    const eventos = (d.events ?? []).map((e) => ({
      ...e,
      deBackoffice: e.de ? estadoDoBackoffice(e.de) : null,
      paraBackoffice: e.para ? estadoDoBackoffice(e.para) : null,
    }));

    return apiOk<DetalheDoServico>({ servico, candidatos: lista, eventos });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return apiErr("Serviço não encontrado.", 404);
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler o serviço.", e instanceof ApiError ? e.status : 500);
  }
});
