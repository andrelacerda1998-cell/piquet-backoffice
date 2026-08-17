import { apiGet, apiPut, apiPost } from "./api";
import type { PaginatedResult } from "@/types";

/**
 * Técnicos reais — migrado do Filament (App\Filament\Resources\VendorResource)
 * para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts e
 * App\Http\Controllers\Api\Admin\VendorController no backend.
 *
 * Forma mínima (id, nome, nif, contacto, preço/h, zonas, elegibilidade,
 * validação AT, estado, suspenso_em, criado_em) -- não os campos fictícios do
 * antigo `Technician` (categorias, avaliação, receita, serviços concluídos,
 * ...). Ver `Technician` em src/types para essa forma antiga (ainda usada
 * apenas pelo `TechnicianDetailDrawer`, que já não é alimentado por dados
 * reais nesta página).
 */
export interface RealVendor {
  id: number;
  name: string | null;
  nif: string | null;
  phone_number: string | null;
  price_rate: number | null;
  operation_areas: string[];
  can_accept_service: boolean;
  at_valid: boolean;
  at_validated_at: string | null;
  /**
   * Subutilizador do Portal das Finanças (o acesso que o técnico dá à Piquet
   * para emitir faturas em nome dele).
   *
   * Opcionais porque o VendorController ainda NÃO os expõe — só manda o
   * `at_valid`. Ficam aqui prontos: assim que o backend os enviar (com
   * qualquer um destes nomes), aparecem no perfil sem mais alterações. Nunca
   * pedimos nem guardamos a senha — só o identificador e quem/quando validou.
   */
  at_username?: string | null;
  at_user?: string | null;
  at_subuser?: string | null;
  at_validated_by?: string | null;
  status: string | null;
  suspended_at: string | null;
  created_at: string | null;
}

interface VendorsApiData {
  items: RealVendor[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getVendors(
  page = 1,
  pageSize = 20,
  search?: string,
  suspendedOnly = false
): Promise<PaginatedResult<RealVendor>> {
  const raw = await apiGet<VendorsApiData>(
    "/technicians",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: pageSize, total: 0 } }),
    { page, per_page: pageSize, search, suspended: suspendedOnly ? 1 : undefined }
  ).then((r) => r.data);

  return {
    data: raw.items,
    total: raw.meta.total,
    page: raw.meta.current_page,
    pageSize: raw.meta.per_page,
    totalPages: raw.meta.last_page,
  };
}

/**
 * Suspender/Reativar = soft-delete real do Vendor no Laravel. NOTA: no
 * Filament, só o super-admin pode mutar um vendor (o IBAN redireciona
 * payouts); a API de admin usa um token único partilhado por todo o staff
 * com acesso ao backoffice, por isso esta ação aqui NÃO tem essa restrição
 * -- decisão explícita (ver VendorController no backend).
 */
