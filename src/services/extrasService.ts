import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import { mockData } from "@/mocks/data";
import { DEFAULT_SETTINGS } from "@/config/dashboard";

/* ============================ DESPACHO AO VIVO ============================ */

export interface DispatchRequest {
  id: string;
  customerName: string;
  categoryName: string;
  serviceName: string;
  city: string;
  status: string;
  waitingMinutes: number;
  value: number;
  radiusKm: number;
}

export interface AvailableTechnician {
  id: string;
  name: string;
  city: string;
  categories: string[];
  rating: number;
  distanceKm: number;
  acceptanceRate: number;
}

export interface DispatchBoard {
  kpis: { waiting: number; available: number; avgAssignMin: number; autoDispatchRate: number };
  requests: DispatchRequest[];
  technicians: AvailableTechnician[];
}

export async function getDispatchBoard(): Promise<DispatchBoard> {
  return apiGet("/dispatch", () => {
    const active = mockData.services.filter((s) =>
      ["a_procurar_tecnico", "tecnico_encontrado", "a_aguardar_orcamento", "agendado", "em_execucao"].includes(s.status)
    );
    const requests: DispatchRequest[] = active.slice(0, 8).map((s, i) => ({
      id: s.id,
      customerName: s.customerName,
      categoryName: s.categoryName,
      serviceName: s.serviceName,
      city: s.city,
      status: s.status,
      waitingMinutes: 3 + ((i * 7) % 41),
      value: s.totalCustomerValue,
      radiusKm: 5 + ((i * 3) % 12),
    }));
    const technicians: AvailableTechnician[] = mockData.technicians
      .filter((t) => t.status === "ativo")
      .slice(0, 7)
      .map((t, i) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        categories: t.categories.slice(0, 2),
        rating: t.averageRating,
        distanceKm: 1 + ((i * 2.4) % 9),
        acceptanceRate: t.acceptanceRate,
      }));
    return {
      kpis: {
        waiting: active.length,
        available: technicians.length,
        avgAssignMin: 12,
        autoDispatchRate: 74,
      },
      requests,
      technicians,
    };
  }).then((r) => r.data);
}

/* ============================ CATÁLOGO ============================ */

export interface CatalogCategory {
  id: string;
  name: string;
  icon: string;
  typeCount: number;
  commission: number;
  zones: number;
  active: boolean;
}

export interface ServiceType {
  id: string;
  name: string;
  categoryName: string;
  basePrice: number;
  commission: number;
  active: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  emergencia: "Siren", canalizacao: "Droplet", eletricidade: "Zap", avac: "Wind",
  fechaduras: "KeyRound", instalacoes: "Hammer", limpeza: "Sparkles", mobiliario: "Sofa",
};

export async function getCatalog(): Promise<{ categories: CatalogCategory[]; serviceTypes: ServiceType[] }> {
  return apiGet("/catalog", () => {
    const cats = DEFAULT_SETTINGS.categories;
    const categories: CatalogCategory[] = cats.map((c, i) => ({
      id: c.id,
      name: c.name,
      icon: CATEGORY_ICONS[c.slug] ?? "Wrench",
      typeCount: 2 + ((i * 5) % 4),
      commission: 25, // margem fixa da Piquet — igual em todos os tipos de serviço
      zones: 4 + (i % 4),
      active: true,
    }));
    const sampleTypes = [
      "Deteção de fugas", "Desentupimento", "Substituição de torneira", "Instalação de esquentador",
      "Quadro elétrico", "Substituição de tomada", "Instalação de AC", "Manutenção AVAC",
      "Abertura de porta", "Substituição de fechadura", "Montagem de móvel", "Fixação de TV",
      "Limpeza profunda", "Pintura de interior",
    ];
    const serviceTypes: ServiceType[] = sampleTypes.map((name, i) => ({
      id: `st_${i + 1}`,
      name,
      categoryName: cats[i % cats.length].name,
      basePrice: 35 + ((i * 13) % 120),
      commission: 25, // margem fixa da Piquet — igual em todos os tipos de serviço
      active: i % 9 !== 0,
    }));
    return { categories, serviceTypes };
  }).then((r) => r.data);
}

/* ============================ PREÇOS E PROMOÇÕES ============================ */

export interface Promotion {
  id: string;
  code: string;
  description: string;
  discount: string;
  status: "ativa" | "agendada" | "expirada";
  uses: number;
  validUntil: string;
}

export async function getPromotions(): Promise<Promotion[]> {
  return apiGet("/promotions", () => {
    const data: Promotion[] = [
      { id: "p1", code: "BEMVINDO10", description: "10% na primeira marcação", discount: "-10%", status: "ativa", uses: 342, validUntil: "2026-12-31" },
      { id: "p2", code: "VERAO25", description: "25€ em serviços de AVAC", discount: "-25€", status: "ativa", uses: 88, validUntil: "2026-09-30" },
      { id: "p3", code: "URGENCIA0", description: "Sem taxa de urgência (fim de semana)", discount: "Taxa 0€", status: "agendada", uses: 0, validUntil: "2026-08-15" },
      { id: "p4", code: "FIDELIDADE15", description: "15% para clientes recorrentes", discount: "-15%", status: "ativa", uses: 210, validUntil: "2026-12-31" },
      { id: "p5", code: "PRIMAVERA20", description: "20% em limpezas", discount: "-20%", status: "expirada", uses: 156, validUntil: "2026-05-31" },
    ];
    return data;
  }).then((r) => r.data);
}

