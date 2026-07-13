// Seeded pseudo-random for consistent mock data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

// Margem da Piquet: 25% fixos em TODOS os tipos de serviço (comissão sobre o
// valor do serviço). O técnico recebe os restantes 75% (TECH_SHARE).
export const PIQUET_COMMISSION = 0.25;
const TECH_SHARE = 1 - PIQUET_COMMISSION;

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const v = min + rand() * (max - min);
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const CITIES = ["Lisboa", "Amadora", "Loures", "Odivelas", "Sintra", "Cascais"];
const CATEGORIES = [
  { id: "cat_emergencia", name: "Assistência emergencial" },
  { id: "cat_canalizacao", name: "Canalização" },
  { id: "cat_eletricidade", name: "Eletricidade" },
  { id: "cat_avac", name: "AVAC" },
  { id: "cat_fechaduras", name: "Fechaduras e portas" },
  { id: "cat_instalacoes", name: "Instalações domésticas" },
  { id: "cat_limpeza", name: "Limpeza e manutenção" },
  { id: "cat_mobiliario", name: "Montagem de mobiliário" },
];

const SERVICE_NAMES: Record<string, string[]> = {
  cat_emergencia: ["Fuga de água urgente", "Avaria eléctrica", "Porta bloqueada"],
  cat_canalizacao: ["Reparação de torneira", "Desentupimento", "Substituição de sifão"],
  cat_eletricidade: ["Instalação de candeeiro", "Reparação de quadro", "Tomada avariada"],
  cat_avac: ["Manutenção AC", "Limpeza de filtros", "Recarga de gás"],
  cat_fechaduras: ["Abertura de porta", "Substituição de fechadura", "Cópia de chave"],
  cat_instalacoes: ["Instalação de prateleiras", "Fixação de TV", "Montagem cortinas"],
  cat_limpeza: ["Limpeza profunda", "Manutenção jardim", "Limpeza pós-obras"],
  cat_mobiliario: ["Montagem IKEA", "Montagem roupeiro", "Montagem secretária"],
};

const SOURCES = ["Website", "App", "Meta Ads", "Google Ads", "Referências", "WhatsApp", "Parcerias"];
const FIRST_NAMES = ["Ana", "João", "Maria", "Pedro", "Sofia", "Carlos", "Inês", "Miguel", "Beatriz", "Tiago", "Catarina", "Rui", "Mariana", "André", "Rita"];
const LAST_NAMES = ["Silva", "Santos", "Costa", "Oliveira", "Ferreira", "Rodrigues", "Martins", "Sousa", "Pereira", "Almeida", "Lopes", "Gomes", "Ribeiro", "Carvalho", "Pinto"];

const SERVICE_STATUSES = [
  "pedido_recebido", "a_procurar_tecnico", "tecnico_encontrado",
  "a_aguardar_orcamento", "orcamento_enviado", "a_aguardar_pagamento",
  "pago", "agendado", "em_execucao", "concluido",
  "cancelado_cliente", "cancelado_tecnico", "sem_tecnico_disponivel",
  "reembolsado", "em_reclamacao",
] as const;

const TECH_STATUSES = [
  "registado", "perfil_incompleto", "em_validacao", "aprovado",
  "disponivel", "indisponivel", "ativo", "inativo", "suspenso",
] as const;

function genName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function genEmail(name: string, i: number): string {
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
  return `${slug}${i}@demo.pt`;
}

