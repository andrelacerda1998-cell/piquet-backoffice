import type { DashboardSettings, TaxConfig } from "@/types";

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  vatRate: 0.23,
  employerSocialSecurityRate: 0.2375,
  employeeSocialSecurityRate: 0.11,
  withholdingIrsRate: 0.25,
  withholdingIrcRate: 0.25,
  alertDaysBeforeDue: [30, 15, 7, 1],
};

export const DEFAULT_SETTINGS: DashboardSettings = {
  taxConfig: DEFAULT_TAX_CONFIG,
  activeTechnicianDays: 30,
  goals: [
    { id: "g1", metric: "piquetRevenue", label: "Receita da Piquet", target: 85000, current: 0, unit: "currency" },
    { id: "g2", metric: "completedServices", label: "Serviços concluídos", target: 450, current: 0, unit: "number" },
    { id: "g3", metric: "newCustomers", label: "Novos clientes", target: 120, current: 0, unit: "number" },
    { id: "g4", metric: "conversionRate", label: "Taxa de conversão", target: 68, current: 0, unit: "percentage" },
    { id: "g5", metric: "averageRating", label: "Avaliação média", target: 4.5, current: 0, unit: "number" },
    { id: "g6", metric: "cac", label: "CAC máximo", target: 35, current: 0, unit: "currency" },
    { id: "g7", metric: "activeTechnicians", label: "Técnicos ativos", target: 180, current: 0, unit: "number" },
    { id: "g8", metric: "teamCost", label: "Custo da equipa", target: 42000, current: 0, unit: "currency" },
  ],
  categories: [
    { id: "cat_emergencia", name: "Assistência emergencial", slug: "emergencia" },
    { id: "cat_canalizacao", name: "Canalização", slug: "canalizacao" },
    { id: "cat_eletricidade", name: "Eletricidade", slug: "eletricidade" },
    { id: "cat_avac", name: "AVAC", slug: "avac" },
    { id: "cat_fechaduras", name: "Fechaduras e portas", slug: "fechaduras" },
    { id: "cat_instalacoes", name: "Instalações domésticas", slug: "instalacoes" },
    { id: "cat_limpeza", name: "Limpeza e manutenção", slug: "limpeza" },
    { id: "cat_mobiliario", name: "Montagem de mobiliário", slug: "mobiliario" },
  ],
  // As 12 cidades servidas (piquetapp.com → Cobertura): Grande Lisboa + Setúbal.
  locations: [
    { id: "loc_lisboa", name: "Lisboa", region: "Grande Lisboa" },
    { id: "loc_cascais", name: "Cascais", region: "Grande Lisboa" },
    { id: "loc_amadora", name: "Amadora", region: "Grande Lisboa" },
    { id: "loc_oeiras", name: "Oeiras", region: "Grande Lisboa" },
    { id: "loc_loures", name: "Loures", region: "Grande Lisboa" },
    { id: "loc_odivelas", name: "Odivelas", region: "Grande Lisboa" },
    { id: "loc_sintra", name: "Sintra", region: "Grande Lisboa" },
    { id: "loc_almada", name: "Almada", region: "Setúbal" },
    { id: "loc_barreiro", name: "Barreiro", region: "Setúbal" },
    { id: "loc_amora", name: "Amora", region: "Setúbal" },
    { id: "loc_moita", name: "Moita", region: "Setúbal" },
    { id: "loc_montijo", name: "Montijo", region: "Setúbal" },
  ],
  contractTypes: ["sem_termo", "a_termo", "prestacao_servicos", "estagio", "administrador", "part_time", "outro"],
  jobTitles: [
    "CEO", "COO", "CTO", "Full Stack Developer", "Backend Developer",
    "Frontend Developer", "Product Manager", "UI/UX Designer",
    "Marketing Manager", "Performance Marketing Specialist",
    "Customer Support", "Operations Manager", "Sales", "Financeiro",
    "Recursos Humanos", "Estagiário",
  ],
  departments: [
    "Direção", "Tecnologia", "Operações", "Marketing",
    "Financeiro", "Recursos Humanos", "Suporte", "Produto",
  ],
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  pedido_recebido: "Pedido recebido",
  a_procurar_tecnico: "A procurar técnico",
  tecnico_encontrado: "Técnico encontrado",
  a_aguardar_orcamento: "A aguardar orçamento",
  orcamento_enviado: "Orçamento enviado",
  a_aguardar_pagamento: "A aguardar pagamento",
  pago: "Pago",
  agendado: "Agendado",
  em_execucao: "Em execução",
  concluido: "Concluído",
  cancelado_cliente: "Cancelado pelo cliente",
  cancelado_tecnico: "Cancelado pelo técnico",
  sem_tecnico_disponivel: "Sem técnico disponível",
  reembolsado: "Reembolsado",
  em_reclamacao: "Em reclamação",
};