/* ============================ ZONAS DE OPERAÇÃO ============================ */

export interface ZoneRow {
  id: string;
  name: string;
  region: string;
  customers: number;
  technicians: number;
  requests: number;
  coverage: number;
  cancelRate: number;
  revenue: number;
  avgTicket: number;
}

export async function getZones(): Promise<{ zones: ZoneRow[]; coverageAvg: number; byCity: { name: string; value: number }[] }> {
  return apiGet("/zones", () => {
    const services = mockData.services;
    const zones: ZoneRow[] = DEFAULT_SETTINGS.locations.map((loc, i) => {
      const inCity = services.filter((s) => s.city === loc.name);
      const requests = inCity.length || 20 + ((i * 17) % 60);
      const revenue = inCity.reduce((a, s) => a + s.piquetRevenue, 0) || 2000 + i * 900;
      const coverage = [92, 88, 76, 81, 95, 70][i % 6];
      return {
        id: loc.id,
        name: loc.name,
        region: loc.region,
        customers: 60 + ((i * 31) % 220),
        technicians: 8 + ((i * 5) % 34),
        requests,
        coverage,
        cancelRate: 4 + ((i * 3) % 9),
        revenue,
        avgTicket: requests ? Math.round(revenue / requests) : 0,
      };
    });
    const coverageAvg = Math.round(zones.reduce((a, z) => a + z.coverage, 0) / zones.length);
    const byCity = zones.map((z) => ({ name: z.name, value: z.requests }));
    return { zones, coverageAvg, byCity };
  }).then((r) => r.data);
}

/* ============================ QUALIDADE & CONFIANÇA ============================ */

export interface QualityData {
  kpis: { avgRating: number; nps: number; complaintRate: number; verifiedTechnicians: number };
  ratingSeries: { name: string; value: number }[];
  ratingDistribution: { name: string; value: number }[];
  complaints: { id: string; customerName: string; category: string; status: string; openedAt: string }[];
}

export async function getQuality(): Promise<QualityData> {
  return apiGet("/quality", () => {
    const services = mockData.services;
    const rated = services.filter((s) => s.rating);
    const avgRating = rated.length ? +(rated.reduce((a, s) => a + (s.rating ?? 0), 0) / rated.length).toFixed(2) : 4.6;
    const dist = [1, 2, 3, 4, 5].map((star) => ({
      name: `${star}★`,
      value: rated.filter((s) => Math.round(s.rating ?? 0) === star).length || (star >= 4 ? star * 30 : star * 4),
    }));
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    const ratingSeries = months.map((m, i) => ({ name: m, value: +(4.3 + (i % 3) * 0.15).toFixed(2) }));
    const complaints = services.filter((s) => s.hasComplaint).slice(0, 6).map((s, i) => ({
      id: s.id,
      customerName: s.customerName,
      category: s.categoryName,
      status: ["em_analise", "resolvido", "em_reclamacao"][i % 3],
      openedAt: s.requestedAt,
    }));
    return {
      kpis: {
        avgRating,
        nps: 62,
        complaintRate: +((services.filter((s) => s.hasComplaint).length / Math.max(1, services.length)) * 100).toFixed(1),
        verifiedTechnicians: mockData.technicians.filter((t) => t.documentationComplete).length,
      },
      ratingSeries,
      ratingDistribution: dist,
      complaints,
    };
  }).then((r) => r.data);
}

/* ============================ RELATÓRIOS ============================ */

export interface GeneratedReport {
  id: string;
  name: string;
  period: string;
  type: string;
  createdAt: string;
  format: string;
}

export async function getReports(): Promise<GeneratedReport[]> {
  return apiGet("/reports", () => {
    const data: GeneratedReport[] = [
      { id: "r1", name: "Relatório de fecho — Junho 2026", period: "Jun 2026", type: "Mensal completo", createdAt: "2026-07-01", format: "PDF" },
      { id: "r2", name: "Relatório de fecho — Maio 2026", period: "Mai 2026", type: "Mensal completo", createdAt: "2026-06-01", format: "PDF" },
      { id: "r3", name: "Performance de marketing — Q2", period: "Abr–Jun 2026", type: "Personalizado", createdAt: "2026-07-02", format: "XLSX" },
      { id: "r4", name: "Operação por zona — Junho", period: "Jun 2026", type: "Operacional", createdAt: "2026-07-01", format: "CSV" },
    ];
    return data;
  }).then((r) => r.data);
}

/* ============================ CHAT DA EQUIPA ============================ */

export interface ChatChannel { id: string; name: string; unread: number }
export interface ChatMessage { id: string; threadId: string; author: string; initials: string; text: string; time: string; own?: boolean; imageUrl?: string }

