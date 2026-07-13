// ============================================================
// Piquet Dashboard — Tipos principais
// ============================================================

export type UserRole =
  | "ceo"
  | "cto";

export type Permission =
  | "view_dashboard"
  | "view_services"
  | "edit_services"
  | "view_finance"
  | "view_salaries"
  | "edit_salaries"
  | "view_individual_costs"
  | "view_aggregated_costs"
  | "manage_taxes"
  | "mark_taxes_paid"
  | "upload_documents"
  | "export_data"
  | "change_status"
  | "view_personal_data"
  | "destructive_actions"
  | "view_customers"
  | "view_technicians"
  | "view_marketing"
  | "view_support"
  | "view_alerts"
  | "manage_settings"
  | "view_employees"
  | "manage_employees";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  department?: string;
}

export type ServiceStatus =
  | "pedido_recebido"
  | "a_procurar_tecnico"
  | "tecnico_encontrado"
  | "a_aguardar_orcamento"
  | "orcamento_enviado"
  | "a_aguardar_pagamento"
  | "pago"
  | "agendado"
  | "em_execucao"
  | "concluido"
  | "cancelado_cliente"
  | "cancelado_tecnico"
  | "sem_tecnico_disponivel"
  | "reembolsado"
  | "em_reclamacao";

export type PaymentStatus = "pendente" | "pago" | "parcial" | "reembolsado" | "falhado";
export type InvoiceStatus = "nao_emitida" | "emitida" | "com_erro" | "anulada";

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  technicianId?: string;
  technicianName?: string;
  categoryId: string;
  categoryName: string;
  serviceName: string;
  location: string;
  city: string;
  source: string;
  status: ServiceStatus;
  requestedAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  totalCustomerValue: number;
  technicianValue: number;
  piquetRevenue: number;
  vatValue: number;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
  rating?: number;
  hasComplaint: boolean;
  cancellationReason?: string;
  responseTimeMinutes?: number;
  technicianAssignmentTimeMinutes?: number;
  campaignId?: string;
  internalNotes?: string[];
}

export type CustomerSegment =
  | "novo"
  | "ativo"
  | "recorrente"
  | "alto_valor"
  | "em_risco"
  | "inativo"
  | "com_reclamacao";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
  location: string;
  city: string;
  serviceCount: number;
  totalSpent: number;
  piquetRevenue: number;
  lastServiceAt?: string;
  status: CustomerSegment;
  source: string;
  complaintCount: number;
  averageRating: number;
}

export type TechnicianStatus =
  | "registado"
  | "perfil_incompleto"
  | "em_validacao"
  | "aprovado"
  | "disponivel"
  | "indisponivel"
  | "ativo"
  | "inativo"
  | "suspenso"
  | "rejeitado";

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  categories: string[];
  specializations: string[];
  location: string;
  city: string;
  status: TechnicianStatus;
  documentationComplete: boolean;
  registeredAt: string;
  approvedAt?: string;
  servicesCompleted: number;
  acceptanceRate: number;
  cancellationRate: number;
  averageRating: number;
  piquetRevenue: number;
  amountReceived: number;
  lastActivityAt?: string;
}

export type ContractType =
  | "sem_termo"
  | "a_termo"
  | "prestacao_servicos"
  | "estagio"
  | "administrador"
  | "part_time"
  | "outro";

export type EmploymentStatus =
  | "ativo"
  | "periodo_experimental"
  | "de_baixa"
  | "de_ferias"
  | "inativo"
  | "contrato_terminado";

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  contractType: ContractType;
  employmentStatus: EmploymentStatus;
  startDate: string;
  endDate?: string;
  grossMonthlySalary: number;
  annualSalaryPayments: number;
  mealAllowanceMonthly: number;
  mealAllowanceMonths: number;
  fixedAllowancesMonthly: number;
  variableCompensationMonthly: number;
  annualBonus: number;
  employerSocialSecurityRate: number;
  employeeSocialSecurityRate: number;
  workersCompensationInsuranceMonthly: number;
  healthInsuranceMonthly: number;
  equipmentAnnualCost: number;
  softwareAnnualCost: number;
  trainingAnnualCost: number;
  recruitmentCost: number;
  otherMonthlyCosts: number;
  otherAnnualCosts: number;
  notes?: string;
}