export async function suspendVendor(id: number): Promise<RealVendor> {
  return apiPut<RealVendor>(`/technicians/${id}/suspend`, {}, () => {
    throw new Error("Suspender técnicos precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function restoreVendor(id: number): Promise<RealVendor> {
  return apiPut<RealVendor>(`/technicians/${id}/restore`, {}, () => {
    throw new Error("Reativar técnicos precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

/**
 * Marca o subutilizador AT do técnico como validado (ou retira a validação).
 * Depende de `PUT /v1/admin/vendors/{id}/at-validation` no Laravel — enquanto
 * essa rota não existir, o erro devolvido diz-o de forma explícita, em vez de
 * fingir que gravou.
 */
export async function setVendorAtValidation(id: number, valid: boolean): Promise<void> {
  await apiPut(`/technicians/${id}/at-validation`, { valid }, () => {
    throw new Error("Validar o subutilizador AT precisa da API de admin do Laravel configurada.");
  });
}

/**
 * Indicadores da aba "Visão geral" -- calculados no Laravel a partir de
 * dados reais (App\Http\Controllers\Api\Admin\VendorController::metrics()).
 * Substituem os "estados" fictícios do mock (aprovado/disponivel/ativo/
 * em_validacao/suspenso) por sinais reais: "eligible" = pode aceitar serviço
 * (Vendor::canAcceptService), "online" = StatusVendor::ONLINE. Sem
 * avgApprovalTime: não há timestamp de quando um documento foi revisto no
 * Laravel, sem sinal fiável (decisão explícita, mesmo princípio de "vazio em
 * vez de inventar" já aplicado em CustomerMetrics).
 */
export interface VendorMetrics {
  registered: number;
  newThisMonth: number;
  eligible: number;
  online: number;
  docComplete: number;
  inValidation: number;
  noServices: number;
  approvalRate: number;
  profileCompletionRate: number;
  avgTimeToFirstService: number;
}

const ZERO_VENDOR_METRICS: VendorMetrics = {
  registered: 0, newThisMonth: 0, eligible: 0, online: 0, docComplete: 0,
  inValidation: 0, noServices: 0, approvalRate: 0, profileCompletionRate: 0,
  avgTimeToFirstService: 0,
};

export async function getVendorMetrics(): Promise<VendorMetrics> {
  return apiGet<VendorMetrics>("/technicians/metrics", () => ZERO_VENDOR_METRICS).then((r) => r.data);
}

/**
 * Técnicos por categoria -- conta cada vendor nas áreas de operação
 * (qualificação/oferta registada) para que está registado, não trabalho
 * realmente feito.
 */
export async function getVendorsByCategory() {
  return apiGet<Array<{ name: string; value: number }>>("/technicians/by-category", () => []).then((r) => r.data);
}

/**
 * Técnicos por localização -- zonas de cobertura declaradas (AllowedZone),
 * não a morada fiscal/de agendamentos.
 */
export async function getVendorsByLocation() {
  return apiGet<Array<{ name: string; value: number }>>("/technicians/by-location", () => []).then((r) => r.data);
}

export interface TopVendor {
  id: number;
  name: string | null;
  servicesCompleted: number;
  averageRating: number;
  piquetRevenue: number;
  amountReceived: number;
}

export async function getTopVendors(limit = 10) {
  return apiGet<TopVendor[]>("/technicians/top", () => [], { limit }).then((r) => r.data);
}

/**
 * Procura vs oferta por zona -- oferta = zonas de cobertura declaradas
 * (AllowedZone); procura = pedidos de serviço reais nessa cidade.
 */
export async function getVendorCoverage() {
  return apiGet<Array<{ name: string; procura: number; oferta: number; ratio: number }>>("/technicians/coverage", () => []).then((r) => r.data);
}

/**
 * Mapa ao vivo -- técnicos Online com localização atualizada nos últimos
 * 10 min (a app-vendor só envia GPS enquanto o técnico está Online ou com um
 * serviço aceite). Só informativo: não interfere no matching/fluxo de
 * pedidos, esse continua inteiramente na app.
 */
export interface VendorLiveLocation {
  id: number;
  name: string | null;
  is_test: boolean;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
  categories: string[];
}

/**
 * `includeTest` inclui contas marcadas como teste (excluídas por omissão) —
 * só para o staff validar o mapa sem depender de um técnico real online.
 */
export async function getVendorLiveLocations(includeTest = false) {
  return apiGet<VendorLiveLocation[]>(
    "/technicians/live-locations",
    () => [],
    { include_test: includeTest ? 1 : undefined }
  ).then((r) => r.data);
}

/**
 * Cria um técnico de teste (is_test=true) já pronto a ficar Online na app —
 * documentos obrigatórios aprovados automaticamente, IBAN/faturação/AT
 * preenchidos (App\Http\Controllers\Api\Admin\VendorController::
 * createTestAccount()). A password só é devolvida aqui, uma única vez —
 * não fica recuperável depois. Login na app-vendor é por email+password
 * (não SMS).
 */
export interface NewTestVendor {
  id: number;
  name: string;
  email: string;
  password: string;
  phone_number: string;
}

export async function createTestVendor(input: {
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
}): Promise<NewTestVendor> {
  return apiPost<NewTestVendor>("/technicians/test-account", input, () => {
    throw new Error("Criar conta de teste precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
