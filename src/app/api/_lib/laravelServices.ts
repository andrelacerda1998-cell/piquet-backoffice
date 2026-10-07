import "server-only";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import type { ServiceRequest, ServiceStatus, PaymentStatus, InvoiceStatus } from "@/types";

/**
 * Os pedidos feitos na app, vindos de `GET /v1/admin/services`.
 *
 * É a ponte entre a app e o backoffice: os clientes pedem na app, o pedido fica
 * no Laravel, e sem isto o backoffice só via as leads do formulário do site.
 *
 * O endpoint foi escrito a 08/09/2026 (App\Http\Controllers\Api\Admin\
 * ServiceController) e os nomes dos campos abaixo são os que ele devolve.
 * Falta entrar em produção do lado do Laravel; até lá, `LARAVEL_SERVICES_ENABLED`
 * fica por definir e o `/api/services` continua a ler do Supabase.
 */

/** Interruptor DEDICADO: não basta o Laravel estar configurado para os outros
 *  endpoints — só liga quando explicitamente ativado. */
export function servicesFromLaravel(): boolean {
  return LARAVEL_ADMIN_ENABLED && process.env.LARAVEL_SERVICES_ENABLED === "true";
}

/** Forma esperada de cada serviço vindo do Laravel (snake_case, ver a spec).
 *  Ajustar aos nomes reais quando o Rodrigo confirmar. */
export interface LaravelServiceRow {
  id: string | number;
  customer_id?: string | number | null;
  customer_name?: string | null;
  technician_id?: string | number | null;
  technician_name?: string | null;
  category_id?: string | number | null;
  category_name?: string | null;
  service_name?: string | null;
  location?: string | null;
  city?: string | null;
  source?: string | null;
  status?: string | null;
  requested_at?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  total_customer_value?: number | string | null;
  technician_value?: number | string | null;
  piquet_revenue?: number | string | null;
  vat_value?: number | string | null;
  payment_status?: string | null;
  invoice_status?: string | null;
  rating?: number | null;
  customer_phone?: string | null;
  customer_notes?: string | null;
  /** Marcação: vive na tabela `schedules`, e o dia e a hora vêm separados. */
  scheduled_day?: string | null;
  scheduled_time?: string | null;
  on_the_way_at?: string | null;
  /** Estado do matching: a quantos se perguntou e quantos responderam o quê. */
  /** A categoria (área de operação) do tipo de serviço. Desde o backend #151. */
  operation_area_id?: number | string | null;
  /**
   * Estado do matching. `invited` são todos os convidados; `notified` os que
   * ainda podem responder; `accepted` quem aceitou ALGUMA VEZ (desde o
   * backend #151, inclui quem foi escolhido e quem perdeu).
   */
  candidates?: { invited?: number; notified?: number; accepted?: number; declined?: number; expired?: number } | null;
  has_complaint?: boolean | null;
  cancellation_reason?: string | null;
  response_time_minutes?: number | null;
  technician_assignment_time_min?: number | null;
}

