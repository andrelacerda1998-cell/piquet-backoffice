import { apiGet } from "./api";
import type { PessoaDaEquipa } from "@/app/api/staff/route";

export type { PessoaDaEquipa };

/** Quem tem acesso ao backoffice (tabela `staff` do Supabase). */
export async function getEquipa(): Promise<PessoaDaEquipa[]> {
  return apiGet<PessoaDaEquipa[]>("/staff", () => []).then((r) => r.data);
}
