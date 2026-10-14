import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { estadoDoBackoffice, mapLaravelService, type LaravelServiceRow } from "../../../_lib/laravelServices";
import type { EventoDoPedido } from "@/lib/historicoPedido";
import type { ServiceRequest, UserRole } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { chargedCents, refundedCents } from "../../../_lib/paylands";

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
  /**
   * Telefones do cliente e do técnico, para ligar sem sair do pedido. `null`
   * para quem não pode ver dados pessoais. O do técnico só existe com o
   * backend que o envia no detalhe.
   */
  contactos: { cliente: string | null; tecnico: string | null } | null;
  /** O pagamento (Payshop) do pedido, que é o que o reembolso precisa. */
  pagamentoUuid: string | null;
  /**
   * Quanto se cobrou e já se devolveu nesse pagamento, em cêntimos, pelas
   * transações do Payshop (as mesmas do Financeiro). `null` sem transações.
   */
  pagamento: { cobradoCents: number; reembolsadoCents: number } | null;
  /** O estado no Laravel ("Finished", "ClosedPendingPayment"…): decide que ações há. */
  estadoLaravel: string | null;
  /** Só num pedido personalizado: o que o cliente escreveu e o que a Piquet definiu. */
  personalizado: { descricao: string | null; minutos: number | null; categorias: string[]; despachadoEm: string | null } | null;
  /** O tipo de serviço do pedido já saiu do catálogo (o nome continua a ser o dele). */
  tipoForaDoCatalogo: boolean;
}

type RespostaLaravel = LaravelServiceRow & {
  candidates?: CandidatoLaravel[] | LaravelServiceRow["candidates"];
  candidate_counts?: LaravelServiceRow["candidates"];
  events?: EventoDoPedido[];
  technician_phone?: string | null;
  payment_order_uuid?: string | null;
  is_custom?: boolean;
  custom_description?: string | null;
  custom_duration_minutes?: number | null;
  custom_dispatched_at?: string | null;
  custom_categories?: unknown[] | null;
  service_type_removed?: boolean;
};

/** O nome de uma categoria, venha como texto ou como traduções ({"pt-pt": …}). */
function nomeDaCategoria(c: unknown): string {
  if (typeof c === "string") return c;
  if (c && typeof c === "object") {
    const t = c as Record<string, string>;
    return t["pt-pt"] ?? t.pt ?? Object.values(t)[0] ?? "";
  }
  return "";
}

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

/**
 * O cobrado e o já devolvido de um pagamento, para o reembolso propor o que
 * resta (e não o valor do pedido, que pode não ser o que se cobrou). Sem
 * transações, ou se a leitura falhar, fica sem: o diálogo usa o valor do pedido.
 */
async function valoresDoPagamento(uuid: string): Promise<{ cobradoCents: number; reembolsadoCents: number } | null> {
  try {
    const { data, error } = await supabaseAdmin().from("pop_transactions")
      .select("type, status, amount_cents").ilike("order_uuid", uuid).limit(50);
    if (error || !data?.length) return null;
    const txs = data as Array<{ type: string; status: string; amount_cents: number }>;
    return { cobradoCents: chargedCents(txs), reembolsadoCents: refundedCents(txs) };
  } catch {
    return null;
  }
}

export const GET = withStaff(async (_req, { params, staff }) => {
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

    const podeVerContactos = hasPermission(staff.role as UserRole, "view_personal_data");
    const contactos = podeVerContactos
      ? { cliente: d.customer_phone || null, tecnico: d.technician_phone || null }
      : null;

    return apiOk<DetalheDoServico>({
      servico, candidatos: lista, eventos, contactos, pagamentoUuid: d.payment_order_uuid || null,
      pagamento: d.payment_order_uuid ? await valoresDoPagamento(d.payment_order_uuid) : null,
      estadoLaravel: d.status ?? null,
      personalizado: d.is_custom
        ? {
          descricao: d.custom_description ?? null,
          minutos: d.custom_duration_minutes ?? null,
          categorias: (d.custom_categories ?? []).map(nomeDaCategoria).filter(Boolean),
          despachadoEm: d.custom_dispatched_at ?? null,
        }
        : null,
      tipoForaDoCatalogo: d.service_type_removed === true,
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return apiErr("Serviço não encontrado.", 404);
    return apiErr(e instanceof ApiError ? e.message : "Erro ao ler o serviço.", e instanceof ApiError ? e.status : 500);
  }
});