// Generate customers (752)
export function generateCustomers(count = 752) {
  return Array.from({ length: count }, (_, i) => {
    const serviceCount = randInt(0, 12);
    const avgTicket = randFloat(45, 180);
    const totalSpent = serviceCount * avgTicket;
    const piquetRevenue = totalSpent * PIQUET_COMMISSION;
    const segments = ["novo", "ativo", "recorrente", "alto_valor", "em_risco", "inativo", "com_reclamacao"] as const;
    let status: typeof segments[number] = "novo";
    if (serviceCount === 0) status = "inativo";
    else if (serviceCount === 1) status = "novo";
    else if (serviceCount >= 5) status = serviceCount >= 8 ? "alto_valor" : "recorrente";
    else status = "ativo";

    const name = genName();
    return {
      id: `cust_${String(i + 1).padStart(4, "0")}`,
      name,
      email: genEmail(name, i),
      phone: `9${randInt(10000000, 99999999)}`,
      registeredAt: pastDate(randInt(1, 730)),
      location: pick(CITIES),
      city: pick(CITIES),
      serviceCount,
      totalSpent: Math.round(totalSpent * 100) / 100,
      piquetRevenue: Math.round(piquetRevenue * 100) / 100,
      lastServiceAt: serviceCount > 0 ? pastDate(randInt(1, 90)) : undefined,
      status,
      source: pick(SOURCES),
      complaintCount: rand() < 0.08 ? randInt(1, 3) : 0,
      averageRating: serviceCount > 0 ? randFloat(3.5, 5.0, 1) : 0,
    };
  });
}

// Generate technicians (382)
export function generateTechnicians(count = 382) {
  return Array.from({ length: count }, (_, i) => {
    const catCount = randInt(1, 3);
    const cats = [...CATEGORIES].sort(() => rand() - 0.5).slice(0, catCount);
    const servicesCompleted = randInt(0, 150);
    const registeredDaysAgo = randInt(30, 800);
    let status: typeof TECH_STATUSES[number] = "registado";
    if (i < 310) status = servicesCompleted > 0 && registeredDaysAgo < 60 ? "ativo" : "aprovado";
    else if (i < 340) status = "em_validacao";
    else if (i < 360) status = "perfil_incompleto";
    else status = pick(["inativo", "suspenso", "indisponivel"]);

    const isApproved = ["aprovado", "disponivel", "ativo", "indisponivel"].includes(status);
    const name = genName();
    const totalRevenue = servicesCompleted * randFloat(60, 200);
    const amountReceived = totalRevenue * TECH_SHARE;

    return {
      id: `tech_${String(i + 1).padStart(4, "0")}`,
      name,
      email: genEmail(name, i + 1000),
      phone: `9${randInt(10000000, 99999999)}`,
      categories: cats.map((c) => c.name),
      specializations: cats.flatMap((c) => (SERVICE_NAMES[c.id] ?? []).slice(0, 1)),
      location: pick(CITIES),
      city: pick(CITIES),
      status,
      documentationComplete: isApproved || rand() > 0.3,
      registeredAt: pastDate(registeredDaysAgo),
      approvedAt: isApproved ? pastDate(registeredDaysAgo - randInt(5, 20)) : undefined,
      servicesCompleted,
      acceptanceRate: randFloat(60, 95),
      cancellationRate: randFloat(2, 15),
      averageRating: servicesCompleted > 0 ? randFloat(3.8, 5.0, 1) : 0,
      piquetRevenue: Math.round(totalRevenue - amountReceived),
      amountReceived: Math.round(amountReceived),
      lastActivityAt: servicesCompleted > 0 ? pastDate(randInt(1, 45)) : undefined,
    };
  });
}