/** Colaboradores internos (equipa do backoffice) — para mensagens diretas e agenda. */
export interface TeamMember { id: string; name: string; role: string; department: string; initials: string }
export const TEAM_MEMBERS: TeamMember[] = [
  { id: "u2", name: "André Lacerda", role: "CEO", department: "Direção", initials: "AL" },
  { id: "u1", name: "Rodrigo Pacheco", role: "CTO", department: "Tecnologia", initials: "RP" },
  { id: "u3", name: "Maria Santos", role: "Operações", department: "Operações", initials: "MS" },
  { id: "u4", name: "Pedro Oliveira", role: "Financeiro", department: "Financeiro", initials: "PO" },
  { id: "u5", name: "Sofia Ferreira", role: "Recursos Humanos", department: "RH", initials: "SF" },
  { id: "u6", name: "Carlos Mendes", role: "Marketing", department: "Marketing", initials: "CM" },
  { id: "u7", name: "Inês Rodrigues", role: "Suporte", department: "Suporte", initials: "IR" },
];

/** Canais de conversa (estruturais). */
export const TEAM_CHANNELS: ChatChannel[] = [
  { id: "geral", name: "geral", unread: 0 },
  { id: "operacoes", name: "operações", unread: 3 },
  { id: "suporte", name: "suporte", unread: 0 },
  { id: "marketing", name: "marketing", unread: 1 },
  { id: "direcao", name: "direção", unread: 0 },
];

/** Mensagens semente (canais + diretas via threadId `dm:<memberId>`). */
export const TEAM_SEED_MESSAGES: ChatMessage[] = [
  { id: "m1", threadId: "geral", author: "Mariana Quintela", initials: "MQ", text: "Bom dia equipa! Semana forte de pedidos em Lisboa.", time: "09:02" },
  { id: "m2", threadId: "geral", author: "Ana Silva", initials: "AS", text: "Boa! Vamos reforçar o despacho na zona de Cascais.", time: "09:05", own: true },
  { id: "m3", threadId: "geral", author: "Tiago Nogueira", initials: "TN", text: "Deploy da nova versão da app às 14h, sem downtime previsto.", time: "09:12" },
  { id: "m4", threadId: "operacoes", author: "Mariana Quintela", initials: "MQ", text: "3 pedidos sem técnico em Sintra — alguém disponível?", time: "08:48" },
  { id: "m5", threadId: "operacoes", author: "Rui Ferreira", initials: "RF", text: "Vou apanhar o de canalização.", time: "08:51" },
  { id: "m6", threadId: "suporte", author: "Sofia Antunes", initials: "SA", text: "SLA em 94% esta semana 👏", time: "10:20" },
  { id: "m7", threadId: "marketing", author: "Beatriz Lemos", initials: "BL", text: "Campanha VERAO25 com ROAS 3,2× — a escalar orçamento.", time: "11:00" },
  { id: "m8", threadId: "direcao", author: "João Costa", initials: "JC", text: "Reunião de fecho mensal amanhã às 16h.", time: "16:30" },
  { id: "d1", threadId: "dm:u1-u3", author: "Maria Santos", initials: "MS", text: "Consegues aprovar o reforço de técnicos para Cascais?", time: "09:10" },
  { id: "d2", threadId: "dm:u1-u4", author: "Pedro Oliveira", initials: "PO", text: "Fecho do mês pronto para revisão quando puderes.", time: "08:30" },
  { id: "d3", threadId: "dm:u1-u6", author: "Carlos Mendes", initials: "CM", text: "Proposta de orçamento para julho no canal de marketing.", time: "11:05" },
];

/** Agenda da equipa interna — reuniões e blocos, por colaborador. */
export interface TeamAgendaEvent {
  id: string;
  person: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;
  title: string;
  type: "reuniao" | "foco" | "externo" | "ausencia";
  participants?: string[];
  location?: string;
}

export const TEAM_AGENDA_DAYS = ["2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09"];
export const TEAM_DAY_LABEL: Record<string, string> = {
  "2026-07-03": "Sex 03", "2026-07-04": "Sáb 04", "2026-07-05": "Dom 05", "2026-07-06": "Seg 06",
  "2026-07-07": "Ter 07", "2026-07-08": "Qua 08", "2026-07-09": "Qui 09",
};

export const TEAM_SEED_AGENDA: TeamAgendaEvent[] = [
  { id: "te1", person: "Ana Silva", date: "2026-07-06", start: "10:00", end: "11:00", title: "Comité executivo", type: "reuniao", participants: ["João Costa", "Maria Santos"], location: "Sala Lisboa" },
  { id: "te2", person: "Ana Silva", date: "2026-07-06", start: "15:00", end: "16:00", title: "1-1 com Marketing", type: "reuniao", participants: ["Carlos Mendes"] },
  { id: "te3", person: "João Costa", date: "2026-07-06", start: "10:00", end: "11:00", title: "Comité executivo", type: "reuniao", participants: ["Ana Silva"] },
  { id: "te4", person: "João Costa", date: "2026-07-07", start: "09:30", end: "10:30", title: "Investidores (externo)", type: "externo", location: "Online" },
  { id: "te5", person: "Maria Santos", date: "2026-07-06", start: "09:00", end: "09:30", title: "Stand-up de operações", type: "reuniao" },
  { id: "te6", person: "Maria Santos", date: "2026-07-06", start: "14:00", end: "16:00", title: "Foco — planeamento de rotas", type: "foco" },
  { id: "te7", person: "Pedro Oliveira", date: "2026-07-07", start: "11:00", end: "12:00", title: "Fecho mensal", type: "foco" },
  { id: "te8", person: "Sofia Ferreira", date: "2026-07-08", start: "10:00", end: "10:45", title: "Entrevista de recrutamento", type: "reuniao" },
  { id: "te9", person: "Carlos Mendes", date: "2026-07-06", start: "15:00", end: "16:00", title: "1-1 com Direção", type: "reuniao", participants: ["Ana Silva"] },
  { id: "te10", person: "Inês Rodrigues", date: "2026-07-09", start: "13:00", end: "17:00", title: "Ausente (tarde)", type: "ausencia" },
];

