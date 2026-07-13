import { apiGet } from "./api";
import { mockData } from "@/mocks/data";
import { paginateArray, sortArray } from "@/lib/filters";
import type { PaginatedResult, SortParams, Technician } from "@/types";

export async function getTechnicians(
  page = 1,
  pageSize = 20,
  sort?: SortParams,
  search?: string,
  status?: string
): Promise<PaginatedResult<Technician>> {
  return apiGet(
    "/technicians",
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

export async function getTechnicianMetrics() {
  return apiGet("/technicians/metrics", () => {
    const techs = mockData.technicians;
    const approved = techs.filter((t) => ["aprovado", "disponivel", "ativo"].includes(t.status));
    const active = techs.filter((t) => t.status === "ativo");
    const inValidation = techs.filter((t) => t.status === "em_validacao");
    const _incomplete = techs.filter((t) => t.status === "perfil_incompleto");
    const suspended = techs.filter((t) => t.status === "suspenso");
    const noServices = techs.filter((t) => t.servicesCompleted === 0 && approved.includes(t));
    const docComplete = techs.filter((t) => t.documentationComplete);

    return {
      registered: techs.length,
      docComplete: docComplete.length,
      inValidation: inValidation.length,
      approved: approved.length,
      available: techs.filter((t) => (t.status as string) === "disponivel").length,
      active: active.length,
      noServices: noServices.length,
      suspended: suspended.length,
      profileCompletionRate: techs.length ? (docComplete.length / techs.length) * 100 : 0,
      approvalRate: techs.length ? (approved.length / techs.length) * 100 : 0,
      avgApprovalTime: 4.2,
      avgTimeToFirstService: 12,
    };
  }).then((r) => r.data);
}

export async function getTechniciansByCategory() {
  return apiGet("/technicians/by-category", () => {
    const byCat: Record<string, number> = {};
    mockData.technicians.forEach((t) => {
      t.categories.forEach((c) => {
        byCat[c] = (byCat[c] ?? 0) + 1;
      });
    });
    return Object.entries(byCat).map(([name, value]) => ({ name, value }));
  }).then((r) => r.data);
}

export async function getTechniciansByLocation() {
  return apiGet("/technicians/by-location", () => {
    const byCity: Record<string, number> = {};
    mockData.technicians.forEach((t) => {
      byCity[t.city] = (byCity[t.city] ?? 0) + 1;
    });
    return Object.entries(byCity).map(([name, value]) => ({ name, value }));
  }).then((r) => r.data);
}

export async function getTopTechnicians(limit = 10) {
  return apiGet("/technicians/top", () => {
    return [...mockData.technicians]
      .filter((t) => t.servicesCompleted > 0)
      .sort((a, b) => b.piquetRevenue - a.piquetRevenue)
      .slice(0, limit);
  }).then((r) => r.data);
}

export async function getCoverageVsDemand() {
  return apiGet("/technicians/coverage", () => {
    const cities = ["Lisboa", "Amadora", "Loures", "Odivelas", "Sintra", "Cascais"];
    return cities.map((city) => {
      const demand = mockData.services.filter((s) => s.city === city).length;
      const supply = mockData.technicians.filter((t) => t.city === city && ["aprovado", "ativo", "disponivel"].includes(t.status)).length;
      return { name: city, procura: demand, oferta: supply, ratio: supply ? demand / supply : demand };
    });
  }).then((r) => r.data);
}

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

const REQUIRED_DOCS = [
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