export interface EmployeeCost {
  employeeId: string;
  grossMonthlySalary: number;
  grossAnnualSalary: number;
  employerSocialSecurity: number;
  mealAllowance: number;
  fixedAllowances: number;
  variableCompensation: number;
  bonuses: number;
  insurance: number;
  equipment: number;
  software: number;
  training: number;
  otherCosts: number;
  averageMonthlyCost: number;
  totalAnnualCost: number;
}

export type TaxObligationStatus =
  | "por_calcular"
  | "estimado"
  | "confirmado_contabilista"
  | "a_aguardar_pagamento"
  | "pago"
  | "pago_parcialmente"
  | "vencido"
  | "nao_aplicavel"
  | "cancelado";

export type TaxObligationCategory =
  | "iva"
  | "seguranca_social"
  | "retencao_irs"
  | "retencao_irc"
  | "pagamento_conta"
  | "irc"
  | "ies"
  | "modelo_22"
  | "declaracao_iva"
  | "declaracao_remuneracoes"
  | "seguro_acidentes"
  | "outro";

export interface TaxObligation {
  id: string;
  name: string;
  category: TaxObligationCategory;
  description: string;
  referencePeriod: string;
  amountEstimated: number;
  amountConfirmed?: number;
  dueDate: string;
  paymentDate?: string;
  status: TaxObligationStatus;
  recurrence: "mensal" | "trimestral" | "anual" | "unica";
  responsibleUserId?: string;
  paymentReference?: string;
  supportingDocument?: string;
  notes?: string;
  reminderDays: number;
  isEstimated: boolean;
}

export type AlertPriority = "critica" | "alta" | "media" | "baixa";
export type AlertStatus = "novo" | "em_analise" | "em_resolucao" | "resolvido" | "ignorado";
export type AlertType = "operacional" | "financeiro" | "fiscal" | "equipa" | "marketing" | "produto";

export interface DashboardAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  createdAt: string;
  entityType?: string;
  entityId?: string;
  status: AlertStatus;
  responsibleUserId?: string;
  recommendedAction: string;
}

export interface MarketingCampaign {
  id: string;
  platform: string;
  campaignName: string;
  adSet?: string;
  creative?: string;
  investment: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  customers: number;
  cac: number;
  piquetRevenue: number;
  roas: number;
  status: "ativa" | "pausada" | "concluida";
  startDate: string;
  endDate?: string;
}

export interface SupportTicket {
  id: string;
  userType: "cliente" | "tecnico";
  userName: string;
  subject: string;
  category: string;
  priority: AlertPriority;
  status: AlertStatus;
  responsibleUserId?: string;
  openedAt: string;
  resolvedAt?: string;
  openTimeHours: number;
}