// Cache de sessão (demo): semeado, apendado nas escritas. Em produção, os
// endpoints reais (/team/messages, /team/agenda, /team/meetings) usam a BD.
let teamMessagesCache: ChatMessage[] = [...TEAM_SEED_MESSAGES];
let teamMeetingsCache: TeamAgendaEvent[] = [...TEAM_SEED_AGENDA];

export async function getTeamMessages(): Promise<ChatMessage[]> {
  return apiGet("/team/messages", () => teamMessagesCache).then((r) => r.data);
}

export async function sendTeamMessage(msg: Omit<ChatMessage, "id" | "own">): Promise<ChatMessage> {
  return apiPost("/team/messages", msg, () => {
    const full: ChatMessage = { ...msg, id: `msg_${Date.now()}`, own: true };
    teamMessagesCache = [...teamMessagesCache, full];
    return full;
  }).then((r) => r.data);
}

export async function getTeamMeetings(): Promise<TeamAgendaEvent[]> {
  return apiGet("/team/agenda", () => teamMeetingsCache).then((r) => r.data);
}

export async function createTeamMeeting(ev: Omit<TeamAgendaEvent, "id">): Promise<TeamAgendaEvent> {
  return apiPost("/team/meetings", ev, () => {
    const full: TeamAgendaEvent = { ...ev, id: `mtg_${Date.now()}` };
    teamMeetingsCache = [...teamMeetingsCache, full];
    return full;
  }).then((r) => r.data);
}

/** Tarefas atribuídas aos membros da equipa. */
export const TEAM_SEED_TASKS: TeamTask[] = [
  { id: "tt1", title: "Rever proposta de fornecedor de faturação certificada", assignee: "Pedro Oliveira", department: "Financeiro", priority: "alta", status: "em_curso", due: "2026-07-09" },
  { id: "tt2", title: "Reforçar despacho na zona de Cascais", assignee: "Maria Santos", department: "Operações", priority: "critica", status: "aberta", due: "2026-07-07" },
  { id: "tt3", title: "Lançar campanha de outono", assignee: "Carlos Mendes", department: "Marketing", priority: "media", status: "aberta", due: "2026-07-14" },
  { id: "tt4", title: "Entrevistas finais de recrutamento", assignee: "Sofia Ferreira", department: "Recursos Humanos", priority: "alta", status: "em_curso", due: "2026-07-08" },
  { id: "tt5", title: "Rever SLA de suporte da semana", assignee: "Inês Rodrigues", department: "Suporte", priority: "media", status: "concluida", due: "2026-07-04" },
  { id: "tt6", title: "Preparar reunião de investidores", assignee: "André Lacerda", department: "Direção", priority: "alta", status: "aberta", due: "2026-07-10" },
  { id: "tt7", title: "Avançar migração para Supabase", assignee: "Rodrigo Pacheco", department: "Tecnologia", priority: "critica", status: "em_curso", due: "2026-07-12" },
];
let teamTasksCache: TeamTask[] = [...TEAM_SEED_TASKS];

export async function getTeamTasks(): Promise<TeamTask[]> {
  return apiGet("/team/tasks", () => teamTasksCache).then((r) => r.data);
}

export async function createTeamTask(task: Omit<TeamTask, "id">): Promise<TeamTask> {
  return apiPost("/team/tasks", task, () => {
    const full: TeamTask = { ...task, id: `task_${Date.now()}` };
    teamTasksCache = [...teamTasksCache, full];
    return full;
  }).then((r) => r.data);
}

export async function updateTeamTaskStatus(id: string, status: TeamTask["status"]): Promise<TeamTask> {
  return apiPut(`/team/tasks/${id}/status`, { status }, () => {
    teamTasksCache = teamTasksCache.map((t) => (t.id === id ? { ...t, status } : t));
    const t = teamTasksCache.find((x) => x.id === id);
    if (!t) throw new Error("Tarefa não encontrada");
    return t;
  }).then((r) => r.data);
}

/* ============================ SERVIÇOS PERSONALIZADOS ============================ */

export interface CustomServiceRequest {
  id: string;
  customerName: string;
  phone: string;
  description: string;
  city: string;
  urgency: "baixa" | "media" | "alta";
  status: "novo" | "em_analise" | "orcamento_enviado" | "aprovado" | "recusado";
  createdAt: string;
  estimate?: number;
}

