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
  locations: [
    { id: "loc_lisboa", name: "Lisboa", region: "Lisboa" },
    { id: "loc_amadora", name: "Amadora", region: "Lisboa" },
    { id: "loc_loures", name: "Loures", region: "Lisboa" },
    { id: "loc_odivelas", name: "Odivelas", region: "Lisboa" },
    { id: "loc_sintra", name: "Sintra", region: "Lisboa" },
    { id: "loc_cascais", name: "Cascais", region: "Lisboa" },
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
  { href: "/tecnicos", label: "Técnicos", icon: "HardHat" },
  { href: "/clientes", label: "Clientes", icon: "Users" },
  { href: "/financeiro", label: "Financeiro", icon: "Euro" },
  { href: "/produto", label: "Produto", icon: "MonitorSmartphone" },
  { href: "/marketing", label: "Marketing", icon: "Megaphone" },
  { href: "/suporte", label: "Suporte", icon: "Headphones" },
  { href: "/qualidade", label: "Qualidade", icon: "ShieldCheck" },
  { href: "/configuracao", label: "Configurações", icon: "SlidersHorizontal" },
  { href: "/chat", label: "Equipa", icon: "MessageSquare" },
  { href: "/alertas", label: "Alertas", icon: "Bell" },
  { href: "/despacho", label: "Despacho ao vivo", icon: "Radio" },
  { href: "/servicos-personalizados", label: "Pedidos personalizados", icon: "Wand2" },
  { href: "/recrutamento", label: "Recrutamento", icon: "UserPlus" },
  { href: "/impostos-rh", label: "Impostos e RH", icon: "Landmark" },
  { href: "/definicoes", label: "Definições", icon: "Settings" },
  // Acessíveis por URL, fora da navegação principal:
  { href: "/produto-suporte", label: "Produto e suporte (antigo)", icon: "Headphones" },
  { href: "/catalogo", label: "Catálogo", icon: "BookOpen" },
  { href: "/precos", label: "Preços", icon: "Tag" },
  { href: "/zonas", label: "Zonas", icon: "Map" },
  { href: "/objetivos", label: "Objetivos do ano", icon: "Target" },
  { href: "/tarefas", label: "Tarefas e equipa", icon: "ListChecks" },
  { href: "/categorias-zonas", label: "Categorias e zonas", icon: "MapPin" },
  { href: "/relatorios", label: "Relatórios", icon: "FileText" },
] as const;

// Estrutura de empresa: 10 departamentos sempre visíveis (+ Equipa, pedido do
// André) e o ocasional no "Mais" recolhível — tudo continua acessível por ⌘K.
export const NAV_PRIMARY: string[] = [
  "/", "/servicos", "/tecnicos", "/clientes", "/financeiro", "/produto",
  "/marketing", "/suporte", "/qualidade", "/configuracao", "/chat",
];
export const NAV_SECONDARY: string[] = [
  "/alertas", "/servicos-personalizados", "/recrutamento", "/impostos-rh", "/definicoes",
];
export const NAV_VISIBLE: string[] = [...NAV_PRIMARY, ...NAV_SECONDARY];

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