// Generate services (2500)
export function generateServices(customers: ReturnType<typeof generateCustomers>, technicians: ReturnType<typeof generateTechnicians>, count = 2500) {
  const approvedTechs = technicians.filter((t) =>
    ["aprovado", "disponivel", "ativo"].includes(t.status)
  );

  return Array.from({ length: count }, (_, i) => {
    const customer = pick(customers);
    const cat = pick(CATEGORIES);
    const serviceName = pick(SERVICE_NAMES[cat.id] ?? ["Serviço geral"]);
    const statusWeights = [0.02, 0.03, 0.04, 0.03, 0.05, 0.04, 0.08, 0.06, 0.05, 0.52, 0.04, 0.02, 0.01, 0.005, 0.015];
    let statusIdx = 0;
    const r = rand();
    let cum = 0;
    for (let j = 0; j < statusWeights.length; j++) {
      cum += statusWeights[j];
      if (r <= cum) { statusIdx = j; break; }
    }
    const status = SERVICE_STATUSES[statusIdx];
    const hasTech = !["pedido_recebido", "a_procurar_tecnico", "sem_tecnico_disponivel"].includes(status);
    const tech = hasTech ? pick(approvedTechs) : undefined;
    const totalCustomerValue = randFloat(35, 350);
    const technicianValue = Math.round(totalCustomerValue * TECH_SHARE * 100) / 100;
    const piquetRevenue = Math.round((totalCustomerValue - technicianValue) * 100) / 100;
    const vatValue = Math.round(piquetRevenue * (1 - 1 / 1.23) * 100) / 100;
    // Espalha por ~12 meses com viés para meses recentes (simula crescimento),
    // garantindo que todos os meses do seletor de mês têm dados.
    const requestedDaysAgo = Math.floor(Math.pow(rand(), 1.4) * 365);

    return {
      id: `svc_${String(i + 1).padStart(5, "0")}`,
      customerId: customer.id,
      customerName: customer.name,
      technicianId: tech?.id,
      technicianName: tech?.name,
      categoryId: cat.id,
      categoryName: cat.name,
      serviceName,
      location: customer.location,
      city: customer.city,
      source: customer.source,
      status,
      requestedAt: pastDate(requestedDaysAgo),
      scheduledAt: hasTech ? pastDate(Math.max(0, requestedDaysAgo - randInt(1, 5))) : undefined,
      startedAt: ["em_execucao", "concluido"].includes(status) ? pastDate(Math.max(0, requestedDaysAgo - randInt(2, 7))) : undefined,
      completedAt: status === "concluido" ? pastDate(Math.max(0, requestedDaysAgo - randInt(3, 10))) : undefined,
      totalCustomerValue,
      technicianValue,
      piquetRevenue,
      vatValue,
      paymentStatus: ["pago", "agendado", "em_execucao", "concluido"].includes(status) ? "pago" as const :
        status === "reembolsado" ? "reembolsado" as const :
        ["a_aguardar_pagamento", "orcamento_enviado"].includes(status) ? "pendente" as const : "pendente" as const,
      invoiceStatus: status === "concluido" ? (rand() > 0.05 ? "emitida" as const : "com_erro" as const) : "nao_emitida" as const,
      rating: status === "concluido" ? randFloat(3, 5, 1) : undefined,
      hasComplaint: status === "em_reclamacao" || (status === "concluido" && rand() < 0.04),
      responseTimeMinutes: randInt(5, 120),
      technicianAssignmentTimeMinutes: hasTech ? randInt(10, 480) : undefined,
      campaignId: customer.source.includes("Ads") ? `camp_${randInt(1, 12)}` : undefined,
      internalNotes: [],
    };
  });
}

