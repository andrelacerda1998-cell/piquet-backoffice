import { apiGet } from "./api";
import { mockData } from "@/mocks/data";
import { applyFiltersToServices, paginateArray, sortArray } from "@/lib/filters";
import type {
  DashboardFilter, PaginatedResult, SortParams, ServiceRequest,
} from "@/types";

function getFilteredServices(filters: DashboardFilter) {
  return applyFiltersToServices(mockData.services, filters);
}

export async function getServices(
  filters: DashboardFilter,
  page = 1,
  pageSize = 20,
  sort?: SortParams,
  search?: string,
  statuses?: import("@/types").ServiceStatus[]
): Promise<PaginatedResult<ServiceRequest>> {
  // Os `params` são enviados ao backend real (paginação/filtros server-side).
  // Em modo demo são ignorados — o fetcher pagina/filtra localmente.
  return apiGet<PaginatedResult<ServiceRequest>>(
    "/services",
    () => {
      let items = getFilteredServices({ ...filters, search: search ?? filters.search });
      if (statuses?.length) items = items.filter((s) => statuses.includes(s.status));
      if (sort) items = sortArray(items, sort.field as keyof ServiceRequest, sort.direction);
      return paginateArray(items, page, pageSize);
    },
    {
      page,
      pageSize,
      search: search ?? filters.search,
      period: filters.period,
      categoryId: filters.categoryId,
      city: filters.city,
      status: filters.serviceStatus,
      statuses: statuses?.join(","),
      sort: sort?.field,
      dir: sort?.direction,
    }
  ).then((r) => r.data);
}

export type DepartmentStatus = "saudavel" | "atraso" | "risco";

export interface DepartmentHealth {
  id: string;
  name: string;
  icon: string;
  lead: string;
  status: DepartmentStatus;
  metricA: { label: string; value: string };
  metricB: { label: string; value: string };
  people: number;
  monthlyCost: number;
  openTasks: number;
}

/* ==================== CONTAGEM DE SERVIÇOS (Visão Geral) ==================== */

export interface ServiceCounts {
  mes: { executados: number; agendados: number };
  ano: { executados: number; agendados: number };
}

/**
 * Serviços executados e agendados, no mês e no ano corrente.
 *
 * Sem fallback fictício: zeros aqui são zeros verdadeiros (não há serviços
 * nesse período), e inventar contagens num cartão de contagem seria mentir
 * sobre a operação.
 */
export async function getServiceCounts(): Promise<ServiceCounts> {
  return apiGet<ServiceCounts>("/services/counts", () => ({
    mes: { executados: 0, agendados: 0 },
    ano: { executados: 0, agendados: 0 },
  })).then((r) => r.data);
}

/* --------------------- Operação: funil, estados e tempos --------------------- */

/**
 * Funil, distribuição de estados e tempos, dos serviços REAIS (ver
 * /api/services/operacao).
 *
 * Substitui getMainFunnel, getStatusDistribution e getOperationalMetrics: a
 * conta do funil e dos estados já estava certa, mas corria sobre
 * `mockData.services`; os tempos eram constantes escritas no código.
 *
 * Numa só leitura porque as três saem da MESMA lista, e a lista custa uma
 * travessia paginada ao Laravel.
 */
export type { Operacao } from "@/lib/operacao";
import type { Operacao as OperacaoDTO } from "@/lib/operacao";

export async function getOperacao(): Promise<OperacaoDTO> {
  return apiGet<OperacaoDTO>("/services/operacao", () => {
    throw new Error("O desempenho da operação precisa da ligação aos serviços do Laravel.");
  }).then((r) => r.data);
}

/* ----------------------------- Operações ao vivo ----------------------------- */

export type { AoVivo } from "@/lib/aoVivo";
import type { AoVivo as AoVivoDTO } from "@/lib/aoVivo";

/**
 * O estado do marketplace agora (ver /api/operacoes/ao-vivo). Sem mock: um
 * ecrã de operações com pedidos inventados é pior do que um erro a dizer que
 * falta a ligação ao Laravel.
 */
export async function getOperacoesAoVivo(incluirTestes = false): Promise<AoVivoDTO> {
  return apiGet<AoVivoDTO>(`/operacoes/ao-vivo${incluirTestes ? "?incluir_testes=1" : ""}`, () => {
    throw new Error("As Operações ao vivo precisam da ligação ao Laravel.");
  }).then((r) => r.data);
}

/* ------------------- Fotografias que o cliente anexou ------------------- */

/**
 * As fotos do pedido (ver /api/services/:id/fotos).
 *
 * Sem mock: o painel desenhava seis quadrados vazios, sempre seis, e isso
 * fazia parecer que havia fotos onde não há. Uma lista vazia é a resposta
 * certa quando o cliente não anexou nada.
 */
export type { FotoDoCliente } from "@/app/api/services/[id]/fotos/route";
import type { FotoDoCliente as FotoDTO } from "@/app/api/services/[id]/fotos/route";
import type { DetalheDoServico } from "@/app/api/services/[id]/detalhe/route";

/**
 * Um serviço do Laravel com os técnicos convidados e o que responderam (ver
 * /api/services/:id/detalhe). Sem backend, o serviço de exemplo com o mesmo id
 * e nenhum convite: os dados de exemplo não têm matching.
 */
export async function getDetalheDoServico(id: string): Promise<DetalheDoServico | null> {
  return apiGet<DetalheDoServico | null>(`/services/${id}/detalhe`, () => {
    const servico = mockData.services.find((s) => s.id === id);
    return servico ? { servico, candidatos: [] } : null;
  }).then((r) => r.data);
}

export async function getFotosDoCliente(servicoId: string): Promise<FotoDTO[]> {
  return apiGet<FotoDTO[]>(`/services/${servicoId}/fotos`, () => []).then((r) => r.data);
}
