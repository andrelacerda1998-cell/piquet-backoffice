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
/*
  Como o cliente chama, e como o catálogo chama.

  O formulário da landing oferece "Montagem de Móveis"; o catálogo diz
  "Montagem de mobiliário". São a mesma coisa, mas nenhuma contém a outra, e
  por isso a categoria ficava vazia -- e sem categoria o painel de técnicos não
  consegue filtrar por ofício e mostra a rede toda.

  As palavras do cliente não se mudam para caberem no catálogo: mudar o texto
  do formulário para "mobiliário" era resolver do lado errado. Traduz-se aqui.

  "Decoração", "Eletrodomésticos" e "Home appliances" também chegam do
  formulário e não têm categoria nenhuma no catálogo -- ficam de fora de
  propósito, porque criar categorias é decisão de negócio (mexe em comissões e
  na qualificação dos técnicos no Laravel), não de uma tabela de sinónimos.
*/
const SINONIMOS: Record<string, string> = {
  "montagem de moveis": "cat_mobiliario",
  "montagem moveis": "cat_mobiliario",
  moveis: "cat_mobiliario",
  mobiliario: "cat_mobiliario",
  "limpeza domestica": "cat_limpeza",
  "fechaduras e portas": "cat_fechaduras",
  "portas e fechaduras": "cat_fechaduras",
  emergencia: "cat_emergencia",
  urgencia: "cat_emergencia",
  agua: "cat_canalizacao",
  canalizador: "cat_canalizacao",
  eletricista: "cat_eletricidade",
  "ar condicionado": "cat_avac",
  climatizacao: "cat_avac",
};

export function resolveCategoryId(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const n = norm(raw);
  if (!n) return "";

  // 1) Correspondência exata por id, slug ou nome.
  for (const c of DEFAULT_SETTINGS.categories) {
    if (norm(c.id) === n || norm(c.slug) === n || norm(c.name) === n) return c.id;
  }
  // 2) Como o cliente chama à mesma coisa. Antes das correspondências
  //    tolerantes: é uma equivalência conhecida, não um palpite.
  if (SINONIMOS[n]) return SINONIMOS[n];
  for (const [termo, id] of Object.entries(SINONIMOS)) {
    if (termo.includes(" ") && n.includes(termo)) return id;
  }
  // 3) Fallback tolerante: o texto contém o nome ou o slug da categoria
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
