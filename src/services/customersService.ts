import { apiGet } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import type { PaginatedResult, SortParams, Customer } from "@/types";

export async function getCustomers(
  page = 1,
  pageSize = 20,
  sort?: SortParams,
  search?: string,
  segment?: string
): Promise<PaginatedResult<Customer>> {
  return apiGet(
    "/customers",
    () => {
      let items = [...mockData.customers];
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
      }
      if (segment) items = items.filter((c) => c.status === segment);
      if (sort) items = sortArray(items, sort.field as keyof Customer, sort.direction);
      return paginateArray(items, page, pageSize);
    },
    { page, pageSize, search, segment, sort: sort?.field, dir: sort?.direction }
  ).then((r) => r.data);
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
