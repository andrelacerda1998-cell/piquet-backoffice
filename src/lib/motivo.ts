/**
 * O motivo obrigatório das ações registadas (bloquear, suspender…). Serve se
 * disser alguma coisa: pelo menos 5 letras depois de aparado; os espaços
 * arrumam-se e corta-se em 500.
 */
export const MOTIVO_MINIMO = 5;

export function motivoValido(motivo: unknown): string | null {
  if (typeof motivo !== "string") return null;
  const m = motivo.trim().replace(/\s+/g, " ");
  return m.length >= MOTIVO_MINIMO ? m.slice(0, 500) : null;
}