export interface AppError {
  id: string;
  type: string;
  message: string;
  userId?: string;
  platform: string;
  version: string;
  occurredAt: string;
  frequency: number;
  status: AlertStatus;
  responsibleUserId?: string;
  priority: AlertPriority;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface Location {
  id: string;
  name: string;
  region: string;
}

export type PeriodPreset =
  | "hoje"
  | "ontem"
  | "ultimos_7_dias"
  | "ultimos_30_dias"
  | "este_mes"
  | "mes_anterior"
  | "este_trimestre"
  | "este_ano"
  | "personalizado";

export interface DashboardFilter {
  period: PeriodPreset;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  serviceId?: string;
  city?: string;
  technicianId?: string;
  serviceStatus?: ServiceStatus;
  customerSource?: string;
  campaignId?: string;
  department?: string;
  contractType?: ContractType;
  taxObligationStatus?: TaxObligationStatus;
  search?: string;
}

export interface SavedFilterView {
  id: string;
  name: string;
  filters: DashboardFilter;
  createdAt: string;
}

export interface DashboardGoal {
  id: string;
  metric: string;
  label: string;
  target: number;
  current: number;
  unit: "currency" | "number" | "percentage";
}

export interface MetricValue {
  value: number;
  previousValue: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
  sparkline?: number[];
  goal?: number;
  tooltip?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

export interface HiringScenario {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  grossMonthlySalary: number;
  contractType: ContractType;
  expectedStartDate: string;
  annualSalaryPayments: number;
  employerSocialSecurityRate: number;
  mealAllowanceMonthly: number;
  workersCompensationInsuranceMonthly: number;
  healthInsuranceMonthly: number;
  equipmentAnnualCost: number;
  softwareAnnualCost: number;
  trainingAnnualCost: number;
  recruitmentCost: number;
  annualBonus: number;
  otherMonthlyCosts: number;
  monthlyCost: number;
  annualCost: number;
  firstYearCost: number;
  impactOnBurnRate: number;
  impactOnRunway: number;
}

export interface CashFlowForecastItem {
  date: string;
  label: string;
  type: "entrada" | "saida";
  category: string;
  amount: number;
  isEstimated: boolean;
}

export interface CashFlowForecast {
  scenario: "conservador" | "base" | "otimista";
  periodDays: number;
  startingBalance: number;
  items: CashFlowForecastItem[];
  projectedBalance: number[];
  negativePeriods: string[];
}

export interface BudgetCategory {
  id: string;
  name: string;
  planned: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  conversionRate?: number;
  dropoffRate?: number;
  previousCount?: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ChartDataPoint {
  name: string;
  value?: number;
  previousValue?: number;
  [key: string]: string | number | undefined;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  changes?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  meta?: {
    cached?: boolean;
    timestamp?: string;
  };
}

export interface FinanceSummary {
  totalServiceValue: number;
  piquetRevenue: number;
  piquetRevenueWithoutVat: number;
  vat: number;
  technicianOwed: number;
  technicianPaid: number;
  pendingPayments: number;
  refunds: number;
  cancellations: number;
  invoicesIssued: number;
  invoicesWithError: number;
  operatingCosts: number;
  teamCosts: number;
  estimatedTaxes: number;
  estimatedMonthlyResult: number;
  estimatedAnnualResult: number;
  averageMarginPerService: number;
  burnRate: number;
  runwayMonths: number | null;
  currentBalance: number;
  projectedBalance: number;
}

export interface OverviewMetrics {
  ordersReceived: MetricValue;
  paidServices: MetricValue;
  completedServices: MetricValue;
  cancelledServices: MetricValue;
  piquetRevenue: MetricValue;
  totalServiceValue: MetricValue;
  averageTicket: MetricValue;
  conversionRate: MetricValue;
  newCustomers: MetricValue;
  recurringCustomers: MetricValue;
  approvedTechnicians: MetricValue;
  activeTechnicians: MetricValue;
  ordersWithoutTechnician: MetricValue;
  averageRating: MetricValue;
  complaintCount: MetricValue;
  estimatedTaxesThisMonth: MetricValue;
  monthlyTeamCost: MetricValue;
  estimatedMonthlyResult: MetricValue;
  projectedCashBalance: MetricValue;
}

export interface OperationalMetrics {
  avgResponseTime: number;
  avgTechnicianFindTime: number;
  avgQuoteToPaymentTime: number;
  avgOrderToExecutionTime: number;
  avgServiceDuration: number;
  completionRate: number;
  cancellationRate: number;
  reschedulingRate: number;
  noTechnicianRate: number;
  firstVisitResolutionRate: number;
  overdueServices: number;
  paidWithoutTechnician: number;
}

export interface TaxConfig {
  vatRate: number;
  employerSocialSecurityRate: number;
  employeeSocialSecurityRate: number;
  withholdingIrsRate: number;
  withholdingIrcRate: number;
  alertDaysBeforeDue: number[];
}

export interface DashboardSettings {
  taxConfig: TaxConfig;
  activeTechnicianDays: number;
  goals: DashboardGoal[];
  categories: ServiceCategory[];
  locations: Location[];
  contractTypes: ContractType[];
  jobTitles: string[];
  departments: string[];
}
