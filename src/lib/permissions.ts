import type { Permission, UserRole } from "@/types";

// Acesso total — liderança e administração do sistema.
const FULL_ACCESS: Permission[] = [
  "view_dashboard", "view_services", "edit_services", "view_finance",
  "view_salaries", "edit_salaries", "view_individual_costs", "view_aggregated_costs",
  "manage_taxes", "mark_taxes_paid", "upload_documents", "export_data",
  "change_status", "view_personal_data", "destructive_actions",
  "view_customers", "view_technicians", "view_marketing", "view_support",
  "view_alerts", "manage_settings", "view_employees", "manage_employees",
];

/**
 * Permissões por perfil (RBAC real, 2026-07). Cada função só vê e faz o que é
 * do seu domínio. Liderança/admin mantêm acesso total (sem regressão para
 * quem já usa o backoffice). Perfis atribuídos na coluna `role` da tabela
 * `staff` do Supabase; o menu (Sidebar) e as rotas (RouteGuard) adaptam-se
 * automaticamente via `canAccessRoute` / `hasPermission`.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ceo: FULL_ACCESS,
  cto: FULL_ACCESS,
  admin: FULL_ACCESS,

  // Operações: gere serviços, estados, clientes/técnicos ao nível operacional.
  operacoes: [
    "view_dashboard", "view_services", "edit_services", "change_status",
    "destructive_actions", "view_customers", "view_technicians", "view_support",
    "view_alerts", "export_data",
  ],

  // Financeiro: finanças, impostos, folha e RH. Vê custos e salários.
  financeiro: [
    "view_dashboard", "view_finance", "view_aggregated_costs", "view_individual_costs",
    "view_salaries", "manage_taxes", "mark_taxes_paid", "view_employees", "export_data",
  ],

  // Marketing/Growth: aquisição e CRM/leads. Sem finanças nem salários.
  marketing: [
    "view_dashboard", "view_marketing", "view_customers", "export_data",
  ],

  // Apoio ao cliente: serviços, clientes (com dados pessoais p/ ajudar), tickets.
  suporte: [
    "view_dashboard", "view_services", "view_customers", "view_personal_data",
    "view_support", "view_alerts", "change_status", "export_data",
  ],

  // Gestão de técnicos: KYC, aprovações, performance, documentos.
  gestao_tecnicos: [
    "view_dashboard", "view_technicians", "view_services", "view_customers",
    "upload_documents", "view_alerts", "export_data",
  ],

  // Developer: quadro de dev, produto/integrações (gated em view_dashboard).
  developer: [
    "view_dashboard", "export_data",
  ],

  // Colaborador com acesso limitado: só a visão geral.
  colaborador: [
    "view_dashboard",
  ],
};

export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  "/": ["view_dashboard"],
  "/servicos": ["view_services"],
  "/financeiro": ["view_finance"],
  "/impostos-rh": ["view_finance", "view_employees"],
  "/clientes": ["view_customers"],
  "/tecnicos": ["view_technicians"],
  "/chat": ["view_dashboard"],
  "/desenvolvimento": ["view_dashboard"],
  "/tarefas": ["view_dashboard"],
  "/objetivos": ["view_dashboard"],
  "/produto": ["view_dashboard"],
  "/servicos-personalizados": ["view_services"],
  "/recrutamento": ["view_employees", "view_technicians"],
  "/despacho": ["view_services"],
  "/qualidade": ["view_support"],
  "/relatorios": ["export_data"],
  "/marketing": ["view_marketing"],
  "/suporte": ["view_support"],
  "/alertas": ["view_alerts"],
  // Configurações exige gerir definições (não só ver serviços, como estava).
  "/configuracao": ["manage_settings"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const required = ROUTE_PERMISSIONS[route];
  if (!required) return true;
  return hasAnyPermission(role, required);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: "CEO / Gestão",
  cto: "CTO",
  admin: "Administrador",
  operacoes: "Operações",
  financeiro: "Financeiro",
  marketing: "Marketing",
  suporte: "Apoio ao cliente",
  gestao_tecnicos: "Gestão de técnicos",
  developer: "Developer",
  colaborador: "Colaborador",
};
