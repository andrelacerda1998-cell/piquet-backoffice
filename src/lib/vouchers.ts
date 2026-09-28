/**
 * Vouchers: a forma que o ecrã usa, e as regras que o Laravel aplica.
 *
 * Vive aqui, e não no ficheiro da rota, porque é código puro — traduzir e
 * validar não precisa de servidor, e a rota importa `server-only` (pelo
 * cliente do Laravel), o que impedia testá-lo.
 */

/** Como o Laravel devolve cada voucher (ver Api\\Admin\\VoucherController::present). */
export interface VoucherLaravel {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  max_uses: number | null;
  discount_percentage: number;
  valid_services: string[];
  is_active: boolean;
  is_valid: boolean;
  usages_count: number;
  /** Só a partir do PR dos totais; antes disso vem `undefined`. */
  services_count?: number;
  /** EM CÊNTIMOS — ver o comentário no presenter do Laravel. */
  discount_total_cents?: number;
  created_at?: string | null;
}

export interface Voucher {
  id: string;
  /** É o código que o cliente escreve na app. */
  name: string;
  discountPercentage: number;
  startDate: string | null;
  endDate: string | null;
  /**
   * Limite de utilizações POR CLIENTE, não no total — é assim que o Laravel o
   * aplica (`Voucher::canBeUsedBy` conta os usos daquele utilizador). `null` =
   * sem limite.
   */
  maxUsesPerCustomer: number | null;
  /** "scheduled" (agendados) e/ou "immediate" (imediatos). */
  validServices: string[];
  active: boolean;
  /** Ativo E dentro das datas — é isto que decide se funciona hoje. */
  usableToday: boolean;
  usagesCount: number;
  /** `null` enquanto o backend não expuser os totais. */
  servicesCount: number | null;
  /** Desconto já dado, em EUROS. `null` enquanto o backend não o expuser. */
  discountGiven: number | null;
  createdAt: string | null;
}

export function toVoucher(v: VoucherLaravel): Voucher {
  return {
    id: String(v.id),
    name: v.name,
    discountPercentage: Number(v.discount_percentage) || 0,
    startDate: v.start_date,
    endDate: v.end_date,
    maxUsesPerCustomer: v.max_uses,
    validServices: Array.isArray(v.valid_services) ? v.valid_services : [],
    active: Boolean(v.is_active),
    usableToday: Boolean(v.is_valid),
    usagesCount: Number(v.usages_count) || 0,
    servicesCount: v.services_count == null ? null : Number(v.services_count),
    // Cêntimos → euros. O nome do campo do Laravel diz a unidade de propósito.
    discountGiven: v.discount_total_cents == null ? null : Number(v.discount_total_cents) / 100,
    createdAt: v.created_at ?? null,
  };
}

export interface NovoVoucher {
  name: string;
  discountPercentage: number;
  startDate?: string | null;
  endDate?: string | null;
  maxUsesPerCustomer?: number | null;
  validServices: string[];
  active?: boolean;
}

/** Traduz para o que o Laravel espera; só envia o que foi mexido. */
export function paraLaravel(v: Partial<NovoVoucher>): Record<string, unknown> {
  const corpo: Record<string, unknown> = {};
  if (v.name !== undefined) corpo.name = v.name.trim();
  if (v.discountPercentage !== undefined) corpo.discount_percentage = v.discountPercentage;
  if (v.startDate !== undefined) corpo.start_date = v.startDate || null;
  if (v.endDate !== undefined) corpo.end_date = v.endDate || null;
  if (v.maxUsesPerCustomer !== undefined) corpo.max_uses = v.maxUsesPerCustomer || null;
  if (v.validServices !== undefined) corpo.valid_services = v.validServices;
  if (v.active !== undefined) corpo.is_active = v.active;
  return corpo;
}

/** Devolve a primeira queixa, ou `null` se está tudo bem. */
export function queixaDe(v: Partial<NovoVoucher>, aCriar: boolean): string | null {
  if (aCriar || v.name !== undefined) {
    const nome = v.name?.trim() ?? "";
    if (!nome) return "O código é obrigatório.";
    // A coluna é VARCHAR(30): acima disso o Laravel devolve 422.
    if (nome.length > 30) return "O código não pode ter mais de 30 caracteres.";
  }
  if (aCriar || v.discountPercentage !== undefined) {
    const p = Number(v.discountPercentage);
    if (!Number.isFinite(p) || p < 1 || p > 100) return "O desconto tem de estar entre 1% e 100%.";
  }
  if (aCriar || v.validServices !== undefined) {
    const s = v.validServices ?? [];
    if (s.length === 0) return "Escolhe pelo menos um tipo de serviço.";
    if (s.some((x) => x !== "scheduled" && x !== "immediate")) return "Tipo de serviço desconhecido.";
  }
  if (v.startDate && v.endDate && v.endDate <= v.startDate) {
    return "A data de fim tem de ser posterior à de início.";
  }
  if (v.maxUsesPerCustomer != null && v.maxUsesPerCustomer < 1) {
    return "O limite por cliente tem de ser pelo menos 1.";
  }
  return null;
}
