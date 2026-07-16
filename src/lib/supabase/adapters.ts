import type { ServiceRequest, ServiceStatus, PaymentStatus, InvoiceStatus, Customer, CustomerSegment, Technician, TechnicianStatus, Employee, ContractType, EmploymentStatus, MarketingCampaign } from "@/types";

/**
 * Adaptadores linha (snake_case, Postgres) → tipos do frontend (camelCase).
 *
 * As Route Handlers usam estes para devolver ao frontend exatamente a forma que
 * ele já espera — sem tocar nos componentes. É a mesma lógica que permite ligar
 * módulo a módulo apenas ligando o `NEXT_PUBLIC_API_URL`.
 */

/**
 * Extrai `name` de um embed do PostgREST, robusto à cardinalidade: consoante a
 * deteção da FK, um embed to-one pode vir como objeto `{name}` OU como array
 * `[{name}]`. Trata ambos (e null).
 */
export function embedName(x: { name?: string | null } | Array<{ name?: string | null }> | null | undefined): string | null {
  if (!x) return null;
  const obj = Array.isArray(x) ? x[0] : x;
  return obj?.name ?? null;
}

// Linhas cruas com os nomes de coluna do schema (20260713103045_init.sql).
export interface ServiceRow {
  id: string;
  customer_id: string | null;
  technician_id: string | null;
  category_id: string | null;
  service_name: string;
  location: string | null;
  city: string | null;
  source: string | null;
  status: string;
  requested_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_customer_value: number;
  technician_value: number;
  piquet_revenue: number;
  vat_value: number;
  payment_status: string;
  invoice_status: string;
  rating: number | null;
  has_complaint: boolean;
  cancellation_reason: string | null;
  response_time_minutes: number | null;
  technician_assignment_time_min: number | null;
  campaign_id: string | null;
  internal_notes: string[] | null;
  // Juntados por relação (opcionais):
  customer_name?: string | null;
  technician_name?: string | null;
  category_name?: string | null;
}

export function rowToService(r: ServiceRow): ServiceRequest {
  return {
    id: r.id,
    customerId: r.customer_id ?? "",
    customerName: r.customer_name ?? "",
    technicianId: r.technician_id ?? undefined,
    technicianName: r.technician_name ?? undefined,
    categoryId: r.category_id ?? "",
    categoryName: r.category_name ?? "",
    serviceName: r.service_name,
    location: r.location ?? "",
    city: r.city ?? "",
    source: r.source ?? "",
    status: r.status as ServiceStatus,
    requestedAt: r.requested_at,
    scheduledAt: r.scheduled_at ?? undefined,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    totalCustomerValue: Number(r.total_customer_value) || 0,
    technicianValue: Number(r.technician_value) || 0,
    piquetRevenue: Number(r.piquet_revenue) || 0,
    vatValue: Number(r.vat_value) || 0,
    paymentStatus: r.payment_status as PaymentStatus,
    invoiceStatus: r.invoice_status as InvoiceStatus,
    rating: r.rating ?? undefined,
    hasComplaint: !!r.has_complaint,
    cancellationReason: r.cancellation_reason ?? undefined,
    responseTimeMinutes: r.response_time_minutes ?? undefined,
    technicianAssignmentTimeMinutes: r.technician_assignment_time_min ?? undefined,
    campaignId: r.campaign_id ?? undefined,
    internalNotes: r.internal_notes ?? [],
  };
}

// Campo camelCase do frontend → coluna do Postgres, para ordenação server-side.
const SERVICE_SORT_COLUMNS: Record<string, string> = {
  requestedAt: "requested_at",
  scheduledAt: "scheduled_at",
  completedAt: "completed_at",
  totalCustomerValue: "total_customer_value",
  piquetRevenue: "piquet_revenue",
  status: "status",
  city: "city",
  serviceName: "service_name",
};

export function serviceSortColumn(field?: string): string {
  return (field && SERVICE_SORT_COLUMNS[field]) || "requested_at";
}

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registered_at: string;
  location: string | null;
  city: string | null;
  status: string;
  source: string | null;
  service_count?: number;
  total_spent?: number;
  piquet_revenue?: number;
  last_service_at?: string | null;
  complaint_count?: number;
  average_rating?: number;
}

