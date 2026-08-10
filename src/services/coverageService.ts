import { apiGet } from "./api";

/**
 * Cobertura geográfica por técnico — não tem equivalente no Filament (lá só
 * existia cidade a cidade, sem vista agregada). Junta os dois sinais que a
 * própria app do técnico já escreve (POST /vendor/survey/vote):
 *
 * - `open`: zonas onde a Piquet já está aberta, com os técnicos que
 *   declararam que atuam lá (cobertura real).
 * - `candidate`: cidades ainda fechadas onde técnicos manifestaram interesse
 *   (sinal de procura para decidir onde abrir a seguir).
 *
 * Ver src/lib/laravelAdmin.ts e App\Http\Controllers\Api\Admin\CoverageController
 * no backend.
 */
export interface CoverageTechnician {
  id: number;
  name: string | null;
  nif: string | null;
  email: string | null;
  phone_number: string | null;
  status: string | null;
}

export interface CoverageOpenZone {
  id: number;
  city: string;
  district: string | null;
  technicians: CoverageTechnician[];
}

export interface CoverageCandidateCity {
  id: number;
  city: string;
  district: string | null;
  active: boolean;
  technicians: CoverageTechnician[];
}

export interface CoverageData {
  open: CoverageOpenZone[];
  candidate: CoverageCandidateCity[];
}

export async function getCoverage(): Promise<CoverageData> {
  return apiGet<CoverageData>("/coverage", () => ({ open: [], candidate: [] })).then((r) => r.data);
}