export function generateEmployees() {
  const employees = [
    { fullName: "André Lacerda", jobTitle: "CEO", department: "Direção", grossMonthlySalary: 6500, contractType: "administrador" as const },
    { fullName: "Rodrigo Pacheco", jobTitle: "CTO", department: "Tecnologia", grossMonthlySalary: 5500, contractType: "administrador" as const },
    { fullName: "Ricardo Alves", jobTitle: "CTO", department: "Tecnologia", grossMonthlySalary: 4800, contractType: "sem_termo" as const },
    { fullName: "Marta Pereira", jobTitle: "Full Stack Developer", department: "Tecnologia", grossMonthlySalary: 3200, contractType: "sem_termo" as const },
    { fullName: "Tiago Sousa", jobTitle: "Backend Developer", department: "Tecnologia", grossMonthlySalary: 2800, contractType: "sem_termo" as const },
    { fullName: "Beatriz Lopes", jobTitle: "Frontend Developer", department: "Tecnologia", grossMonthlySalary: 2600, contractType: "sem_termo" as const },
    { fullName: "Carlos Mendes", jobTitle: "Marketing Manager", department: "Marketing", grossMonthlySalary: 3500, contractType: "sem_termo" as const },
    { fullName: "Inês Rodrigues", jobTitle: "Customer Support", department: "Suporte", grossMonthlySalary: 1400, contractType: "sem_termo" as const },
    { fullName: "Pedro Oliveira", jobTitle: "Customer Support", department: "Suporte", grossMonthlySalary: 1400, contractType: "sem_termo" as const },
    { fullName: "Maria Santos", jobTitle: "Operations Manager", department: "Operações", grossMonthlySalary: 3800, contractType: "sem_termo" as const },
    { fullName: "Sofia Ferreira", jobTitle: "Financeiro", department: "Financeiro", grossMonthlySalary: 3000, contractType: "sem_termo" as const },
    { fullName: "Luís Gomes", jobTitle: "UI/UX Designer", department: "Produto", grossMonthlySalary: 2400, contractType: "sem_termo" as const },
    { fullName: "Catarina Ribeiro", jobTitle: "Performance Marketing Specialist", department: "Marketing", grossMonthlySalary: 2200, contractType: "sem_termo" as const },
    { fullName: "André Pinto", jobTitle: "Estagiário", department: "Tecnologia", grossMonthlySalary: 800, contractType: "estagio" as const },
    { fullName: "Design Studio Lda", jobTitle: "UI/UX Designer", department: "Produto", grossMonthlySalary: 1800, contractType: "prestacao_servicos" as const },
  ];

  return employees.map((e, i) => ({
    id: `emp_${String(i + 1).padStart(3, "0")}`,
    fullName: e.fullName,
    email: genEmail(e.fullName, i + 2000),
    phone: `9${randInt(10000000, 99999999)}`,
    jobTitle: e.jobTitle,
    department: e.department,
    contractType: e.contractType,
    employmentStatus: "ativo" as const,
    startDate: pastDate(randInt(60, 900)),
    grossMonthlySalary: e.grossMonthlySalary,
    annualSalaryPayments: e.contractType === "prestacao_servicos" ? 12 : 14,
    mealAllowanceMonthly: e.contractType === "prestacao_servicos" ? 0 : 6.0,
    mealAllowanceMonths: e.contractType === "prestacao_servicos" ? 0 : 11,
    fixedAllowancesMonthly: 0,
    variableCompensationMonthly: randFloat(0, 200),
    annualBonus: e.jobTitle === "CEO" ? 10000 : randFloat(0, 3000),
    employerSocialSecurityRate: e.contractType === "prestacao_servicos" ? 0 : 0.2375,
    employeeSocialSecurityRate: e.contractType === "prestacao_servicos" ? 0 : 0.11,
    workersCompensationInsuranceMonthly: e.contractType === "prestacao_servicos" ? 0 : randFloat(15, 40),
    healthInsuranceMonthly: e.contractType === "prestacao_servicos" ? 0 : randFloat(30, 60),
    equipmentAnnualCost: randFloat(500, 2000),
    softwareAnnualCost: randFloat(200, 800),
    trainingAnnualCost: randFloat(0, 1500),
    recruitmentCost: i < 3 ? 0 : randFloat(0, 3000),
    otherMonthlyCosts: randFloat(0, 100),
    otherAnnualCosts: randFloat(0, 500),
    notes: e.contractType === "prestacao_servicos" ? "Prestador de serviços externo — dados de demonstração" : undefined,
  }));
}

export function generateTaxObligations() {
  const now = new Date();
  const obligations = [];
  const types = [
    { name: "Declaração periódica de IVA", category: "iva" as const, recurrence: "mensal" as const },
    { name: "Segurança Social — Remunerações", category: "seguranca_social" as const, recurrence: "mensal" as const },
    { name: "Retenções na fonte — IRS", category: "retencao_irs" as const, recurrence: "mensal" as const },
    { name: "Pagamento por conta — IRC", category: "pagamento_conta" as const, recurrence: "trimestral" as const },
    { name: "IRC — Imposto sobre o Rendimento", category: "irc" as const, recurrence: "anual" as const },
    { name: "IES — Informação Empresarial Simplificada", category: "ies" as const, recurrence: "anual" as const },
    { name: "Modelo 22 — Declaração anual", category: "modelo_22" as const, recurrence: "anual" as const },
    { name: "Seguro de acidentes de trabalho", category: "seguro_acidentes" as const, recurrence: "anual" as const },
  ];

  for (let m = -2; m <= 4; m++) {
    for (const t of types) {
      if (t.recurrence === "trimestral" && m % 3 !== 0) continue;
      if (t.recurrence === "anual" && m !== 0) continue;

      const refDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const dueDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 20);
      const amount = randFloat(800, 15000);
      const isPast = dueDate < now;
      const isPaid = isPast && rand() > 0.2;

      obligations.push({
        id: `tax_${obligations.length + 1}`,
        name: t.name,
        category: t.category,
        description: `${t.name} — período ${refDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })} (estimativa)`,
        referencePeriod: refDate.toISOString().slice(0, 7),
        amountEstimated: amount,
        amountConfirmed: isPaid ? amount * randFloat(0.95, 1.05) : undefined,
        dueDate: dueDate.toISOString(),
        paymentDate: isPaid ? new Date(dueDate.getTime() - randInt(1, 5) * 86400000).toISOString() : undefined,
        status: isPaid ? "pago" as const : isPast ? "vencido" as const : dueDate.getTime() - now.getTime() < 7 * 86400000 ? "a_aguardar_pagamento" as const : "estimado" as const,
        recurrence: t.recurrence,
        responsibleUserId: "u4",
        reminderDays: 7,
        isEstimated: !isPaid,
      });
    }
  }
  return obligations;
}

