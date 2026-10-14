import { apiGet } from "./api";
import type { ContagemPelasCidades, SemCidades } from "@/lib/pelasCidades";

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

/** Um técnico das cidades escolhidas na app, e se já pode trabalhar. */
export interface CoverageTechnicianNasCidades extends CoverageTechnician {
  podem_trabalhar: boolean;
}

export interface CoverageOpenZone {
  id: number;
  city: string;
  district: string | null;
  /** Quem marcou a zona no questionário antigo. */
  technicians: CoverageTechnician[];
  /**
   * Quem recebe um pedido no centro da zona, pelas cidades que escolheu na
   * app: os que já podem trabalhar primeiro. Só vem do backend a partir do
   * backend#185.
   */
  nas_cidades?: {
    tecnicos: CoverageTechnicianNasCidades[];
    podem_trabalhar: number;
    contagem: ContagemPelasCidades;
  };
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
  /** Quem não escolheu cidades: no matching recebe de qualquer zona (backend#185). */
  sem_cidades?: SemCidades;
}

export async function getCoverage(): Promise<CoverageData> {
  return apiGet<CoverageData>("/coverage", () => ({ open: [], candidate: [] })).then((r) => r.data);
}