export async function getCustomServices(): Promise<CustomServiceRequest[]> {
  return apiGet("/custom-services", () => {
    const data: CustomServiceRequest[] = [
      { id: "cs_1", customerName: "Helena Marques", phone: "+351 912 345 678", description: "Instalação de painéis solares em moradia", city: "Cascais", urgency: "media", status: "em_analise", createdAt: "2026-06-28", estimate: 3200 },
      { id: "cs_2", customerName: "Bruno Tavares", phone: "+351 934 111 222", description: "Remodelação de casa de banho completa", city: "Lisboa", urgency: "baixa", status: "orcamento_enviado", createdAt: "2026-06-25", estimate: 5400 },
      { id: "cs_3", customerName: "Condomínio Estrela", phone: "+351 210 998 877", description: "Manutenção de elevador e zonas comuns", city: "Lisboa", urgency: "alta", status: "novo", createdAt: "2026-07-01" },
      { id: "cs_4", customerName: "Rita Nunes", phone: "+351 961 555 444", description: "Domótica — automação de estores e luzes", city: "Sintra", urgency: "media", status: "aprovado", createdAt: "2026-06-20", estimate: 2100 },
      { id: "cs_5", customerName: "Miguel Antunes", phone: "+351 926 777 000", description: "Reparação de telhado após tempestade", city: "Loures", urgency: "alta", status: "orcamento_enviado", createdAt: "2026-06-30", estimate: 1750 },
    ];
    return data;
  }).then((r) => r.data);
}

/* ============================ OBJETIVOS DO ANO ============================ */

export interface AnnualGoal {
  id: string;
  label: string;
  metric: string;
  metricLabel: string;
  unit: "currency" | "number" | "percentage";
  target: number;
  current: number;
  projection: number;
  /** Evolução diária deste ano (snapshots de `metric_snapshots`). */
  series: Array<{ date: string; value: number }>;
}

export interface MetricOption {
  key: string;
  label: string;
  unit: "currency" | "number" | "percentage";
  real: boolean;
}

export interface GoalsData {
  goals: AnnualGoal[];
  metrics: MetricOption[];
}

/** Objetivos do ano com métrica real associada + catálogo de métricas. */
export async function getGoals(): Promise<GoalsData> {
  return apiGet<GoalsData>("/goals", () => ({
    goals: [],
    // Mock só para o modo demo puro; em produção a rota é REAL_DATA.
    metrics: [
      { key: "gmv_mes", label: "GMV do mês", unit: "currency", real: true },
      { key: "comissao_mes", label: "Comissão Piquet (mês)", unit: "currency", real: true },
      { key: "downloads_total", label: "Downloads totais", unit: "number", real: true },
    ],
  })).then((r) => r.data);
}

export async function createGoal(input: { label?: string; metric: string; target: number }): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/goals", input, () => ({ id: `goal_${Date.now()}` })).then((r) => r.data);
}

export async function updateGoal(id: string, patch: { label?: string; metric?: string; target?: number }): Promise<void> {
  await apiPut(`/goals/${id}`, patch, () => null);
}

export async function deleteGoal(id: string): Promise<void> {
  await apiDelete(`/goals/${id}`, () => null);
}

/* ============================ TAREFAS & EQUIPA ============================ */

export interface TeamTask {
  id: string;
  title: string;
  assignee: string;
  department: string;
  priority: "critica" | "alta" | "media" | "baixa";
  status: "aberta" | "em_curso" | "concluida";
  due: string;
}

export async function getTasksBoard(): Promise<{ tasks: TeamTask[]; workload: { name: string; department: string; open: number; cost: number }[] }> {
  return apiGet("/tasks", () => {
    const tasks: TeamTask[] = [
      { id: "t1", title: "Rever contratos de técnicos a termo", assignee: "Sofia Ferreira", department: "Recursos Humanos", priority: "alta", status: "em_curso", due: "2026-07-05" },
      { id: "t2", title: "Auto-despacho para zona de Sintra", assignee: "Mariana Quintela", department: "Operações", priority: "critica", status: "aberta", due: "2026-07-03" },
      { id: "t3", title: "Fechar campanha de verão", assignee: "Beatriz Lemos", department: "Marketing", priority: "media", status: "aberta", due: "2026-07-10" },
      { id: "t4", title: "Migrar faturação para novo fornecedor", assignee: "Ricardo Sousa", department: "Financeiro", priority: "alta", status: "em_curso", due: "2026-07-15" },
      { id: "t5", title: "Corrigir bug de pagamentos MB Way", assignee: "Tiago Nogueira", department: "Tecnologia", priority: "critica", status: "aberta", due: "2026-07-02" },
      { id: "t6", title: "Onboarding de 12 técnicos novos", assignee: "Mariana Quintela", department: "Operações", priority: "media", status: "concluida", due: "2026-06-28" },
    ];
    const workload = [
      { name: "Mariana Quintela", department: "Operações", open: 3, cost: 11224 },
      { name: "Tiago Nogueira", department: "Tecnologia", open: 4, cost: 13246 },
      { name: "Beatriz Lemos", department: "Marketing", open: 2, cost: 3886 },
      { name: "Ricardo Sousa", department: "Financeiro", open: 2, cost: 4319 },
      { name: "Sofia Ferreira", department: "Recursos Humanos", open: 1, cost: 3500 },
    ];
    return { tasks, workload };
  }).then((r) => r.data);
}