export function generateAlerts(count = 45) {
  const priorities = ["critica", "alta", "media", "baixa"] as const;
  const statuses = ["novo", "em_analise", "em_resolucao", "resolvido", "ignorado"] as const;

  const templates = [
    { type: "operacional" as const, title: "Pedido sem técnico disponível", action: "Atribuir técnico manualmente ou expandir zona" },
    { type: "operacional" as const, title: "Serviço pago sem técnico confirmado", action: "Contactar técnico ou reembolsar cliente" },
    { type: "financeiro" as const, title: "Pagamento recebido sem fatura", action: "Emitir fatura no sistema de faturação" },
    { type: "fiscal" as const, title: "Obrigação fiscal a vencer em 7 dias", action: "Confirmar valor com contabilista e preparar pagamento" },
    { type: "equipa" as const, title: "Técnico com documentos em falta", action: "Solicitar documentação pendente" },
    { type: "marketing" as const, title: "Campanha com CAC elevado", action: "Rever segmentação e criativos" },
    { type: "produto" as const, title: "Erro crítico na aplicação", action: "Investigar e corrigir imediatamente" },
  ];

  return Array.from({ length: count }, (_, i) => {
    const tpl = pick(templates);
    return {
      id: `alert_${String(i + 1).padStart(3, "0")}`,
      type: tpl.type,
      priority: pick(priorities),
      title: tpl.title,
      description: `${tpl.title} — dados de demonstração #${i + 1}`,
      createdAt: pastDate(randInt(0, 14)),
      entityType: tpl.type,
      entityId: `entity_${randInt(1, 100)}`,
      status: pick(statuses),
      recommendedAction: tpl.action,
    };
  });
}

export function generateCampaigns() {
  const platforms = ["Meta Ads", "Google Ads", "TikTok", "LinkedIn"];
  return Array.from({ length: 12 }, (_, i) => {
    const investment = randFloat(500, 8000);
    const impressions = randInt(10000, 500000);
    const clicks = randInt(200, impressions * 0.05);
    const leads = randInt(20, clicks * 0.3);
    const customers = randInt(5, leads * 0.4);
    const revenue = customers * randFloat(30, 80);

    return {
      id: `camp_${i + 1}`,
      platform: pick(platforms),
      campaignName: `Campanha ${pick(["Verão", "Inverno", "Lançamento", "Retargeting", "Brand"])} ${2025 + (i % 2)}`,
      adSet: `Conjunto ${randInt(1, 5)}`,
      creative: `Criativo ${String.fromCharCode(65 + (i % 5))}`,
      investment,
      impressions,
      reach: Math.round(impressions * randFloat(0.6, 0.9)),
      frequency: randFloat(1.2, 3.5),
      clicks,
      ctr: (clicks / impressions) * 100,
      cpc: investment / clicks,
      leads,
      cpl: investment / leads,
      customers,
      cac: investment / customers,
      piquetRevenue: revenue,
      roas: revenue / investment,
      status: i < 8 ? "ativa" as const : "concluida" as const,
      startDate: pastDate(randInt(10, 90)),
      endDate: i >= 8 ? pastDate(randInt(1, 5)) : undefined,
    };
  });
}

