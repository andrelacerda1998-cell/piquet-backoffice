import { apiGet, apiPut } from "./api";
import { mockData } from "@/mocks/data";
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

export async function getCustomerMetrics() {
  return apiGet("/customers/metrics", () => {
    const customers = mockData.customers;
    const active = customers.filter((c) => c.status === "ativo" || c.status === "recorrente");
    const recurring = customers.filter((c) => c.status === "recorrente" || c.serviceCount >= 3);
    const oneTime = customers.filter((c) => c.serviceCount === 1);
    const inactive = customers.filter((c) => c.status === "inativo");
    const withComplaints = customers.filter((c) => c.complaintCount > 0);
    const totalRevenue = customers.reduce((s, c) => s + c.piquetRevenue, 0);

    return {
      registered: customers.length,
      newCustomers: customers.filter((c) => {
        const days = (Date.now() - new Date(c.registeredAt).getTime()) / 86400000;
        return days <= 30;
      }).length,
      active: active.length,
      recurring: recurring.length,
      oneTime: oneTime.length,
      inactive: inactive.length,
      repurchaseRate: customers.length ? (recurring.length / customers.length) * 100 : 0,
      avgServicesPerCustomer: customers.length ? customers.reduce((s, c) => s + c.serviceCount, 0) / customers.length : 0,
      avgRevenuePerCustomer: customers.length ? totalRevenue / customers.length : 0,
      estimatedLTV: customers.length ? totalRevenue / customers.length * 2.5 : 0,
      avgTimeToSecondService: 45,
      averageRating: customers.filter((c) => c.averageRating > 0).reduce((s, c) => s + c.averageRating, 0) / (customers.filter((c) => c.averageRating > 0).length || 1),
      withComplaints: withComplaints.length,
    };
  }).then((r) => r.data);
}

export async function getCustomersByLocation() {
  return apiGet("/customers/by-location", () => {
    const byCity: Record<string, number> = {};
    mockData.customers.forEach((c) => {
      byCity[c.city] = (byCity[c.city] ?? 0) + 1;
    });
    return Object.entries(byCity).map(([name, value]) => ({ name, value }));
  }).then((r) => r.data);
}

export async function getCustomersBySource() {
  return apiGet("/customers/by-source", () => {
    const bySource: Record<string, number> = {};
    mockData.customers.forEach((c) => {
      bySource[c.source] = (bySource[c.source] ?? 0) + 1;
    });
    return Object.entries(bySource).map(([name, value]) => ({ name, value }));
  }).then((r) => r.data);
}

export async function getRetentionData() {
  return apiGet("/customers/retention", () => [
    { name: "30 dias", value: 42 },
    { name: "60 dias", value: 35 },
    { name: "90 dias", value: 28 },
  ]).then((r) => r.data);
}

export async function getNewVsRecurringTrend() {
  return apiGet("/customers/trend", () => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    return months.map((name) => ({
      name,
      novos: Math.round(30 + Math.random() * 20),
      recorrentes: Math.round(50 + Math.random() * 30),
    }));
  }).then((r) => r.data);
}
