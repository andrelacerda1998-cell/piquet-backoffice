import { apiGet, apiPut } from "./api";

/**
 * Definições de taxas — migrado do Filament (Pages\FeeSettings, uma
 * SettingsPage sobre App\Settings\RateSettings) para a API de admin do
 * Laravel. Ver src/lib/laravelAdmin.ts e src/app/api/fee-settings/route.ts.
 *
 * daytime/evening/night/late_night/midnight são multiplicadores (%) da
 * tarifa base por período do dia — não são percentagens limitadas a 100,
 * espelha exatamente o formulário do Filament (sem limite superior).
 * kilometer_price vem em euros (o Laravel converte de/para cêntimos).
 */
export interface FeeSettings {
  daytime: number;
  evening: number;
  night: number;
  late_night: number;
  midnight: number;
  kilometer_price: number;
  system_commission: number;
}

const EMPTY_FEE_SETTINGS: FeeSettings = {
  daytime: 0,
  evening: 0,
  night: 0,
  late_night: 0,
  midnight: 0,
  kilometer_price: 0,
  system_commission: 0,
};

export async function getFeeSettings(): Promise<FeeSettings> {
  // Fetcher mock só corre em modo demo puro (sem NEXT_PUBLIC_API_URL) — devolve
  // zeros em vez de rebentar o ecrã, tal como o resto do modo demo.
  return apiGet<FeeSettings>("/fee-settings", () => EMPTY_FEE_SETTINGS).then((r) => r.data);
}

export async function updateFeeSettings(patch: FeeSettings): Promise<FeeSettings> {
  return apiPut<FeeSettings>("/fee-settings", patch, () => {
    throw new Error("Definições de taxas precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