export function rowToCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? "",
    registeredAt: r.registered_at,
    location: r.location ?? "",
    city: r.city ?? "",
    serviceCount: Number(r.service_count) || 0,
    totalSpent: Number(r.total_spent) || 0,
    piquetRevenue: Number(r.piquet_revenue) || 0,
    lastServiceAt: r.last_service_at ?? undefined,
    status: r.status as CustomerSegment,
    source: r.source ?? "",
    complaintCount: Number(r.complaint_count) || 0,
    averageRating: Number(r.average_rating) || 0,
  };
}

const CUSTOMER_SORT_COLUMNS: Record<string, string> = {
  name: "name",
  registeredAt: "registered_at",
  city: "city",
  serviceCount: "service_count",
  totalSpent: "total_spent",
  piquetRevenue: "piquet_revenue",
  complaintCount: "complaint_count",
  averageRating: "average_rating",
  lastServiceAt: "last_service_at",
};
export function customerSortColumn(field?: string): string {
  return (field && CUSTOMER_SORT_COLUMNS[field]) || "total_spent";
}

export interface TechnicianRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  specializations: string[] | null;
  location: string | null;
  city: string | null;
  status: string;
  documentation_complete: boolean;
  registered_at: string;
  approved_at: string | null;
  services_completed?: number;
  piquet_revenue?: number;
  amount_received?: number;
  average_rating?: number;
  last_activity_at?: string | null;
}

export function rowToTechnician(r: TechnicianRow): Technician {
  return {
    id: r.id,
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    categories: r.categories ?? [],
    specializations: r.specializations ?? [],
    location: r.location ?? "",
    city: r.city ?? "",
    status: r.status as TechnicianStatus,
    documentationComplete: !!r.documentation_complete,
    registeredAt: r.registered_at,
    approvedAt: r.approved_at ?? undefined,
    servicesCompleted: Number(r.services_completed) || 0,
    // Ainda não rastreado na BD (sem histórico de aceitação/cancelamento).
    acceptanceRate: 0,
    cancellationRate: 0,
    averageRating: Number(r.average_rating) || 0,
    piquetRevenue: Number(r.piquet_revenue) || 0,
    amountReceived: Number(r.amount_received) || 0,
    lastActivityAt: r.last_activity_at ?? undefined,
  };
}

const TECHNICIAN_SORT_COLUMNS: Record<string, string> = {
  name: "name",
  city: "city",
  status: "status",
  registeredAt: "registered_at",
  servicesCompleted: "services_completed",
  piquetRevenue: "piquet_revenue",
  amountReceived: "amount_received",
  averageRating: "average_rating",
};
export function technicianSortColumn(field?: string): string {
  return (field && TECHNICIAN_SORT_COLUMNS[field]) || "piquet_revenue";
}

export interface EmployeeRow {
  id: string; full_name: string; email: string | null; phone: string | null;
  job_title: string | null; department: string | null; contract_type: string;
  employment_status: string; start_date: string | null; end_date: string | null;
  gross_monthly_salary: number; annual_salary_payments: number;
  meal_allowance_monthly: number; meal_allowance_months: number;
  fixed_allowances_monthly: number; variable_compensation_monthly: number;
  annual_bonus: number; employer_social_security_rate: number; employee_social_security_rate: number;
  workers_compensation_insurance_monthly: number; health_insurance_monthly: number;
  equipment_annual_cost: number; software_annual_cost: number; training_annual_cost: number;
  recruitment_cost: number; other_monthly_costs: number; other_annual_costs: number; notes: string | null;
}

