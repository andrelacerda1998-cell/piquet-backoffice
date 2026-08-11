import { apiGet } from "./api";
import type { PaginatedResult } from "@/types";

/**
 * Códigos SMS — migrado do Filament (SmsCodeResource) para a API de admin do
 * Laravel. Só leitura: usado pelo suporte para confirmar que código foi
 * enviado a um número (ex: "não recebi o SMS"). Ver src/lib/laravelAdmin.ts
 * e src/app/api/sms-codes/route.ts.
 *
 * Nota: um código já não aparece aqui assim que é validado com sucesso
 * (é apagado da tabela, ver PhoneLoginSmsService::verifyCode() no backend) —
 * o que fica é o histórico de códigos emitidos até serem consumidos.
 */
export interface SmsCode {
  id: string;
  phone_number: string | null;
  code: string;
  type: string;
  user: { id: number; name: string } | null;
  created_at: string | null;
}

interface SmsCodesApiData {
  items: SmsCode[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface SmsCodeFilters {
  search?: string;
  type?: string;
}

export async function getSmsCodes(
  page = 1,
  pageSize = 20,
  filters: SmsCodeFilters = {}
): Promise<PaginatedResult<SmsCode>> {
  const raw = await apiGet<SmsCodesApiData>(
    "/sms-codes",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: pageSize, total: 0 } }),
    {
      page,
      per_page: pageSize,
      search: filters.search,
      type: filters.type,
    }
  ).then((r) => r.data);

  return {
    data: raw.items,
    total: raw.meta.total,
    page: raw.meta.current_page,
    pageSize: raw.meta.per_page,
    totalPages: raw.meta.last_page,
  };
}
