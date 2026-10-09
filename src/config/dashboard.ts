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
  a_aguardar_confirmacao: "À espera de confirmação",
  pagamento_por_capturar: "Pagamento por capturar",
  arquivado: "Arquivado",
};

export const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: "LayoutDashboard" },
  // Logo a seguir à Visão Geral: é a lista do que precisa de ação hoje.
  { href: "/alertas", label: "Alertas", icon: "Bell" },
  { href: "/servicos", label: "Pedidos", icon: "Wrench" },
  { href: "/qualidade", label: "Qualidade", icon: "ShieldCheck" },
  { href: "/clientes", label: "Clientes", icon: "Users" },
  { href: "/tecnicos", label: "Técnicos", icon: "HardHat" },
  { href: "/mercado", label: "Mercado", icon: "Map" },
  { href: "/financeiro", label: "Financeiro", icon: "Euro" },
  { href: "/produto", label: "Produto", icon: "MonitorSmartphone" },
  { href: "/marketing", label: "Marketing", icon: "Megaphone" },
  { href: "/leads", label: "Contactos", icon: "Inbox" },
  { href: "/suporte", label: "Suporte", icon: "Headphones" },
  { href: "/chat", label: "Equipa", icon: "MessageSquare" },
  { href: "/desenvolvimento", label: "Desenvolvimento", icon: "Code2" },
  { href: "/tarefas", label: "As minhas tarefas", icon: "ListChecks" },
  { href: "/configuracao", label: "Configurações", icon: "SlidersHorizontal" },
  // Separadores dentro dos grupos acima (consolidação 2026-07-20). Fora do
  // menu, mas acessíveis por ⌘K e por URL (deep-link ?tab=).
  { href: "/?tab=objetivos", label: "Objetivos do ano", icon: "Target" },
  { href: "/?tab=relatorios", label: "Relatórios", icon: "FileText" },
  { href: "/servicos?tab=personalizados", label: "Pedidos personalizados", icon: "Wand2" },
  // O antigo "Onboarding de técnicos" (/recrutamento) está aqui dentro.
  { href: "/tecnicos?tab=aprovacoes", label: "Aprovações de técnicos", icon: "UserPlus" },
  { href: "/financeiro?tab=impostos", label: "Impostos e RH", icon: "Landmark" },
  { href: "/chat?tab=tarefas", label: "Tarefas da equipa", icon: "ListChecks" },
] as const;

/**
 * O menu: SEIS grupos, por trabalho a fazer, e não doze ecrãs lado a lado.
 *
 * A auditoria de 06/10/2026 contou 14 entradas (12 depois de tirar Equipa e
 * Desenvolvimento): lia-se como um índice de ecrãs, não como um painel de
 * operações. Nada sai: cada ecrã fica dentro do grupo a que pertence, e o
 * grupo da página em que se está abre-se sozinho. Ver src/lib/navGrupos.ts.
 */
export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  /** Os ecrãs do grupo; o primeiro que o perfil pode ver é o destino do grupo. */
  filhos: string[];
}

export const NAV_GROUPS: NavGroup[] = [
  /*
    Oito áreas (09/10/2026), pela ordem em que se usam: primeiro o que se faz
    todos os dias, depois o que se vê à semana e ao mês. Cada área responde a
    uma pergunta; os ecrãs que respondiam à mesma pergunta em sítios
    diferentes juntaram-se (Mercado junta o SLA de Operações e a Cobertura
    de Técnicos).
  */
  // O que precisa de ação hoje, e a lista completa dos alertas.
  { id: "inicio", label: "Visão Geral", icon: "LayoutDashboard", filhos: ["/", "/alertas"] },
  // Os pedidos: ao vivo, a lista, os personalizados.
  { id: "pedidos", label: "Pedidos", icon: "Wrench", filhos: ["/servicos"] },
  { id: "suporte", label: "Suporte", icon: "Headphones", filhos: ["/suporte"] },
  { id: "clientes", label: "Clientes", icon: "Users", filhos: ["/clientes", "/leads"] },
  // Os técnicos e a qualidade do trabalho deles (avaliações, faltas).
  { id: "tecnicos", label: "Técnicos", icon: "HardHat", filhos: ["/tecnicos", "/qualidade"] },
  // A procura e a oferta: se os pedidos estão a ser servidos e onde falta gente.
  { id: "mercado", label: "Mercado", icon: "Map", filhos: ["/mercado"] },
  { id: "financeiro", label: "Financeiro", icon: "Euro", filhos: ["/financeiro"] },
  { id: "crescimento", label: "Crescimento", icon: "Megaphone", filhos: ["/marketing", "/produto"] },
];

/** Fora dos grupos, no rodapé do menu: utilitários, não trabalho do dia. */
export const NAV_RODAPE: string[] = ["/configuracao"];

/** Como um ecrã se chama DENTRO do seu grupo, quando o nome do menu não serve. */
export const NAV_ROTULO_NO_GRUPO: Record<string, string> = {
  "/servicos": "Pedidos e serviços",
};

// Todos os ecrãs do menu, por ordem (o ⌘K usa esta lista).
export const NAV_PRIMARY: string[] = [...NAV_GROUPS.flatMap((g) => g.filhos), ...NAV_RODAPE];
export const NAV_SECONDARY: string[] = [];
export const NAV_VISIBLE: string[] = [...NAV_PRIMARY, ...NAV_SECONDARY];

// Separadores/ecrãs fora do menu que o ⌘K deve encontrar (saltam direto ao tab).
export const NAV_DEEPLINKS: string[] = [
  /*
    Equipa e Desenvolvimento saíram do menu a 6/10/2026 (auditoria: um chat e
    um kanban feitos à mão, ao lado do WhatsApp e do GitHub que a equipa já
    usa). Continuam aqui, a um ⌘K, até se decidir se saem de vez -- tirar do
    menu é reversível, apagar não é.
  */
  "/chat", "/desenvolvimento",
  "/tarefas",
  "/?tab=objetivos", "/?tab=relatorios",
  "/servicos?tab=personalizados",
  "/tecnicos?tab=aprovacoes",
  "/financeiro?tab=impostos", "/chat?tab=tarefas",
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