export const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: "LayoutDashboard" },
  { href: "/servicos", label: "Operações", icon: "Wrench" },
  { href: "/clientes", label: "Clientes", icon: "Users" },
  { href: "/tecnicos", label: "Técnicos", icon: "HardHat" },
  { href: "/financeiro", label: "Financeiro", icon: "Euro" },
  { href: "/produto", label: "Produto", icon: "MonitorSmartphone" },
  { href: "/marketing", label: "Marketing", icon: "Megaphone" },
  { href: "/leads", label: "CRM & Leads", icon: "UserPlus" },
  { href: "/chat", label: "Equipa", icon: "MessageSquare" },
  { href: "/desenvolvimento", label: "Desenvolvimento", icon: "Code2" },
  { href: "/tarefas", label: "Tarefas", icon: "ListChecks" },
  { href: "/configuracao", label: "Configurações", icon: "SlidersHorizontal" },
  // Separadores dentro dos grupos acima (consolidação 2026-07-20). Fora do
  // menu, mas acessíveis por ⌘K e por URL (deep-link ?tab=).
  { href: "/?tab=objetivos", label: "Objetivos do ano", icon: "Target" },
  { href: "/?tab=relatorios", label: "Relatórios", icon: "FileText" },
  { href: "/servicos?tab=personalizados", label: "Pedidos personalizados", icon: "Wand2" },
  { href: "/servicos?tab=qualidade", label: "Qualidade", icon: "ShieldCheck" },
  { href: "/clientes?tab=suporte", label: "Suporte", icon: "Headphones" },
  { href: "/tecnicos?tab=recrutamento", label: "Recrutamento", icon: "UserPlus" },
  { href: "/financeiro?tab=impostos", label: "Impostos e RH", icon: "Landmark" },
  { href: "/chat?tab=tarefas", label: "Tarefas e equipa", icon: "ListChecks" },
  // Operacional próprio, ainda fora do menu.
  { href: "/despacho", label: "Despacho ao vivo", icon: "Radio" },
  { href: "/alertas", label: "Alertas", icon: "Bell" },
] as const;

// Consolidação 2026-07-20: o menu passa a 9 grupos; cada um agrega os ecrãs
// relacionados em separadores (ex.: Técnicos inclui Recrutamento; Financeiro
// inclui Impostos e RH; Equipa inclui Tarefas e Desenvolvimento). Nada é
// apagado — os separadores são acessíveis por ⌘K (NAV_DEEPLINKS) e por URL.
export const NAV_PRIMARY: string[] = [
  "/", "/servicos", "/clientes", "/tecnicos", "/financeiro", "/produto",
  "/marketing", "/leads", "/chat", "/desenvolvimento", "/tarefas", "/configuracao",
];
// Vazio: com só 9 grupos, o menu mostra tudo direto (sem "Mais" recolhível).
export const NAV_SECONDARY: string[] = [];
export const NAV_VISIBLE: string[] = [...NAV_PRIMARY, ...NAV_SECONDARY];

// Separadores/ecrãs fora do menu que o ⌘K deve encontrar (saltam direto ao tab).
export const NAV_DEEPLINKS: string[] = [
  "/?tab=objetivos", "/?tab=relatorios",
  "/servicos?tab=personalizados", "/servicos?tab=qualidade",
  "/clientes?tab=suporte", "/tecnicos?tab=recrutamento",
  "/financeiro?tab=impostos", "/chat?tab=tarefas",
  "/despacho", "/alertas",
];

export const MARKETING_CHANNELS = [
  "Meta Ads", "Google Ads", "Instagram orgânico", "TikTok", "LinkedIn",
  "Pesquisa orgânica", "Referências", "Website", "App", "WhatsApp", "Parcerias",
];

export const PIQUET_BRAND = {
  primary: "#FAB347",
  text: "#1C1A17",
  success: "#1F9D6B",
  danger: "#D6503B",
  warning: "#E39A1C",
  info: "#3E7C8C",
};