/* ============================ RECRUTAMENTO ============================ */

export interface TechCandidate {
  id: string;
  name: string;
  specialization: string;
  city: string;
  status: "por_validar" | "em_analise" | "entrevista" | "aprovado" | "recusado";
  docsComplete: boolean;
  appliedAt: string;
}

export interface JobOpening {
  id: string;
  title: string;
  department: string;
  type: "Promoção interna" | "Mobilidade interna" | "Nova posição";
  candidates: number;
  status: "aberta" | "entrevistas" | "fechada";
  deadline: string;
}

export async function getRecruitment(): Promise<{ candidates: TechCandidate[]; openings: JobOpening[] }> {
  return apiGet("/recruitment", () => {
    const candidates: TechCandidate[] = [
      { id: "c1", name: "Nuno Bernardes", specialization: "Canalização", city: "Lisboa", status: "por_validar", docsComplete: false, appliedAt: "2026-07-01" },
      { id: "c2", name: "Patrícia Reis", specialization: "Eletricidade", city: "Amadora", status: "em_analise", docsComplete: true, appliedAt: "2026-06-29" },
      { id: "c3", name: "Hugo Martins", specialization: "AVAC", city: "Sintra", status: "entrevista", docsComplete: true, appliedAt: "2026-06-27" },
      { id: "c4", name: "Sara Lopes", specialization: "Limpeza e manutenção", city: "Loures", status: "aprovado", docsComplete: true, appliedAt: "2026-06-22" },
      { id: "c5", name: "Diogo Fonseca", specialization: "Fechaduras e portas", city: "Cascais", status: "recusado", docsComplete: false, appliedAt: "2026-06-20" },
    ];
    const openings: JobOpening[] = [
      { id: "v1", title: "Coordenador de Operações", department: "Operações", type: "Promoção interna", candidates: 4, status: "entrevistas", deadline: "2026-07-15" },
      { id: "v2", title: "Agente de Suporte sénior", department: "Suporte", type: "Mobilidade interna", candidates: 3, status: "aberta", deadline: "2026-07-31" },
      { id: "v3", title: "Analista de Dados", department: "Tecnologia", type: "Nova posição", candidates: 6, status: "aberta", deadline: "2026-08-10" },
      { id: "v4", title: "Team Lead de Marketing", department: "Marketing", type: "Promoção interna", candidates: 2, status: "entrevistas", deadline: "2026-07-05" },
      { id: "v5", title: "Engenheiro de Software sénior", department: "Tecnologia", type: "Promoção interna", candidates: 3, status: "aberta", deadline: "2026-08-22" },
    ];
    return { candidates, openings };
  }).then((r) => r.data);
}

export interface Complaint {
  id: string;
  customerName: string;
  serviceName: string;
  category: string;
  city: string;
  status: "aberta" | "em_analise" | "resolvida";
  openedAt: string;
}

export async function getComplaints(): Promise<Complaint[]> {
  return apiGet("/complaints", () => {
    return mockData.services
      .filter((s) => s.hasComplaint)
      .slice(0, 20)
      .map((s, i) => ({
        id: s.id,
        customerName: s.customerName,
        serviceName: s.serviceName,
        category: s.categoryName,
        city: s.city,
        status: (["aberta", "em_analise", "resolvida"][i % 3]) as "aberta" | "em_analise" | "resolvida",
        openedAt: s.requestedAt,
      }));
  }).then((r) => r.data);
}

/* ============================ MARKETING — CRM & GUIÕES ============================ */

export interface Lead {
  id: string;
  name: string;
  source: string;
  city: string;
  stage: "novo" | "contactado" | "qualificado" | "convertido" | "perdido";
  value: number;
  createdAt: string;
}

export async function getLeads(): Promise<Lead[]> {
  return apiGet("/marketing/leads", () => {
    const names = ["Helena Marques", "Bruno Tavares", "Rita Nunes", "Miguel Antunes", "Carla Sousa", "Nuno Faria", "Sofia Melo", "Paulo Reis"];
    const sources = ["Meta Ads", "Google Ads", "Instagram", "Referência", "Website"];
    const stages: Lead["stage"][] = ["novo", "contactado", "qualificado", "convertido", "perdido"];
    const cities = ["Lisboa", "Cascais", "Sintra", "Amadora", "Loures"];
    return names.map((name, i) => ({
      id: `lead_${i + 1}`,
      name,
      source: sources[i % sources.length],
      city: cities[i % cities.length],
      stage: stages[i % stages.length],
      value: 40 + ((i * 37) % 260),
      createdAt: `2026-06-${String(10 + (i % 18)).padStart(2, "0")}`,
    }));
  }).then((r) => r.data);
}

export interface MessageScript {
  id: string;
  title: string;
  channel: "WhatsApp" | "Email" | "SMS" | "Push";
  purpose: string;
  content: string;
}