export function rowToEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id, fullName: r.full_name, email: r.email ?? "", phone: r.phone ?? "",
    jobTitle: r.job_title ?? "", department: r.department ?? "",
    contractType: r.contract_type as ContractType, employmentStatus: r.employment_status as EmploymentStatus,
    startDate: r.start_date ?? "", endDate: r.end_date ?? undefined,
    grossMonthlySalary: Number(r.gross_monthly_salary) || 0, annualSalaryPayments: Number(r.annual_salary_payments) || 14,
    mealAllowanceMonthly: Number(r.meal_allowance_monthly) || 0, mealAllowanceMonths: Number(r.meal_allowance_months) || 0,
    fixedAllowancesMonthly: Number(r.fixed_allowances_monthly) || 0, variableCompensationMonthly: Number(r.variable_compensation_monthly) || 0,
    annualBonus: Number(r.annual_bonus) || 0, employerSocialSecurityRate: Number(r.employer_social_security_rate) || 0,
    employeeSocialSecurityRate: Number(r.employee_social_security_rate) || 0,
    workersCompensationInsuranceMonthly: Number(r.workers_compensation_insurance_monthly) || 0,
    healthInsuranceMonthly: Number(r.health_insurance_monthly) || 0, equipmentAnnualCost: Number(r.equipment_annual_cost) || 0,
    softwareAnnualCost: Number(r.software_annual_cost) || 0, trainingAnnualCost: Number(r.training_annual_cost) || 0,
    recruitmentCost: Number(r.recruitment_cost) || 0, otherMonthlyCosts: Number(r.other_monthly_costs) || 0,
    otherAnnualCosts: Number(r.other_annual_costs) || 0, notes: r.notes ?? undefined,
  };
}

const EMPLOYEE_SORT_COLUMNS: Record<string, string> = {
  fullName: "full_name", jobTitle: "job_title", department: "department",
  grossMonthlySalary: "gross_monthly_salary", startDate: "start_date",
};
export function employeeSortColumn(field?: string): string {
  return (field && EMPLOYEE_SORT_COLUMNS[field]) || "gross_monthly_salary";
}

export interface CampaignRow {
  id: string; platform: string; campaign_name: string; ad_set: string | null; creative: string | null;
  investment: number; impressions: number; reach: number; frequency: number; clicks: number;
  ctr: number; cpc: number; leads: number; cpl: number; customers: number; cac: number;
  piquet_revenue: number; roas: number; status: string; start_date: string | null; end_date: string | null;
}

export function rowToCampaign(r: CampaignRow): MarketingCampaign {
  return {
    id: r.id, platform: r.platform, campaignName: r.campaign_name,
    adSet: r.ad_set ?? undefined, creative: r.creative ?? undefined,
    investment: Number(r.investment) || 0, impressions: Number(r.impressions) || 0,
    reach: Number(r.reach) || 0, frequency: Number(r.frequency) || 0, clicks: Number(r.clicks) || 0,
    ctr: Number(r.ctr) || 0, cpc: Number(r.cpc) || 0, leads: Number(r.leads) || 0, cpl: Number(r.cpl) || 0,
    customers: Number(r.customers) || 0, cac: Number(r.cac) || 0, piquetRevenue: Number(r.piquet_revenue) || 0,
    roas: Number(r.roas) || 0, status: r.status as MarketingCampaign["status"],
    startDate: r.start_date ?? "", endDate: r.end_date ?? undefined,
  };
}

export interface TaxObligationRow {
  id: string; name: string; category: string | null; description: string | null;
  reference_period: string | null; amount_estimated: number; amount_confirmed: number | null;
  due_date: string | null; payment_date: string | null; status: string; recurrence: string;
  responsible_user_id: string | null; payment_reference: string | null;
  supporting_document: string | null; notes: string | null; reminder_days: number; is_estimated: boolean;
}

export function rowToTaxObligation(r: TaxObligationRow) {
  return {
    id: r.id, name: r.name, category: r.category ?? "", description: r.description ?? "",
    referencePeriod: r.reference_period ?? "", amountEstimated: Number(r.amount_estimated) || 0,
    amountConfirmed: r.amount_confirmed ?? undefined, dueDate: r.due_date ?? "",
    paymentDate: r.payment_date ?? undefined, status: r.status,
    recurrence: r.recurrence as "mensal" | "trimestral" | "anual" | "unica",
    responsibleUserId: r.responsible_user_id ?? undefined, paymentReference: r.payment_reference ?? undefined,
    supportingDocument: r.supporting_document ?? undefined, notes: r.notes ?? undefined,
    reminderDays: Number(r.reminder_days) || 0, isEstimated: !!r.is_estimated,
  };
}
