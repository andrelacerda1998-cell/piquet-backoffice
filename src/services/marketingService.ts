import { apiGet } from "./api";
import { mockData } from "@/mocks/data";
import { applyFiltersToServices } from "@/lib/filters";
import { calculateCPL, calculateCAC, calculateROAS } from "@/lib/calculations";
import type { DashboardFilter } from "@/types";

export async function getMarketingMetrics(_filters: DashboardFilter) {
  return apiGet("/marketing/metrics", () => {
    const campaigns = mockData.campaigns;
    const totalInvestment = campaigns.reduce((s, c) => s + c.investment, 0);
    const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
    const totalCustomers = campaigns.reduce((s, c) => s + c.customers, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.piquetRevenue, 0);

    return {
      totalInvestment,
      leads: totalLeads,
      payingCustomers: totalCustomers,
      cpl: calculateCPL(totalInvestment, totalLeads),
      cac: calculateCAC(totalInvestment, totalCustomers),
      piquetRevenue: totalRevenue,
      roas: calculateROAS(totalRevenue, totalInvestment),
      conversionRate: totalLeads ? (totalCustomers / totalLeads) * 100 : 0,
      activeCampaigns: campaigns.filter((c) => c.status === "ativa").length,
    };
  }).then((r) => r.data);
}

export async function getCampaigns() {
  return apiGet("/marketing/campaigns", () => mockData.campaigns).then((r) => r.data);
}

export async function getMarketingFunnel() {
  return apiGet("/marketing/funnel", () => {
    const total = 500000;
    const steps = [
      { name: "Impressões", count: total },
      { name: "Cliques", count: Math.round(total * 0.025) },
      { name: "Visitas", count: Math.round(total * 0.018) },
      { name: "Leads", count: Math.round(total * 0.003) },
      { name: "Orçamentos", count: Math.round(total * 0.0015) },
      { name: "Pagamentos", count: Math.round(total * 0.0008) },
      { name: "Serviços concluídos", count: Math.round(total * 0.0006) },
    ];
    return steps.map((step, i) => ({
      ...step,
      conversionRate: i > 0 ? (step.count / steps[i - 1].count) * 100 : 100,
    }));
  }).then((r) => r.data);
}

export async function getCreativesPerformance() {
  return apiGet("/marketing/creatives", () => {
    return mockData.campaigns.map((c) => ({
      id: c.id,
      name: c.creative ?? c.campaignName,
      format: "Imagem",
      theme: c.campaignName,
      investment: c.investment,
      ctr: c.ctr,
      cpl: c.cpl,
      cac: c.cac,
      revenue: c.piquetRevenue,
      roas: c.roas,
      recommendation: c.roas > 3 ? "Escalar" : c.roas > 1.5 ? "Manter" : c.roas > 0.8 ? "Testar novamente" : "Desativar",
    }));
  }).then((r) => r.data);
}

export async function getChannelBreakdown() {
  return apiGet("/marketing/channels", () => {
    const byPlatform: Record<string, { investment: number; revenue: number; leads: number; customers: number }> = {};
    mockData.campaigns.forEach((c) => {
      if (!byPlatform[c.platform]) byPlatform[c.platform] = { investment: 0, revenue: 0, leads: 0, customers: 0 };
      byPlatform[c.platform].investment += c.investment;
      byPlatform[c.platform].revenue += c.piquetRevenue;
      byPlatform[c.platform].leads += c.leads;
      byPlatform[c.platform].customers += c.customers;
    });
    return Object.entries(byPlatform).map(([name, d]) => ({
      name,
      investment: Math.round(d.investment),
      revenue: Math.round(d.revenue),
      leads: d.leads,
      customers: d.customers,
      // CAC do canal = investimento / clientes adquiridos por esse canal.
      cac: d.customers ? Math.round((d.investment / d.customers) * 100) / 100 : 0,
      roas: d.investment ? d.revenue / d.investment : 0,
    }));
  }).then((r) => r.data);
}

export async function getCategoryZoneMetrics(filters: DashboardFilter) {
  return apiGet("/categories-zones/metrics", () => {
    const services = applyFiltersToServices(mockData.services, filters);
    const completed = services.filter((s) => s.status === "concluido");

    const byCategory: Record<string, { orders: number; completed: number; revenue: number; total: number }> = {};
    completed.forEach((s) => {
      if (!byCategory[s.categoryName]) byCategory[s.categoryName] = { orders: 0, completed: 0, revenue: 0, total: 0 };
      byCategory[s.categoryName].completed++;
      byCategory[s.categoryName].revenue += s.piquetRevenue;
    });
    services.forEach((s) => {
      if (!byCategory[s.categoryName]) byCategory[s.categoryName] = { orders: 0, completed: 0, revenue: 0, total: 0 };
      byCategory[s.categoryName].orders++;
      byCategory[s.categoryName].total += s.totalCustomerValue;
    });

    const categoryMetrics = Object.entries(byCategory).map(([name, d]) => ({
      name,
      orders: d.orders,
      completed: d.completed,
      conversionRate: d.orders ? (d.completed / d.orders) * 100 : 0,
      avgTicket: d.completed ? d.total / d.completed : 0,
      revenue: Math.round(d.revenue),
      availableTechnicians: mockData.technicians.filter((t) => t.categories.includes(name)).length,
      avgFindTime: Math.round(45 + Math.random() * 60),
      cancellations: services.filter((s) => s.categoryName === name && s.status.startsWith("cancelado")).length,
      complaints: services.filter((s) => s.categoryName === name && s.hasComplaint).length,
      avgRating: 4.2 + Math.random() * 0.6,
    }));

    const byZone: Record<string, { orders: number; completed: number; revenue: number }> = {};
    services.forEach((s) => {
      if (!byZone[s.city]) byZone[s.city] = { orders: 0, completed: 0, revenue: 0 };
      byZone[s.city].orders++;
      if (s.status === "concluido") {
        byZone[s.city].completed++;
        byZone[s.city].revenue += s.piquetRevenue;
      }
    });

    const zoneMetrics = Object.entries(byZone).map(([name, d]) => ({
      name,
      orders: d.orders,
      completed: d.completed,
      revenue: Math.round(d.revenue),
      conversionRate: d.orders ? (d.completed / d.orders) * 100 : 0,
      availableTechnicians: mockData.technicians.filter((t) => t.city === name).length,
      noTechnician: services.filter((s) => s.city === name && s.status === "sem_tecnico_disponivel").length,
      avgResponseTime: Math.round(15 + Math.random() * 30),
      avgTicket: d.completed ? d.revenue / d.completed * 2.5 : 0,
      avgRating: 4.1 + Math.random() * 0.7,
    }));

    return { categoryMetrics, zoneMetrics };
  }).then((r) => r.data);
}
