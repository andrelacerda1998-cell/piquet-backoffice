import { apiGet, apiPut, apiPost, apiDelete } from "./api";
import type { PaginatedResult } from "@/types";

/**
 * Técnicos reais — migrado do Filament (App\Filament\Resources\VendorResource)
 * para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts e
 * App\Http\Controllers\Api\Admin\VendorController no backend.
 *
 * Forma mínima (id, nome, nif, contacto, preço/h, zonas, elegibilidade,
 * validação AT, estado, suspenso_em, criado_em) -- não os campos fictícios do
 * antigo `Technician` (categorias, avaliação, receita, serviços concluídos,
 * ...). Ver `Technician` em src/types para essa forma antiga.
 *
 * O `TechnicianDetailDrawer`, que era o último a usá-la, foi apagado a
 * 29/09/2026: ninguém o renderizava desde que o perfil do técnico passou a
 * ecrã inteiro.
 */
export interface RealVendor {
  id: number;
  name: string | null;
  nif: string | null;
  phone_number: string | null;
  price_rate: number | null;
  operation_areas: string[];
  /*
    Os serviços do catálogo que o técnico escolheu fazer. É por aqui que o
    matching (VendorRankingService) decide se ele serve para um pedido --
    `operation_areas` guarda categorias, mas está preenchido em pouquíssimos.
    Opcional: só existe desde o PR #70 do backend (18/09/2026).
  */
  services_types?: string[];
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
  /**
   * Se o técnico chegou a introduzir credenciais do subutilizador (sem dizer
   * quais) e se elas servem para a Piquet emitir faturas em nome dele — que é
   * a pergunta que interessa: "dá para faturar por este técnico?".
   *
   * `at_invoicing_ok` deve ser o resultado de uma verificação REAL contra a AT
   * (criar workspace / emitir), não uma opinião. `at_checked_at` diz quando foi
   * testado e `at_check_error` porque falhou. Nenhum existe ainda no backend.
   */
  at_credentials_set?: boolean | null;
  at_invoicing_ok?: boolean | null;
  at_checked_at?: string | null;
  at_check_error?: string | null;
  /**
   * Morada FISCAL (a que vai na fatura) e IBAN.
   *
   * Sem `vat_regime`/`withholding_*`/`fiscal_name`: essas colunas NÃO existem
   * na base de dados do Laravel -- não são campos por enviar, são campos que
   * não há. A designação fiscal é a própria `company_name`.
   */
  address?: string | null;             // morada da sede
  billing_address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  iban?: string | null;                // sensível — ver nota na UI
  /**
   * Dados da empresa (CompanySection do Filament).
   *
   * `invoice_workspace` é o workspace de faturação no InvoiceXpress: sem ele a
   * Piquet NÃO consegue emitir fatura em nome do técnico no fim do serviço --
   * por isso `null` aqui é um bloqueio de negócio, não um detalhe cosmético.
   * `invoice_workspace_blocker` diz porque é que ainda não se pode criar
   * (null = pode); vem calculado do servidor porque depende de relações
   * (documentos aprovados, morada fiscal) que a listagem não envia.
   */
  company_name?: string | null;
  invoice_workspace?: string | null;
  invoice_workspace_blocker?: string | null;
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
export async function suspendVendor(id: number, motivo: string): Promise<RealVendor> {
  return apiPut<RealVendor>(`/technicians/${id}/suspend`, { motivo }, () => {
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
 * Apaga um técnico DE VEZ. Não tem volta.
 *
 * O `suspendVendor` faz soft delete e reverte-se com `restoreVendor`. Isto
 * remove o utilizador e tudo o que pende dele. Devolve `orphan_services`: os
 * serviços que a pessoa executou sobrevivem sem dono, e esse número é o custo
 * real da operação -- quem chama tem de o mostrar, não de o esconder.
 */
export async function deleteVendorPermanently(id: number): Promise<{ id: number; orphan_services: number }> {
  return apiDelete<{ id: number; deleted: boolean; orphan_services: number }>(
    `/technicians/${id}/permanent`,
    () => { throw new Error("Apagar técnicos precisa da API de admin do Laravel configurada."); },
  ).then((r) => r.data);
}

/**
 * Cria o workspace de faturação (InvoiceXpress) do técnico.
 *
 * É o passo que falta para a Piquet poder emitir fatura em nome dele quando o
 * serviço fecha. O backend valida as mesmas condições do Filament (contacto
 * verificado, documentos aprovados, IBAN, morada fiscal) e devolve a razão
 * exata quando recusa -- não se replicam aqui, sob pena de divergirem.
 */
export interface TecnicoSemWorkspace {
  id: number;
  name: string | null;
  at_user: string | null;
  created_at: string | null;
}

/**
 * Técnicos que entregaram o acesso à AT e esperam pelo workspace.
 *
 * Rota própria porque a lista de técnicos é paginada: filtrar a página aberta
 * encontrava alguns e escondia os outros. Sem série demo -- uma lista de
 * pessoas inventadas à espera de uma ação real seria pior do que um vazio.
 */
export interface ContagemWorkspaces {
  total: number;
  comWorkspace: number;
  aEspera: number;
  bloqueados: number;
  /** Documentos validados E workspace criado. */
  perfilCompleto: number;
  /** Margem de erro do `perfilCompleto` — ver a nota na rota. */
  contactoPorVerificar: number;
  /** Onde cada técnico está travado, pela ordem em que se atravessam. */
  degraus: {
    semContacto: number;
    semContactoRecentes: number;
    documentosPorAprovar: number;
    semIban: number;
    semMoradaFiscal: number;
    /** Fizeram 3 serviços e não entregaram a AT (5.º código, desde 30/09). */
    semAT: number;
    nadaEmFalta: number;
    /** Códigos de bloqueio ainda desconhecidos — não se escondem num total. */
    desconhecido: number;
  };
  /** `can_accept_service` do Laravel — a autoridade, não uma recontagem. */
  podemAceitar: number;
  /** Tudo o resto aprovado; falta só o subutilizador da AT. */
  soFaltaAT: number;
}

export interface DocumentoEmFalta { nome: string; em?: string | null; motivo?: string | null }
export interface TecnicoComDocumento { id: number; name: string | null; documentos: DocumentoEmFalta[] }
export interface ResumoDocumentos {
  total: number;
  completos: number;
  com_expirado: number;
  com_recusado: number;
  com_por_rever: number;
  nunca_submeteram: number;
  expirados: TecnicoComDocumento[];
  recusados: TecnicoComDocumento[];
}

/** Porque é que a documentação está incompleta, e quem se resolve hoje. */
const SEM_DOCUMENTOS: ResumoDocumentos = {
  total: 0, completos: 0, com_expirado: 0, com_recusado: 0,
  com_por_rever: 0, nunca_submeteram: 0, expirados: [], recusados: [],
};

export async function getResumoDocumentos(): Promise<ResumoDocumentos> {
  /*
    FALHA EM SILÊNCIO, de propósito.

    Isto é um painel secundário da aba de Aprovações. Quando o endpoint do
    Laravel ainda não existe -- foi exactamente o que aconteceu a 30/09, com o
    backend por publicar -- um erro aqui rebentava a ABA INTEIRA e deixava o
    ecrã com um "Tentar novamente". A fila de documentos, que é o trabalho
    real daquela aba, deixava de se poder abrir por causa de um extra.

    Um painex que não carrega deve desaparecer, não levar o ecrã com ele.
  */
  try {
    return (await apiGet<ResumoDocumentos>("/technicians/documentos", () => SEM_DOCUMENTOS)).data;
  } catch (e) {
    console.error("[documentos] não foi possível ler o resumo:", e);
    return SEM_DOCUMENTOS;
  }
}

export async function getTecnicosSemWorkspace(): Promise<{
  items: TecnicoSemWorkspace[]; total: number; contagem: ContagemWorkspaces;
}> {
  // Mesma razão do resumo dos documentos: alimenta um painel da Visão geral e
  // não pode derrubar o ecrã se o backend tropeçar.
  try {
    return await lerFunil();
  } catch (e) {
    console.error("[funil] não foi possível ler:", e);
    return {
      items: [], total: 0,
      contagem: {
        total: 0, comWorkspace: 0, aEspera: 0, bloqueados: 0, perfilCompleto: 0,
        podemAceitar: 0, soFaltaAT: 0, contactoPorVerificar: 0,
        degraus: { semContacto: 0, semContactoRecentes: 0, documentosPorAprovar: 0, semIban: 0, semMoradaFiscal: 0, semAT: 0, nadaEmFalta: 0, desconhecido: 0 },
      },
    };
  }
}

async function lerFunil(): Promise<{
  items: TecnicoSemWorkspace[]; total: number; contagem: ContagemWorkspaces;
}> {
  return apiGet<{ items: TecnicoSemWorkspace[]; total: number; contagem: ContagemWorkspaces }>(
    "/technicians/funil",
    () => ({
      items: [], total: 0,
      contagem: { total: 0, comWorkspace: 0, aEspera: 0, bloqueados: 0, perfilCompleto: 0, podemAceitar: 0, soFaltaAT: 0, contactoPorVerificar: 0,
        degraus: { semContacto: 0, semContactoRecentes: 0, documentosPorAprovar: 0, semIban: 0, semMoradaFiscal: 0, semAT: 0, nadaEmFalta: 0, desconhecido: 0 } },
    }),
  ).then((r) => r.data);
}

export async function createVendorInvoiceWorkspace(id: number): Promise<RealVendor> {
  return apiPost<RealVendor>(`/technicians/${id}/invoice-workspace`, {}, () => {
    throw new Error("Criar o workspace de faturação precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
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

/* --------------------- Onboarding: o funil de quem se inscreveu -------------------- */

/**
 * Substitui o ecrã de Recrutamento, que mostrava candidatos e entrevistas
 * inventados. Sem mock: um funil vazio de mentira daria a entender que está
 * tudo em ordem quando há centenas de técnicos parados.
 */
export type { Funil, TecnicoNoFunil, Etapa } from "@/lib/onboardingTecnicos";
import type { Funil as FunilDTO } from "@/lib/onboardingTecnicos";

export async function getOnboardingTecnicos(): Promise<FunilDTO> {
  return apiGet<FunilDTO>("/technicians/onboarding", () => {
    throw new Error("O funil de técnicos precisa da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
