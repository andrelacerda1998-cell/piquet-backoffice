import "server-only";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import type { ServiceRequest, ServiceStatus, PaymentStatus, InvoiceStatus } from "@/types";

/**
 * CASCA da ligação dos Serviços/Reservas à API de admin do Laravel
 * (`GET /v1/admin/services`), ainda **dormente**.
 *
 * Está tudo pronto para ligar — só falta o Rodrigo expor o endpoint (ver
 * INTEGRACAO_LARAVEL_BACKOFFICE.md, Prioridade 1) e confirmar 2 coisas:
 *   1. os nomes exatos dos campos que devolve (ajustar `LaravelServiceRow`);
 *   2. os valores de `status` do lado dele (preencher `LARAVEL_STATUS_MAP`).
 *
 * Enquanto `LARAVEL_SERVICES_ENABLED` não estiver a "true" na Vercel, o
 * `/api/services` continua a ler do Supabase como hoje — nada muda.
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
]);

/** TODO(Rodrigo): preencher com os valores de `status` do Laravel → estado do
 *  dashboard. Ex.: { pending: "pedido_recebido", finished: "concluido", ... }. */
const LARAVEL_STATUS_MAP: Record<string, ServiceStatus> = {};

function mapStatus(raw: string | null | undefined): ServiceStatus {
  const s = str(raw).trim();
  if (DASHBOARD_STATUSES.has(s as ServiceStatus)) return s as ServiceStatus;
  if (LARAVEL_STATUS_MAP[s]) return LARAVEL_STATUS_MAP[s];
  return "pedido_recebido"; // fallback seguro até o mapa estar completo
}

const PAYMENT_STATUSES = new Set(["pendente", "pago", "parcial", "reembolsado", "falhado"]);
const INVOICE_STATUSES = new Set(["nao_emitida", "emitida", "com_erro", "anulada"]);

/** Linha do Laravel → forma `ServiceRequest` que os ecrãs consomem. */
export function mapLaravelService(r: LaravelServiceRow): ServiceRequest {
  const total = num(r.total_customer_value);
  const techValue = num(r.technician_value);
  const payment = str(r.payment_status);
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
    scheduledAt: r.scheduled_at ?? undefined,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    totalCustomerValue: total,
    technicianValue: techValue,
    // Se o Laravel não mandar a comissão, deriva-se (total − técnico).
    piquetRevenue: r.piquet_revenue != null ? num(r.piquet_revenue) : Math.max(0, total - techValue),
    vatValue: num(r.vat_value),
    paymentStatus: (PAYMENT_STATUSES.has(payment) ? payment : "pendente") as PaymentStatus,
    invoiceStatus: (INVOICE_STATUSES.has(invoice) ? invoice : "nao_emitida") as InvoiceStatus,
    rating: r.rating ?? undefined,
    hasComplaint: !!r.has_complaint,
    cancellationReason: r.cancellation_reason ?? undefined,
    responseTimeMinutes: r.response_time_minutes ?? undefined,
    technicianAssignmentTimeMinutes: r.technician_assignment_time_min ?? undefined,
  };
}

export interface ServicesQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  city?: string;
  search?: string;
  from?: string;
  to?: string;
}

/** Busca a lista paginada ao Laravel e devolve no MESMO envelope que a rota
 *  Supabase (`{ data, total, page, pageSize, totalPages }`). */
export async function fetchLaravelServices(query: ServicesQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("per_page", String(query.pageSize ?? 20));
  if (query.status) params.set("status", query.status);
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
