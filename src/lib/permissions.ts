import type { Permission, UserRole } from "@/types";

// Só liderança (CEO/CTO) tem login — ambos com acesso total.
const FULL_ACCESS: Permission[] = [
  "view_dashboard", "view_services", "edit_services", "view_finance",
  "view_salaries", "edit_salaries", "view_individual_costs", "view_aggregated_costs",
  "manage_taxes", "mark_taxes_paid", "upload_documents", "export_data",
  "change_status", "view_personal_data", "destructive_actions",
  "view_customers", "view_technicians", "view_marketing", "view_support",
  "view_alerts", "manage_settings", "view_employees", "manage_employees",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ceo: FULL_ACCESS,
  cto: FULL_ACCESS,
};

export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  "/": ["view_dashboard"],
  "/servicos": ["view_services"],
  "/financeiro": ["view_finance"],
  "/impostos-rh": ["view_finance", "view_employees"],
  "/clientes": ["view_customers"],
  "/tecnicos": ["view_technicians"],
  "/categorias-zonas": ["view_dashboard"],
  "/chat": ["view_dashboard"],
  "/tarefas": ["view_dashboard"],
  "/objetivos": ["view_dashboard"],
  "/servicos-personalizados": ["view_services"],
  "/recrutamento": ["view_employees", "view_technicians"],
  "/despacho": ["view_services"],
  "/configuracao": ["view_services"],
  "/catalogo": ["view_services"],
  "/precos": ["view_services", "view_finance"],
  "/zonas": ["view_dashboard"],
  "/qualidade": ["view_support"],
  "/relatorios": ["export_data"],
  "/marketing": ["view_marketing"],
  "/produto": ["view_dashboard"],
  "/suporte": ["view_support"],
  "/produto-suporte": ["view_support"],
  "/alertas": ["view_alerts"],
  "/definicoes": ["manage_settings"],
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
};
