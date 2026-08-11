import { apiGet } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import type { PaginatedResult, SortParams, Technician } from "@/types";

/**
 * Lista fictícia de técnicos (forma rica: categorias, cidade, avaliação,
 * receita, ...) -- ainda usada por src/app/(dashboard)/servicos-
 * personalizados/page.tsx (escolher técnico para um pedido personalizado) e
 * src/app/(dashboard)/qualidade/page.tsx (técnicos com avaliação baixa), que
 * não foram migradas nesta fatia.
 *
 * Endpoint deliberadamente DIFERENTE de "/technicians": esse passou a ser a
 * lista real de vendors (App\Http\Controllers\Api\Admin\VendorController,
 * ver vendorsService.ts), com uma forma completamente diferente (sem
 * categorias/cidade/avaliação/receita). Reutilizar o mesmo endpoint faria
 * este fetcher mock nunca correr em produção (isLiveEndpoint despacha para o
 * Laravel) e as duas páginas acima receberiam dados na forma errada.
 */
export async function getTechnicians(
  page = 1,
  pageSize = 20,
  sort?: SortParams,
  search?: string,
  status?: string
): Promise<PaginatedResult<Technician>> {
  return apiGet(
    "/technicians/legacy-mock",
    () => {
      let items = [...mockData.technicians];
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((t) => t.name.toLowerCase().includes(q) || t.categories.some((c) => c.toLowerCase().includes(q)));
      }
      if (status) items = items.filter((t) => t.status === status);
      if (sort) items = sortArray(items, sort.field as keyof Technician, sort.direction);
      return paginateArray(items, page, pageSize);
    },
    { page, pageSize, search, status, sort: sort?.field, dir: sort?.direction }
  ).then((r) => r.data);
}

// getTechnicianMetrics/getTechniciansByCategory/getTechniciansByLocation/
// getTopTechnicians/getCoverageVsDemand foram removidas (2026-07-29): eram
// só usadas pela aba "Visão geral" de src/app/(dashboard)/tecnicos/page.tsx,
// que passou a usar os equivalentes reais em vendorsService.ts
// (getVendorMetrics/getVendorsByCategory/getVendorsByLocation/getTopVendors/
// getVendorCoverage). Nenhum outro ficheiro as importava.

export type DocStatus = "verificado" | "submetido" | "em_falta";
export interface TechDocument { name: string; status: DocStatus }
export interface PendingTechnician {
  id: string;
  name: string;
  email: string;
  phone: string;
  categories: string[];
  specializations: string[];
  city: string;
  status: string;
  documentationComplete: boolean;
  registeredAt: string;
  documents: TechDocument[];
}

export const REQUIRED_DOCS = [
  "Cartão de cidadão",
  "NIF",
  "IBAN",
  "Seguro de responsabilidade civil",
  "Certificado profissional",
  "Registo criminal",
];

export async function getPendingTechnicians(limit = 12): Promise<PendingTechnician[]> {
  return apiGet("/technicians/pending", () => {
    return mockData.technicians
      .filter((t) => ["em_validacao", "perfil_incompleto", "registado"].includes(t.status))
      .slice(0, limit)
      .map((t, i) => {
        const documents: TechDocument[] = REQUIRED_DOCS.map((name, di) => {
          if (t.documentationComplete) return { name, status: "verificado" as DocStatus };
          const roll = (i + di) % 3;
          return { name, status: (roll === 0 ? "em_falta" : roll === 1 ? "submetido" : "verificado") as DocStatus };
        });
        return {
          id: t.id,
          name: t.name,
          email: t.email,
          phone: t.phone,
          categories: t.categories,
          specializations: t.specializations,
          city: t.city,
          status: t.status,
          documentationComplete: t.documentationComplete,
          registeredAt: t.registeredAt,
          documents,
        };
      });
  }).then((r) => r.data);
}
