import { apiGet, apiPut, apiDelete } from "./api";
import type { PaginatedResult } from "@/types";

/**
 * Clientes reais — migrado do Filament (App\Filament\Resources\CustomerResource)
 * para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts e
 * src/app/api/customers/*.
 *
 * Forma mínima (id, nome, nif, contactos, verificações, elegibilidade,
 * bloqueado_em, criado_em) -- não os campos fictícios do antigo `Customer`
 * (cidade, origem, valor gasto, receita Piquet, avaliação, ...), que
 * continuam a existir só para o resto do dashboard (métricas/gráficos,
 * ainda por migrar). Ver `Customer` em src/types para essa forma antiga.
 */
export interface RealCustomer {
  id: number;
  name: string | null;
  nif: string | null;
  email: string | null;
  phone_number: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  can_request_service: boolean;
  blocked_at: string | null;
  created_at: string | null;
}

interface CustomersApiData {
  items: RealCustomer[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getCustomers(
  page = 1,
  pageSize = 20,
  search?: string,
  blockedOnly = false
): Promise<PaginatedResult<RealCustomer>> {
  const raw = await apiGet<CustomersApiData>(
    "/customers",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: pageSize, total: 0 } }),
    { page, per_page: pageSize, search, blocked: blockedOnly ? 1 : undefined }
  ).then((r) => r.data);

  return {
    data: raw.items,
    total: raw.meta.total,
    page: raw.meta.current_page,
    pageSize: raw.meta.per_page,
    totalPages: raw.meta.last_page,
  };
}

/**
 * Bloquear = soft-delete real do User no Laravel (sem conceito nativo de
 * "bloqueado"). Reativar = restore do soft-delete. Ambas ações reais, tal
 * como os pagamentos/documentos KYC -- não são formulários locais.
 */
export async function blockCustomer(id: number): Promise<RealCustomer> {
  return apiPut<RealCustomer>(`/customers/${id}/block`, {}, () => {
    throw new Error("Bloquear clientes precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function restoreCustomer(id: number): Promise<RealCustomer> {
  return apiPut<RealCustomer>(`/customers/${id}/restore`, {}, () => {
    throw new Error("Reativar clientes precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

/**
 * Métodos de pagamento guardados — migrado do Filament
 * (PaymentMethodsRelationManager dentro do CustomerResource). Só listar +
 * apagar: cartões/MBWay são geridos pelo Payshop via app, nunca por
 * formulário manual no backoffice.
 */
export interface CustomerPaymentMethod {
  id: number;
  type: string;
  brand: string | null;
  brand_description: string | null;
  last4: string | null;
  phone_number: string | null;
  holder: string | null;
  expire_month: string | null;
  expire_year: string | null;
  created_at: string | null;
}

export async function getCustomerPaymentMethods(customerId: number): Promise<CustomerPaymentMethod[]> {
  return apiGet<{ items: CustomerPaymentMethod[] }>(
    `/customers/${customerId}/payment-methods`,
    () => ({ items: [] })
  ).then((r) => r.data.items);
}

export async function deleteCustomerPaymentMethod(customerId: number, methodId: number): Promise<void> {
  await apiDelete(`/customers/${customerId}/payment-methods/${methodId}`, () => {
    throw new Error("Remover métodos de pagamento precisa da API de admin do Laravel configurada.");
  });
}

/**
 * Indicadores da aba "Visão geral" -- calculados no Laravel a partir de
 * serviços reais concluídos (ver App\Http\Controllers\Api\Admin\
 * CustomerController::metrics()). withComplaints fica sempre 0: não existe
 * sistema de reclamações no Laravel nem no Filament.
 */
export interface CustomerMetrics {
  registered: number;
  newCustomers: number;
  active: number;
  recurring: number;
  oneTime: number;
  inactive: number;
  repurchaseRate: number;
  avgServicesPerCustomer: number;
  avgRevenuePerCustomer: number;
  estimatedLTV: number;
  avgTimeToSecondService: number;
  averageRating: number;
  withComplaints: number;
}

const ZERO_METRICS: CustomerMetrics = {
  registered: 0, newCustomers: 0, active: 0, recurring: 0, oneTime: 0, inactive: 0,
  repurchaseRate: 0, avgServicesPerCustomer: 0, avgRevenuePerCustomer: 0, estimatedLTV: 0,
  avgTimeToSecondService: 0, averageRating: 0, withComplaints: 0,
};

export async function getCustomerMetrics(): Promise<CustomerMetrics> {
  return apiGet<CustomerMetrics>("/customers/metrics", () => ZERO_METRICS).then((r) => r.data);
}

export async function getCustomersByLocation() {
  return apiGet<Array<{ name: string; value: number }>>("/customers/by-location", () => []).then((r) => r.data);
}

/**
 * Sem tracking de canal/origem de aquisição no Laravel -- devolve sempre
 * vazio (o gráfico mostra "Sem dados" em vez de uma distribuição inventada).
 */
export async function getCustomersBySource() {
  return apiGet<Array<{ name: string; value: number }>>("/customers/by-source", () => []).then((r) => r.data);
}

/**
 * Retenção por coorte: sem análise de coortes no Laravel -- devolve sempre
 * vazio (antes eram barras fictícias fixas 42/35/28%).
 */
export async function getRetentionData() {
  return apiGet<Array<{ name: string; value: number }>>("/customers/retention", () => []).then((r) => r.data);
}

/**
 * Novos vs recorrentes por mês (últimos 6 meses), calculado a partir de
 * registos e serviços concluídos reais -- antes era Math.random().
 */
export async function getNewVsRecurringTrend() {
  return apiGet<Array<{ name: string; novos: number; recorrentes: number }>>("/customers/trend", () => []).then((r) => r.data);
}
