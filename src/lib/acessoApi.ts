import type { Permission, UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * Quem pode chamar cada rota da API — aplicado no SERVIDOR, em `withStaff`.
 *
 * Até 07/10/2026 as permissões só existiam no ecrã: o menu escondia o
 * Financeiro a quem não o devia ver, mas a API respondia a qualquer conta de
 * staff. Bastava um pedido à mão para ler salários, reembolsar um cliente ou
 * apagar um técnico.
 *
 * Uma linha por método e rota, com o mesmo caminho que o ficheiro tem em
 * src/app/api. Uma rota sem linha é RECUSADA, e o teste
 * `acessoApi.test.ts` lê os ficheiros de rotas e falha se faltar alguma — uma
 * rota nova obriga a decidir quem a pode chamar.
 *
 * Os números agregados da página inicial (GMV, resultado do mês, CAC/LTV,
 * contagens) continuam abertos a todo o staff, como sempre estiveram: a
 * página inicial é de todos. O que fica fechado é o detalhe (salários, dados
 * pessoais, pagamentos) e as ações (reembolsar, pagar, apagar, configurar).
 */

export type Requisito = { qualquer: Permission[] } | { todas: Permission[] };

const qualquer = (...p: Permission[]): Requisito => ({ qualquer: p });
const todas = (...p: Permission[]): Requisito => ({ todas: p });

/** Qualquer conta de staff: todos os perfis têm a visão geral. */
const STAFF = qualquer("view_dashboard");

export const POLITICA: Record<string, Requisito> = {
  // ---------------------------------------------------------- alertas
  "GET /alerts": qualquer("view_alerts"),
  "POST /alerts/snooze": qualquer("view_alerts"),
  "DELETE /alerts/snooze": qualquer("view_alerts"),

  // ------------------------------------------- catálogo e configurações
  // Lidos por todos (o filtro global de categorias está no topo de cada
  // ecrã); alterados só por quem gere as definições.
  "GET /allowed-zones": STAFF,
  "POST /allowed-zones": qualquer("manage_settings"),
  "PUT /allowed-zones/[id]": qualquer("manage_settings"),
  "GET /operation-areas": STAFF,
  "POST /operation-areas": qualquer("manage_settings"),
  "PUT /operation-areas/[id]": qualquer("manage_settings"),
  "GET /services-types": STAFF,
  "POST /services-types": qualquer("manage_settings"),
  "PUT /services-types/[id]": qualquer("manage_settings"),
  "DELETE /services-types/[id]": qualquer("manage_settings"),
  "GET /fee-settings": qualquer("manage_settings", "view_finance"),
  "PUT /fee-settings": qualquer("manage_settings"),
  "GET /audits": qualquer("manage_settings"),
  "GET /sent-notifications": qualquer("manage_settings"),
  "GET /sent-notifications/types": qualquer("manage_settings"),
  "GET /documents": qualquer("manage_settings", "upload_documents"),
  "POST /documents": qualquer("manage_settings", "upload_documents"),
  "PUT /documents/[id]": qualquer("manage_settings", "upload_documents"),
  "GET /goals": STAFF,
  "POST /goals": qualquer("manage_settings"),
  "PUT /goals/[id]": qualquer("manage_settings"),
  "DELETE /goals/[id]": qualquer("manage_settings"),

  // ---------------------------------------------------------- clientes
  "GET /customers": qualquer("view_customers"),
  "GET /customers/by-location": qualquer("view_customers"),
  "GET /customers/metrics": qualquer("view_customers"),
  "GET /customers/retention": qualquer("view_customers"),
  "GET /customers/trend": qualquer("view_customers"),
  "GET /customers/[id]/payment-methods": todas("view_customers", "view_personal_data"),
  "DELETE /customers/[id]/payment-methods/[methodId]": qualquer("destructive_actions"),
  "PUT /customers/[id]/block": qualquer("destructive_actions"),
  "PUT /customers/[id]/restore": qualquer("destructive_actions"),

  // ---------------------------------------------------------- serviços
  "GET /services": qualquer("view_services"),
  "POST /services": qualquer("edit_services"),
  "GET /services/counts": STAFF, // página inicial
  "GET /services/operacao": qualquer("view_services"),
  "GET /services/[id]": qualquer("view_services"),
  "PUT /services/[id]": qualquer("edit_services"),
  "GET /services/[id]/detalhe": qualquer("view_services"),
  "GET /services/[id]/fotos": qualquer("view_services"),
  "GET /custom-requests": qualquer("view_services"),
  "GET /operacoes/ao-vivo": qualquer("view_services"),

  // ---------------------------------------------------------- técnicos
  "GET /technicians": qualquer("view_technicians"),
  "GET /technicians/by-category": qualquer("view_technicians"),
  "GET /technicians/by-location": qualquer("view_technicians"),
  "GET /technicians/coverage": qualquer("view_technicians"),
  "GET /technicians/documentos": qualquer("view_technicians"),
  "GET /technicians/funil": qualquer("view_technicians"),
  "GET /technicians/live-locations": qualquer("view_technicians"),
  "GET /technicians/metrics": qualquer("view_technicians"),
  "GET /technicians/onboarding": qualquer("view_technicians"),
  "GET /technicians/top": qualquer("view_technicians"),
  "GET /technicians/[id]/messages": qualquer("view_technicians"),
  "GET /coverage": qualquer("view_technicians"),
  "POST /technicians/test-account": qualquer("manage_technicians"),
  "PUT /technicians/[id]/at-validation": qualquer("manage_technicians"),
  "POST /technicians/[id]/invoice-workspace": qualquer("manage_technicians"),
  "PUT /technicians/[id]/suspend": qualquer("manage_technicians"),
  "PUT /technicians/[id]/restore": qualquer("manage_technicians"),
  "DELETE /technicians/[id]/permanent": todas("manage_technicians", "destructive_actions"),
  "GET /vendor-documents": qualquer("view_technicians"),
  "GET /vendor-documents/[id]/file": qualquer("view_technicians"),
  "PUT /vendor-documents/[id]/approve": qualquer("manage_technicians"),
  "PUT /vendor-documents/[id]/decline": qualquer("manage_technicians"),
  "GET /vendor-no-shows": qualquer("view_support", "view_technicians"),
  // Declarar uma falta cobra mesmo ao técnico.
  "POST /vendor-no-shows/[id]/declare": qualquer("manage_technicians"),

  // ---------------------------------------------------------- dinheiro
  // Agregados da página inicial: abertos a todo o staff (ver o topo).
  "GET /finance/gmv": STAFF,
  "GET /finance/summary": STAFF,
  "GET /finance/unit-economics": STAFF,
  "GET /finance/operational-result": qualquer("view_finance"),
  "GET /finance/revenue-vs-costs": qualquer("view_finance"),
  "GET /finance/app-payments": qualquer("view_finance"),
  "POST /finance/app-payments/[uuid]/refund": qualquer("refund_payments"),
  "POST /finance/app-payments/[uuid]/cancel": qualquer("refund_payments"),
  "GET /finance/budget": qualquer("view_finance"),
  "POST /finance/budget": qualquer("view_finance"),
  "PUT /finance/budget/[id]": qualquer("view_finance"),
  "DELETE /finance/budget/[id]": qualquer("view_finance"),
  "GET /finance/company-invoices": qualquer("view_finance"),
  "POST /finance/company-invoices": qualquer("view_finance"),
  "PUT /finance/company-invoices/[id]": qualquer("view_finance"),
  "DELETE /finance/company-invoices/[id]": qualquer("view_finance"),
  "GET /finance/treasury": qualquer("view_finance"),
  "POST /finance/treasury": qualquer("view_finance"),
  "GET /system-profit": qualquer("view_finance"),
  "GET /vendor-payments": qualquer("view_finance"),
  "PUT /vendor-payments/[id]/pay": qualquer("pay_technicians"),
  "GET /tax/obligations": qualquer("view_finance"),
  "GET /tax/summary": qualquer("view_finance"),
  "GET /tax/vat": qualquer("view_finance"),
  "PUT /tax/obligations/[id]/pay": qualquer("mark_taxes_paid"),

  // ---------------------------------------------------------- equipa
  "GET /employees": qualquer("view_employees"),
  "GET /employees/dashboard": qualquer("view_employees"),
  "POST /employees": qualquer("manage_employees"),
  "PUT /employees/[id]": qualquer("manage_employees"),
  "DELETE /employees/[id]": qualquer("manage_employees"),

  // ---------------------------------------------------------- marketing
  // Os leads são lidos também em Clientes (a "Base de dados" junta-os).
  "GET /marketing/leads": qualquer("view_marketing", "view_customers"),
  "POST /marketing/leads": qualquer("view_marketing", "view_customers"),
  "PUT /marketing/leads/[id]": qualquer("view_marketing", "view_customers"),
  "DELETE /marketing/leads/[id]": qualquer("view_marketing"),
  "GET /marketing/leads/[id]/messages": qualquer("view_marketing", "view_customers"),
  "GET /marketing/leads/[id]/timeline": qualquer("view_marketing", "view_customers"),
  "GET /marketing/campaigns": qualquer("view_marketing"),
  "GET /marketing/channels": qualquer("view_marketing"),
  "GET /marketing/creatives": qualquer("view_marketing"),
  "GET /marketing/metrics": qualquer("view_marketing"),
  "GET /marketing/roas": qualquer("view_marketing"),
  "GET /marketing/spend": qualquer("view_marketing"),
  "POST /marketing/refresh": qualquer("view_marketing"),
  "POST /marketing/attribution/match": qualquer("view_marketing"),
  "GET /marketing/push-campaigns": qualquer("view_marketing"),
  "PUT /marketing/push-campaigns/[id]/active": qualquer("view_marketing"),
  "GET /marketing/google-access": qualquer("view_marketing"),
  "GET /marketing/ads/list": qualquer("view_marketing"),
  "GET /marketing/ads/options": qualquer("view_marketing"),
  "POST /marketing/ads/campaigns": qualquer("view_marketing"),
  "POST /marketing/ads/adsets": qualquer("view_marketing"),
  "POST /marketing/ads/ads": qualquer("view_marketing"),
  "POST /marketing/ads/creatives": qualquer("view_marketing"),
  "POST /marketing/ads/image": qualquer("view_marketing"),
  "PUT /marketing/ads/status": qualquer("view_marketing"),
  "GET /marketing/google-ads/list": qualquer("view_marketing"),
  "GET /marketing/google-ads/options": qualquer("view_marketing"),
  "GET /marketing/google-ads/tracking": qualquer("view_marketing"),
  "PUT /marketing/google-ads/tracking": qualquer("view_marketing"),
  "POST /marketing/google-ads/campaigns": qualquer("view_marketing"),
  "POST /marketing/google-ads/adgroups": qualquer("view_marketing"),
  "POST /marketing/google-ads/search-ads": qualquer("view_marketing"),
  "POST /marketing/google-ads/display-ads": qualquer("view_marketing"),
  "POST /marketing/google-ads/image": qualquer("view_marketing"),
  "PUT /marketing/google-ads/status": qualquer("view_marketing"),
  "GET /vouchers": qualquer("view_marketing"),
  "POST /vouchers": qualquer("view_marketing"),
  "PUT /vouchers/[id]": qualquer("view_marketing"),
  "DELETE /vouchers/[id]": qualquer("view_marketing"),

  // ---------------------------------------------------------- suporte
  "GET /support/inbox": qualquer("view_support"),
  "PUT /support/inbox/[id]/status": qualquer("view_support"),
  "PUT /support/inbox/[id]/priority": qualquer("view_support"),
  "POST /support/inbox/[id]/reply": qualquer("view_support"),
  "DELETE /support/inbox/[id]": todas("view_support", "destructive_actions"),
  "POST /support/inbox/seed": qualquer("manage_settings"),
  "DELETE /support/inbox/seed": qualquer("manage_settings"),
  "GET /quality": qualquer("view_support"),
  // Códigos de entrada: quem os lê entra na conta do cliente.
  "GET /sms-codes": todas("view_support", "view_personal_data"),

  // ------------------------------------------- produto, pesquisa, equipa
  "GET /product/growth": STAFF,
  "GET /product/ratings": STAFF,
  "GET /product/funnel": STAFF,
  "GET /product/cost-per-download": STAFF,
  "GET /product/integrations-status": STAFF,
  // A pesquisa filtra os resultados pelo perfil (ver api/search).
  "GET /search": STAFF,
  "POST /push/subscribe": STAFF,
  "DELETE /push/subscribe": STAFF,
  "POST /push/test": STAFF,
  "GET /tasks": STAFF,
  "POST /tasks": STAFF,
  "PUT /tasks/[id]": STAFF,
  "DELETE /tasks/[id]": STAFF,
  "GET /dev-tasks": STAFF,
  "POST /dev-tasks": STAFF,
  "PUT /dev-tasks/[id]": STAFF,
  "DELETE /dev-tasks/[id]": STAFF,
  "GET /team/agenda": STAFF,
  "GET /team/channels": STAFF,
  "POST /team/channels": STAFF,
  "POST /team/meetings": STAFF,
  "GET /team/messages": STAFF,
  "POST /team/messages": STAFF,
  "GET /team/tasks": STAFF,
  "POST /team/tasks": STAFF,
  "PUT /team/tasks/[id]/status": STAFF,
};

interface Regra {
  metodo: string;
  padrao: RegExp;
  dinamicos: number;
  requisito: Requisito;
}

/*
  Os segmentos fixos ganham aos dinâmicos, como no Next: `/services/counts`
  é a rota das contagens, não o serviço com id "counts".
*/
const REGRAS: Regra[] = Object.entries(POLITICA)
  .map(([chave, requisito]) => {
    const [metodo, caminho] = chave.split(" ");
    const partes = caminho.split("/");
    const padrao = new RegExp(
      "^" + partes.map((p) => (/^\[.+\]$/.test(p) ? "[^/]+" : p.replace(/[.*+?^${}()|\\]/g, "\\$&"))).join("/") + "/?$",
    );
    return { metodo, padrao, dinamicos: partes.filter((p) => p.startsWith("[")).length, requisito };
  })
  .sort((a, b) => a.dinamicos - b.dinamicos);

/** A regra de um pedido; `null` se a rota não estiver na política. */
export function requisitoDe(metodo: string, caminho: string): Requisito | null {
  const m = metodo.toUpperCase();
  // HEAD lê o mesmo que GET.
  const efetivo = m === "HEAD" ? "GET" : m;
  const limpo = caminho.replace(/^\/api(?=\/)/, "").split("?")[0];
  return REGRAS.find((r) => r.metodo === efetivo && r.padrao.test(limpo))?.requisito ?? null;
}

/** O perfil satisfaz o requisito? Um perfil desconhecido não satisfaz nada. */
export function cumpre(role: string, requisito: Requisito): boolean {
  const tem = new Set(ROLE_PERMISSIONS[role as UserRole] ?? []);
  return "todas" in requisito
    ? requisito.todas.every((p) => tem.has(p))
    : requisito.qualquer.some((p) => tem.has(p));
}

/** Pode este perfil fazer este pedido? Rota fora da política: não. */
export function podeChamar(role: string, metodo: string, caminho: string): boolean {
  const requisito = requisitoDe(metodo, caminho);
  return requisito !== null && cumpre(role, requisito);
}