export async function getScripts(): Promise<MessageScript[]> {
  return apiGet("/marketing/scripts", () => {
    const data: MessageScript[] = [
      { id: "s1", title: "Boas-vindas", channel: "WhatsApp", purpose: "Primeiro contacto", content: "Olá {nome}! Bem-vindo à Piquet 👋 Precisa de ajuda em casa? Encontramos o técnico certo em minutos." },
      { id: "s2", title: "Recuperar carrinho", channel: "Push", purpose: "Reativação", content: "{nome}, o seu pedido está quase pronto. Conclua a marcação e tenha o técnico à porta hoje." },
      { id: "s3", title: "Pós-serviço", channel: "Email", purpose: "Avaliação", content: "Como correu o serviço, {nome}? Avalie o técnico e ajude-nos a melhorar. Leva 30 segundos." },
      { id: "s4", title: "Promoção sazonal", channel: "SMS", purpose: "Campanha", content: "Piquet: 20% em limpezas esta semana com o código PRIMAVERA. Marque já na app." },
      { id: "s5", title: "Reativação 30 dias", channel: "WhatsApp", purpose: "Win-back", content: "{nome}, sentimos a sua falta! Volte à Piquet e receba 10€ no próximo serviço." },
    ];
    return data;
  }).then((r) => r.data);
}

/* ==================== PEDIDOS PERSONALIZADOS (serviços complexos) ==================== */

export interface TechProposal {
  id: string;
  technicianId?: string;
  technicianName: string;
  rating: number;
  reviewsCount: number;
  specialization: string;
  distanceKm: number;
  fixedPrice: number;      // preço fixo apresentado ao cliente
  topReviews: string[];    // avaliações passadas
}

export type CustomRequestStatus = "novo" | "em_analise" | "opcoes_enviadas" | "agendado" | "recusado";

export interface CustomRequest {
  id: string;
  customerName: string;
  phone: string;
  city: string;
  category: string;
  description: string;
  urgency: "baixa" | "media" | "alta";
  status: CustomRequestStatus;
  createdAt: string;
  estimatedHours: number | null;   // definido pela Piquet
  proposals: TechProposal[];       // 3 opções (vazio até estimar)
}

const SAMPLE_REVIEWS = [
  "Trabalho impecável e muito profissional.",
  "Rápido, limpo e explicou tudo.",
  "Chegou à hora e resolveu logo.",
  "Excelente relação qualidade/preço.",
  "Muito cuidadoso e simpático.",
  "Recomendo, voltarei a contratar.",
];

function makeProposals(seed: number, hours: number, category: string): TechProposal[] {
  const techs = mockData.technicians.filter((t) => t.averageRating >= 4 && t.servicesCompleted > 5);
  return Array.from({ length: 3 }).map((_, i) => {
    const t = techs[(seed * 3 + i) % techs.length];
    const hourly = 22 + ((seed + i) % 4) * 6; // 22–40€/h
    return {
      id: `prop_${seed}_${i}`,
      technicianId: t?.id,
      technicianName: t?.name ?? `Técnico ${i + 1}`,
      rating: t?.averageRating ?? 4.6,
      reviewsCount: (t?.servicesCompleted ?? 40) % 120 + 12,
      specialization: category,
      distanceKm: 1 + ((seed + i * 2) % 9),
      fixedPrice: Math.round(hours * hourly + 15),
      topReviews: [SAMPLE_REVIEWS[(seed + i) % SAMPLE_REVIEWS.length], SAMPLE_REVIEWS[(seed + i + 2) % SAMPLE_REVIEWS.length]],
    };
  });
}

export async function getCustomRequests(): Promise<CustomRequest[]> {
  return apiGet("/custom-requests", () => {
    const base: Omit<CustomRequest, "proposals">[] = [
      { id: "cr_1", customerName: "Helena Marques", phone: "+351 912 345 678", city: "Cascais", category: "Instalações domésticas", description: "Instalação de painéis solares numa moradia T4, incluindo ligação ao quadro elétrico.", urgency: "media", status: "opcoes_enviadas", createdAt: "2026-06-28", estimatedHours: 8 },
      { id: "cr_2", customerName: "Bruno Tavares", phone: "+351 934 111 222", city: "Lisboa", category: "Canalização", description: "Remodelação completa de casa de banho — substituir loiças, torneiras e canalização.", urgency: "baixa", status: "em_analise", createdAt: "2026-06-25", estimatedHours: 14 },
      { id: "cr_3", customerName: "Condomínio Estrela", phone: "+351 210 998 877", city: "Lisboa", category: "AVAC", description: "Manutenção anual do sistema AVAC e limpeza das zonas comuns do edifício.", urgency: "alta", status: "novo", createdAt: "2026-07-01", estimatedHours: null },
      { id: "cr_4", customerName: "Rita Nunes", phone: "+351 961 555 444", city: "Sintra", category: "Eletricidade", description: "Domótica — automação de estores, luzes e termostato em apartamento T3.", urgency: "media", status: "agendado", createdAt: "2026-06-20", estimatedHours: 6 },
      { id: "cr_5", customerName: "Miguel Antunes", phone: "+351 926 777 000", city: "Loures", category: "Instalações domésticas", description: "Reparação de telhado após tempestade — substituir telhas e impermeabilizar.", urgency: "alta", status: "novo", createdAt: "2026-06-30", estimatedHours: null },
      { id: "cr_6", customerName: "Sofia Melo", phone: "+351 915 222 333", city: "Amadora", category: "Montagem de mobiliário", description: "Montagem de cozinha completa em kit, com fixação de móveis suspensos.", urgency: "media", status: "opcoes_enviadas", createdAt: "2026-06-29", estimatedHours: 10 },
    ];
    return base.map((b, i) => ({
      ...b,
      // Só os já enviados/agendados trazem propostas; novos e em análise começam
      // vazios, para a equipa escolher os 3 técnicos à mão.
      proposals: (b.status === "opcoes_enviadas" || b.status === "agendado") && b.estimatedHours
        ? makeProposals(i + 1, b.estimatedHours, b.category) : [],
    }));
  }).then((r) => r.data);
}

