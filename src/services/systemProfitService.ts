import { apiGet } from "./api";

/**
 * Lucro do sistema — migrado do Filament (Pages\SystemProfit + widget
 * WalletStats) para a API de admin do Laravel. Ver src/lib/laravelAdmin.ts
 * e src/app/api/system-profit/route.ts.
 */
export interface SystemProfitTransaction {
  id: number;
  type: string;
  description_key: string | null;
  admin_id: number | null;
  admin_name: string | null;
  amount: number;
  created_at: string | null;
}

export interface SystemProfitData {
  wallet_balance: number;
  items: SystemProfitTransaction[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface SystemProfitFilters {
  page?: number;
  per_page?: number;
  from?: string;
  to?: string;
}

export async function getSystemProfit(filters: SystemProfitFilters = {}): Promise<SystemProfitData> {
  return apiGet<SystemProfitData>(
    "/system-profit",
    () => ({
      wallet_balance: 0,
      items: [],
      meta: { current_page: 1, last_page: 1, per_page: filters.per_page ?? 20, total: 0 },
    }),
    { page: filters.page ?? 1, per_page: filters.per_page ?? 20, from: filters.from, to: filters.to }
  ).then((r) => r.data);
}
