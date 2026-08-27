/**
 * Regras "puras" do WhatsApp — sem segredos nem rede, para poderem ser testadas
 * e usadas de qualquer lado. O envio em si vive em `whatsapp.ts` (server-only).
 */

/** A janela de resposta livre da Meta: 24 horas desde a última entrada. */
export const JANELA_RESPOSTA_MS = 24 * 60 * 60 * 1000;

/**
 * Ainda se pode responder em texto livre? `true` só se a última mensagem do
 * cliente foi há menos de 24h. Sem nenhuma entrada, `false` — nunca houve
 * conversa a que responder.
 */
export function dentroDaJanela(ultimaEntradaIso: string | null, agoraMs: number): boolean {
  if (!ultimaEntradaIso) return false;
  const t = Date.parse(ultimaEntradaIso);
  if (Number.isNaN(t)) return false;
  return agoraMs - t < JANELA_RESPOSTA_MS;
}

/**
 * Normaliza um telefone para o formato que a Meta exige: só dígitos, com
 * indicativo. Um número português local (9 dígitos) recebe o 351.
 */
export function normalizarTelefone(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 9 ? `351${d}` : d;
}
