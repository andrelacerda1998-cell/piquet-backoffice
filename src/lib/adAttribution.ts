/**
 * A que app pertence o investimento de cada campanha.
 *
 * Os nomes reais das campanhas dizem-no ("… Clientes - Download App Android",
 * "… Técnicos - Download App Android", "[PIQUET APP] - [ALCANCE] - App
 * clientes"). O que não identifica app — tráfego para o site, notoriedade,
 * landing pages — fica em `geral`: não se deve dividir por apps um euro que não
 * foi gasto a promover nenhuma delas em concreto.
 */
export type AdTarget = "cliente" | "profissional" | "geral";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function campaignTarget(campaignName: string | null | undefined): AdTarget {
  const n = norm(campaignName ?? "");
  if (!n) return "geral";
  // Técnicos primeiro: "app vendor"/"técnicos" é mais específico e algumas
  // campanhas mencionam ambos ("app clientes e técnicos" não existe hoje, mas
  // se aparecer, o alvo mais restrito ganha).
  if (/\btecnic|\bvendor|profissional|prestador/.test(n)) return "profissional";
  if (/\bcliente/.test(n)) return "cliente";
  return "geral";
}

/** Custo por download: só faz sentido com investimento atribuído E downloads. */
export function costPerDownload(spend: number, downloads: number): number | null {
  if (!(downloads > 0) || !(spend > 0)) return null;
  return spend / downloads;
}