interface LaravelServicesResponse {
  items: LaravelServiceRow[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const str = (v: unknown): string => (v == null ? "" : String(v));

/** Os 15 estados que a aba Operações usa. Se o Laravel já usar estas chaves,
 *  passam diretas; caso contrário, mapeiam-se aqui. */
const DASHBOARD_STATUSES = new Set<ServiceStatus>([
  "pedido_recebido", "a_procurar_tecnico", "tecnico_encontrado", "a_aguardar_orcamento",
  "orcamento_enviado", "a_aguardar_pagamento", "pago", "agendado", "em_execucao",
  "concluido", "cancelado_cliente", "cancelado_tecnico", "sem_tecnico_disponivel",
  "reembolsado", "em_reclamacao",
  "a_aguardar_confirmacao", "pagamento_por_capturar", "arquivado",
]);

/*
  Os estados do Laravel (App\Enums\Services\ServiceStatus) traduzidos para os
  do backoffice. São PascalCase do lado de lá.

  Duas traduções que merecem explicação:
  - `MatchingFailed` é "sem técnico disponível" e não um cancelamento: ninguém
    recusou o serviço, é que não apareceu ninguém. É a diferença entre um
    problema da rede e uma decisão de alguém.
  - `Pending3DS` e `AwaitingPayment` são ambos "à espera de pagamento" para quem
    olha; a autenticação do cartão é detalhe do meio de pagamento, não um estado
    do serviço.
*/
/*
  OS 19 ESTADOS DO LARAVEL, todos. Ver app/Enums/Services/ServiceStatus.php.

  Faltavam oito, e caíam todos no `pedido_recebido` do fim de `mapStatus`: um
  técnico já em casa do cliente (`Arrived`) aparecia como pedido novo, um
  serviço marcado (`Scheduled`) não aparecia em Agendamentos, e as perdas no
  pagamento (MB WAY e 3DS) pareciam pedidos à espera de alguém.

  Dois dos que lá estavam estavam no sítio errado:

  - `Finished` contava como concluído. Quer dizer que o TÉCNICO diz que acabou;
    o cliente ainda não confirmou e o pagamento ainda não foi capturado. Contá-lo
    como concluído punha no GMV dinheiro que pode não entrar.
  - `ClosedPendingPayment` aparecia como "a aguardar pagamento", no meio dos
    pedidos novos. Quer dizer o contrário: o trabalho está FEITO e a captura
    falhou. É dinheiro de trabalho entregue por cobrar, e tem de se ver.
*/
const LARAVEL_STATUS_MAP: Record<string, ServiceStatus> = {
  Pending: "pedido_recebido",
  // Pedido personalizado à espera de o backoffice definir tempo e categorias.
  PendingReview: "a_aguardar_orcamento",
  Matching: "a_procurar_tecnico",
  MatchingFailed: "sem_tecnico_disponivel",
  Accepted: "tecnico_encontrado",
  AwaitingPayment: "a_aguardar_pagamento",
  Pending3DS: "a_aguardar_pagamento",
  Scheduled: "agendado",
  Arrived: "em_execucao",
  Finished: "a_aguardar_confirmacao",
  ClosedPendingPayment: "pagamento_por_capturar",
  Closed: "concluido",
  // O Laravel não regista quem cancelou: "cliente" é a leitura mais comum, não
  // um facto. Quem cancelou e porquê é a tabela `service_events` da auditoria.
  Canceled: "cancelado_cliente",
  Refused: "cancelado_tecnico",
  /*
    As quatro maneiras de o pagamento do cliente não chegar a acontecer: recusou
    o MB WAY, não o confirmou a tempo, cancelou no ecrã de espera, ou não fez o
    3DS. Terminais e sem dinheiro cobrado. Ficam como canceladas pelo cliente
    porque não há estado melhor no backoffice; são o funil do checkout, e um
    dia merecem um estado próprio.
  */
  RefusedMbway: "cancelado_cliente",
  ExpiredMbway: "cancelado_cliente",
  CanceledMbway: "cancelado_cliente",
  Expired3DS: "cancelado_cliente",
  /*
    NÃO é concluído. O único sítio que arquiva é a ação do Filament, e só a
    permite a partir de Pending, Pending3DS e Scheduled -- pedidos que nunca
    foram executados. Arquivar é tirar da frente um pedido que morreu.
  */
  Archived: "arquivado",
};

/** O estado do Laravel no vocabulário do backoffice. */
export function estadoDoBackoffice(raw: string | null | undefined): ServiceStatus {
  return mapStatus(raw);
}

function mapStatus(raw: string | null | undefined): ServiceStatus {
  const s = str(raw).trim();
  if (DASHBOARD_STATUSES.has(s as ServiceStatus)) return s as ServiceStatus;
  if (LARAVEL_STATUS_MAP[s]) return LARAVEL_STATUS_MAP[s];
  return "pedido_recebido"; // fallback seguro até o mapa estar completo
}

/** Estados de pagamento do Laravel → os do backoffice. */
const LARAVEL_PAYMENT_MAP: Record<string, PaymentStatus> = {
  Pending: "pendente",
  Paid: "pago",
  Canceled: "falhado",
  Refunded: "reembolsado",
};

const PAYMENT_STATUSES = new Set(["pendente", "pago", "parcial", "reembolsado", "falhado"]);
const INVOICE_STATUSES = new Set(["nao_emitida", "emitida", "com_erro", "anulada"]);

/**
 * O matching de um serviço, como o backoffice o mostra.
 *
 * Um backend anterior ao #151 não manda `invited`: soma-se o que vem, que é o
 * melhor que se consegue dizer sem ele.
 */
function matchingDe(c: LaravelServiceRow["candidates"]): ServiceRequest["matching"] {
  if (!c) return undefined;
  const notified = num(c.notified);
  const accepted = num(c.accepted);
  const declined = num(c.declined);
  const expired = num(c.expired);
  return {
    invited: c.invited != null ? num(c.invited) : notified + accepted + declined + expired,
    notified, accepted, declined, expired,
  };
}

/**
 * Os estados do Laravel que correspondem a estes estados do backoffice.
 *
 * O inverso do LARAVEL_STATUS_MAP, para os separadores de Operações chegarem
 * ao Laravel. Um estado do backoffice que o Laravel nunca produz (por exemplo
 * `orcamento_enviado`) não tem correspondência e não contribui com nada.
 */
export function estadosDoLaravel(estados: readonly ServiceStatus[]): string[] {
  const pedidos = new Set<string>(estados);
  return Object.entries(LARAVEL_STATUS_MAP)
    .filter(([, nosso]) => pedidos.has(nosso))
    .map(([deles]) => deles);
}

/**
 * Valor que não corresponde a estado nenhum. Um separador cujos estados o
 * Laravel não produz tem de devolver NADA — sem filtro devolvia tudo.
 */
export const NENHUM_ESTADO = "__nenhum__";

/** Linha do Laravel → forma `ServiceRequest` que os ecrãs consomem. */
export function mapLaravelService(r: LaravelServiceRow): ServiceRequest {
  const total = num(r.total_customer_value);
  const techValue = num(r.technician_value);
  const payment = LARAVEL_PAYMENT_MAP[str(r.payment_status)] ?? str(r.payment_status);
  const invoice = str(r.invoice_status);
  return {
    id: str(r.id),
    customerId: str(r.customer_id),
    customerName: r.customer_name ?? "",
    technicianId: r.technician_id != null ? str(r.technician_id) : undefined,
    technicianName: r.technician_name ?? undefined,
    categoryId: str(r.category_id),
    categoryName: r.category_name ?? "",
    serviceName: r.service_name ?? "",
    location: r.location ?? "",
    city: r.city ?? "",
    source: r.source ?? "app",
    status: mapStatus(r.status),
    requestedAt: r.requested_at ?? "",
    // O dia sozinho já serve a lista; a hora junta-se quando existe.
    scheduledAt: r.scheduled_at
      ?? (r.scheduled_day ? [r.scheduled_day, r.scheduled_time].filter(Boolean).join(" ") : undefined),
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    totalCustomerValue: total,
    technicianValue: techValue,
    // Se o Laravel não mandar a comissão, deriva-se (total − técnico).
    piquetRevenue: r.piquet_revenue != null ? num(r.piquet_revenue) : Math.max(0, total - techValue),
    vatValue: r.vat_value != null ? num(r.vat_value) : undefined,
    paymentStatus: (PAYMENT_STATUSES.has(payment) ? payment : "pendente") as PaymentStatus,
    // Sem fatura enviada é "não se sabe", e não "não emitida".
    invoiceStatus: INVOICE_STATUSES.has(invoice) ? (invoice as InvoiceStatus) : undefined,
    rating: r.rating ?? undefined,
    hasComplaint: !!r.has_complaint,
    matching: matchingDe(r.candidates),
    operationAreaId: r.operation_area_id != null ? str(r.operation_area_id) : undefined,
    cancellationReason: r.cancellation_reason ?? undefined,
    responseTimeMinutes: r.response_time_minutes ?? undefined,
    technicianAssignmentTimeMinutes: r.technician_assignment_time_min ?? undefined,
  };
}

export interface ServicesQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  /** Estados do BACKOFFICE (os grupos dos separadores); traduzem-se aqui. */
  statuses?: ServiceStatus[];
  /** O tipo de serviço (é o que o Laravel devolve como `category_id`). */
  categoryId?: string;
  /** A categoria que a equipa escolhe no filtro: a área de operação. */
  operationAreaId?: string;
  city?: string;
  search?: string;
  from?: string;
  to?: string;
}

/** Busca a lista paginada ao Laravel e devolve no MESMO envelope que a rota
 *  Supabase (`{ data, total, page, pageSize, totalPages }`). */
/**
 * TODOS os serviços do Laravel, percorrendo as páginas.
 *
 * O `fetchLaravelServices` devolve uma página, que é o que uma lista precisa.
 * Quem agrega -- o Financeiro, as unit economics, o resultado operacional --
 * precisa do conjunto inteiro: somar a primeira página e chamar-lhe receita
 * seria pior do que não somar nada.
 *
 * O controlador do Laravel limita `per_page` a 100 (`min($perPage, 100)`), por
 * isso pedir 1000 devolve 100 e cala-se. Foi assim que a cópia dos técnicos
 * andou meses a ver 100 de 438.
 */
export async function fetchAllLaravelServices(): Promise<ServiceRequest[]> {
  const todos: ServiceRequest[] = [];
  let pagina = 1;
  let ultima = 1;

  do {
    const res = await laravelAdminRequest<LaravelServicesResponse>(
      `/v1/admin/services?per_page=100&page=${pagina}`,
    );
    const itens = res.items ?? [];
    todos.push(...itens.map(mapLaravelService));
    ultima = res.meta?.last_page ?? (itens.length === 100 ? pagina + 1 : pagina);
    pagina++;
  } while (pagina <= ultima && pagina <= 100); // trava: 10 000 serviços

  return todos;
}

export async function fetchLaravelServices(query: ServicesQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("per_page", String(query.pageSize ?? 20));
  /*
    Os separadores de Operações mandam GRUPOS de estados do backoffice. Iam
    para lado nenhum: esta função só passava `status`, e em produção cada
    separador mostrava a lista inteira.
  */
  if (query.statuses?.length) {
    const deles = estadosDoLaravel(query.statuses);
    params.set("statuses", deles.length ? deles.join(",") : NENHUM_ESTADO);
  } else if (query.status) {
    const deles = estadosDoLaravel([query.status as ServiceStatus]);
    params.set("statuses", deles.length ? deles.join(",") : NENHUM_ESTADO);
  }
  if (query.categoryId) params.set("category_id", query.categoryId);
  // Só ids do Laravel: um filtro antigo com as categorias fixas da
  // configuração ("cat_canalizacao") não pode virar "nenhum resultado".
  if (query.operationAreaId && /^\d+$/.test(query.operationAreaId)) {
    params.set("operation_area_id", query.operationAreaId);
  }
  if (query.city) params.set("city", query.city);
  if (query.search) params.set("search", query.search);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);

  const res = await laravelAdminRequest<LaravelServicesResponse>(`/v1/admin/services?${params.toString()}`);
  const meta = res.meta ?? { current_page: 1, last_page: 1, per_page: query.pageSize ?? 20, total: (res.items ?? []).length };
  return {
    data: (res.items ?? []).map(mapLaravelService),
    total: meta.total,
    page: meta.current_page,
    pageSize: meta.per_page,
    totalPages: meta.last_page,
  };
}
