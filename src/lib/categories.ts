import { DEFAULT_SETTINGS } from "@/config/dashboard";

/** Normaliza para comparação: sem acentos, minúsculas, espaços colapsados. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Resolve o que o cliente escolheu no formulário da landing (nome, slug ou id da
 * categoria, com ou sem acentos) para o **id canónico** de `DEFAULT_SETTINGS`.
 * Devolve "" quando nada corresponde (a categoria fica por preencher, para a
 * equipa escolher à mão — melhor do que guardar lixo).
 */
export function resolveCategoryId(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const n = norm(raw);
  if (!n) return "";

  // 1) Correspondência exata por id, slug ou nome.
  for (const c of DEFAULT_SETTINGS.categories) {
    if (norm(c.id) === n || norm(c.slug) === n || norm(c.name) === n) return c.id;
  }
  // 2) Fallback tolerante: o texto contém o nome ou o slug da categoria
  //    (ex.: "Canalização e água" → Canalização). Nome antes do slug por ser
  //    mais distinto, e slug só a partir de 4 letras para evitar falsos AVAC.
  for (const c of DEFAULT_SETTINGS.categories) {
    if (n.includes(norm(c.name))) return c.id;
  }
  for (const c of DEFAULT_SETTINGS.categories) {
    if (c.slug.length >= 4 && n.includes(norm(c.slug))) return c.id;
  }
  return "";
}

/** Nome legível de uma categoria a partir do id canónico ("" se desconhecido). */
export function categoryName(id: string): string {
  return DEFAULT_SETTINGS.categories.find((c) => c.id === id)?.name ?? "";
}

/**
 * Deriva a categoria a partir da mensagem da lead, quando não veio no campo
 * próprio. O formulário da landing escreve "Serviço: <categoria> · Urgência: …",
 * por isso a categoria já lá está mesmo sem o campo `category` — extrai-se o
 * "Serviço: X" e resolve-se para o id canónico ("" se não corresponder).
 */
export function categoryFromMessage(message: string | null | undefined): string {
  if (!message) return "";
  const m = message.match(/servi[çc]o:\s*([^·\n]+)/i);
  return m ? resolveCategoryId(m[1]) : "";
}