/* ==================== RECRUTAMENTO — TAREFAS & AGENDA ==================== */

export const RECRUITERS = ["Sofia Antunes", "Mariana Quintela", "Helena Cruz"];

export interface RecruitmentTask {
  id: string;
  title: string;
  assignee: string;
  candidate?: string;
  priority: "critica" | "alta" | "media" | "baixa";
  status: "aberta" | "em_curso" | "concluida";
  due: string;
}

export async function getRecruitmentTasks(): Promise<RecruitmentTask[]> {
  return apiGet("/recruitment/tasks", () => {
    const data: RecruitmentTask[] = [
      { id: "rt1", title: "Validar documentos", assignee: "Sofia Antunes", candidate: "Nuno Bernardes", priority: "alta", status: "em_curso", due: "2026-07-03" },
      { id: "rt2", title: "Entrevista técnica", assignee: "Mariana Quintela", candidate: "Hugo Martins", priority: "alta", status: "aberta", due: "2026-07-04" },
      { id: "rt3", title: "Verificar registo criminal", assignee: "Helena Cruz", candidate: "Patrícia Reis", priority: "media", status: "aberta", due: "2026-07-05" },
      { id: "rt4", title: "Contactar referências", assignee: "Sofia Antunes", candidate: "Sara Lopes", priority: "media", status: "em_curso", due: "2026-07-03" },
      { id: "rt5", title: "Fechar vaga Analista de Dados", assignee: "Mariana Quintela", priority: "baixa", status: "aberta", due: "2026-07-08" },
      { id: "rt6", title: "Onboarding de aprovados", assignee: "Helena Cruz", priority: "critica", status: "aberta", due: "2026-07-03" },
      { id: "rt7", title: "Publicar vaga de Suporte", assignee: "Sofia Antunes", priority: "baixa", status: "concluida", due: "2026-07-01" },
    ];
    return data;
  }).then((r) => r.data);
}

export interface AgendaEvent {
  id: string;
  person: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;
  title: string;
  type: "entrevista" | "documentos" | "reuniao" | "follow_up";
  candidate?: string;
}

export async function getRecruitmentAgenda(): Promise<AgendaEvent[]> {
  return apiGet("/recruitment/agenda", () => {
    // Semana de 2026-07-03 (sex) a 2026-07-09 (qui) — foco no dia atual (03) e semana.
    const data: AgendaEvent[] = [
      { id: "ag1", person: "Sofia Antunes", date: "2026-07-03", start: "09:30", end: "10:15", title: "Entrevista — Hugo Martins", type: "entrevista", candidate: "Hugo Martins" },
      { id: "ag2", person: "Sofia Antunes", date: "2026-07-03", start: "11:00", end: "11:30", title: "Validar documentos — Nuno B.", type: "documentos", candidate: "Nuno Bernardes" },
      { id: "ag3", person: "Sofia Antunes", date: "2026-07-03", start: "15:00", end: "15:45", title: "Follow-up referências", type: "follow_up", candidate: "Sara Lopes" },
      { id: "ag4", person: "Mariana Quintela", date: "2026-07-03", start: "10:00", end: "11:00", title: "Reunião de recrutamento", type: "reuniao" },
      { id: "ag5", person: "Mariana Quintela", date: "2026-07-03", start: "14:00", end: "14:45", title: "Entrevista — Patrícia Reis", type: "entrevista", candidate: "Patrícia Reis" },
      { id: "ag6", person: "Helena Cruz", date: "2026-07-03", start: "09:00", end: "09:30", title: "Registo criminal — Patrícia R.", type: "documentos", candidate: "Patrícia Reis" },
      { id: "ag7", person: "Helena Cruz", date: "2026-07-03", start: "16:00", end: "16:30", title: "Onboarding — Sara Lopes", type: "reuniao", candidate: "Sara Lopes" },
      { id: "ag8", person: "Sofia Antunes", date: "2026-07-04", start: "10:00", end: "10:45", title: "Entrevista — candidato eletricista", type: "entrevista" },
      { id: "ag9", person: "Mariana Quintela", date: "2026-07-05", start: "11:00", end: "12:00", title: "Triagem de candidaturas", type: "reuniao" },
      { id: "ag10", person: "Helena Cruz", date: "2026-07-07", start: "09:30", end: "10:00", title: "Verificar IBAN — vários", type: "documentos" },
      { id: "ag11", person: "Sofia Antunes", date: "2026-07-08", start: "15:00", end: "15:30", title: "Fecho de vaga Suporte", type: "reuniao" },
    ];
    return data;
  }).then((r) => r.data);
}