export function generateSupportTickets(count = 35) {
  return Array.from({ length: count }, (_, i) => {
    const userType = pick(["cliente", "tecnico"] as const);
    const userName = genName();
    const subject = pick(["Problema com pagamento", "Técnico não apareceu", "Erro na app", "Pedido de reembolso", "Dúvida sobre serviço"]);
    const status = pick(["novo", "em_analise", "em_resolucao", "resolvido"] as const);
    const openedDaysAgo = randInt(0, 30);
    // Primeira mensagem do cliente, com corpo consoante o assunto.
    const firstBody = pick([
      `Olá, tenho um problema: ${subject.toLowerCase()}. Podem ajudar?`,
      `Bom dia, estou a contactar por causa de "${subject.toLowerCase()}". Já tentei resolver sozinho mas sem sucesso.`,
      `Preciso de ajuda urgente com ${subject.toLowerCase()}. Obrigado.`,
    ]);
    const messages: { id: string; author: "cliente" | "agente"; authorName: string; body: string; at: string }[] = [
      { id: `msg_${i}_0`, author: userType === "tecnico" ? "cliente" : "cliente", authorName: userName, body: firstBody, at: pastDate(openedDaysAgo) },
    ];
    // Se já foi analisado/resolvido, adiciona respostas do agente.
    if (status !== "novo") {
      messages.push({ id: `msg_${i}_1`, author: "agente", authorName: "Suporte Piquet", body: "Olá, obrigado pelo contacto. Já estamos a analisar a sua situação e voltamos em breve com uma resposta.", at: pastDate(Math.max(0, openedDaysAgo - 1)) });
    }
    if (status === "em_resolucao" || status === "resolvido") {
      messages.push({ id: `msg_${i}_2`, author: "cliente", authorName: userName, body: "Obrigado pela resposta rápida. Fico a aguardar.", at: pastDate(Math.max(0, openedDaysAgo - 1)) });
    }
    if (status === "resolvido") {
      messages.push({ id: `msg_${i}_3`, author: "agente", authorName: "Suporte Piquet", body: "Já resolvemos a questão do seu lado. Qualquer coisa estamos ao dispor. Bom dia!", at: pastDate(Math.max(0, openedDaysAgo - 2)) });
    }
    return {
      id: `ticket_${String(i + 1).padStart(3, "0")}`,
      userType,
      userName,
      subject,
      category: pick(["Pagamentos", "Operações", "Técnico", "App", "Geral"]),
      priority: pick(["critica", "alta", "media", "baixa"] as const),
      status,
      openedAt: pastDate(openedDaysAgo),
      resolvedAt: status === "resolvido" ? pastDate(randInt(0, 5)) : undefined,
      openTimeHours: randFloat(1, 72),
      messages,
    };
  });
}

export function generateAppErrors(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    id: `err_${String(i + 1).padStart(3, "0")}`,
    type: pick(["PaymentError", "NetworkError", "ValidationError", "AuthError", "Crash"]),
    message: pick(["Falha ao processar pagamento", "Timeout na ligação", "Campo obrigatório em falta", "Sessão expirada", "NullPointerException"]),
    platform: pick(["iOS", "Android", "Web"]),
    version: `1.${randInt(0, 5)}.${randInt(0, 9)}`,
    occurredAt: pastDate(randInt(0, 14)),
    frequency: randInt(1, 150),
    status: pick(["novo", "em_analise", "em_resolucao", "resolvido"] as const),
    priority: pick(["critica", "alta", "media", "baixa"] as const),
  }));
}

// Initialize all mock data
const _customers = generateCustomers(752);
const _technicians = generateTechnicians(382);
const _services = generateServices(_customers, _technicians, 2500);
const _employees = generateEmployees();
const _taxObligations = generateTaxObligations();
const _alerts = generateAlerts(45);
const _campaigns = generateCampaigns();
const _tickets = generateSupportTickets(35);
const _errors = generateAppErrors(20);

export const mockData = {
  customers: _customers,
  technicians: _technicians,
  services: _services,
  employees: _employees,
  taxObligations: _taxObligations,
  alerts: _alerts,
  campaigns: _campaigns,
  supportTickets: _tickets,
  appErrors: _errors,
  isDemo: true,
};

export type MockData = typeof mockData;
