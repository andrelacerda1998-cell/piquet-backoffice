import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { fone9 } from "@/lib/telefone";

/**
 * Uma cópia local de quem são os técnicos: nome, telefone e ofício.
 *
 * Os técnicos vivem no Laravel, e o token para lá chegar só existe no
 * servidor. Esta cópia é o que permite responder a perguntas sobre a rede sem
 * uma chamada externa no caminho -- por exemplo "quem faz canalização", para
 * falar com um grupo de técnicos de uma vez.
 *
 * Nasceu para o webhook do WhatsApp distinguir técnicos de clientes. Esse
 * webhook saiu com a Cloud API (18/09/2026); o que ficou foi a cópia, que é
 * útil por si.
 */

interface VendorMinimo {
  id: number;
  name: string | null;
  phone_number: string | null;
  /*
    O que o técnico faz. São dois campos porque o Laravel tem dois:

    - `services_types` é o que o matching usa (VendorRankingService filtra por
      ele). É a resposta certa a "o que é que este técnico faz".
    - `operation_areas` também guarda nomes de ofícios, apesar do nome sugerir
      zonas -- e o nome já levou a ordenar técnicos por cidade contra ele, uma
      ordenação que não fazia nada. Está quase sempre vazio: numa leitura de
      100 técnicos a 18/09/2026, um único tinha valor.

    Fica o primeiro, e o segundo só quando o primeiro não diz nada -- assim não
    se perde o pouco que lá está, sem misturar as duas fontes quando ambas
    respondem.
  */
  services_types?: string[] | null;
  operation_areas?: string[] | null;
}

const limpar = (v: string[] | null | undefined) =>
  (v ?? []).map((t) => (t ?? "").trim()).filter(Boolean);

/** O que o técnico faz, preferindo o campo que o matching usa. */
function oficios(v: VendorMinimo): string[] {
  const doMatching = limpar(v.services_types);
  return doMatching.length > 0 ? doMatching : limpar(v.operation_areas);
}

interface ServicoDoCatalogo {
  name: string | null;
  /** A categoria a que o serviço pertence ("CANALIZAÇÃO", "LIMPEZAS", ...). */
  operation_area_name?: string | null;
}

/**
 * O catálogo: que categoria tem cada serviço.
 *
 * Existe porque `services_types` são SERVIÇOS ("Montar Cama de Solteiro"), e
 * são mais de 150. Para falar com a rede o nível útil é a categoria, e a
 * ligação entre os dois só existe do lado do Laravel.
 *
 * Devolve um mapa vazio se a leitura falhar: perde-se a categoria, não a
 * sincronização -- os telefones e os serviços continuam a ser guardados.
 */
async function catalogoPorServico(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  try {
    let pagina = 1;
    let ultima = 1;
    do {
      const r = await laravelAdminRequest<{
        items: ServicoDoCatalogo[];
        meta?: { last_page?: number };
      }>(`/v1/admin/services-types?per_page=100&page=${pagina}`);
      const itens = r.items ?? [];
      for (const t of itens) {
        const servico = (t.name ?? "").trim();
        const categoria = (t.operation_area_name ?? "").trim();
        if (servico && categoria) mapa.set(servico.toLowerCase(), categoria);
      }
      ultima = r.meta?.last_page ?? (itens.length === 100 ? pagina + 1 : pagina);
      pagina++;
    } while (pagina <= ultima && pagina <= 50);
  } catch {
    /* sem catálogo não há categoria -- mas o resto da sincronização vale. */
  }
  return mapa;
}

interface PaginaVendors {
  items: VendorMinimo[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

/**
 * Actualiza a cópia local a partir do Laravel. Devolve quantos números ficaram
 * conhecidos, ou lança quando o Laravel não responde.
 *
 * Idempotente: é um upsert por número, pode correr as vezes que forem precisas.
 *
 * PAGINA. Pedia-se `per_page=1000` e recebiam-se 100, porque o controlador do
 * Laravel faz `min($perPage, 100)` -- líamos a primeira página e tratávamos o
 * resultado como se fosse a rede toda. Quem estivesse na página 2 não existia
 * para o backoffice.
 */
export async function sincronizarTelefonesTecnicos(): Promise<{ guardados: number; semTelefone: number; removidos: number }> {
  const todos: VendorMinimo[] = [];
  let pagina = 1;
  let ultima = 1;

  do {
    const r = await laravelAdminRequest<PaginaVendors>(
      `/v1/admin/vendors?per_page=100&page=${pagina}`,
    );
    const itens = r.items ?? [];
    todos.push(...itens);
    ultima = r.meta?.last_page ?? pagina;
    /*
      Sem `meta` não se sabe quantas páginas há. Uma página cheia sugere que
      vem mais; uma página incompleta é o fim. Parar aqui, em vez de assumir
      que acabou, é o que evita voltar ao problema de só ler os primeiros 100.
    */
    if (r.meta?.last_page == null) ultima = itens.length === 100 ? pagina + 1 : pagina;
    pagina++;
  } while (pagina <= ultima && pagina <= 50); // trava de segurança: 5000 técnicos

  return guardarTelefonesTecnicos(todos, await catalogoPorServico());
}

/** Guarda uma lista de técnicos já lida. */
export async function guardarTelefonesTecnicos(
  vendors: VendorMinimo[],
  catalogo: Map<string, string> = new Map(),
): Promise<{ guardados: number; semTelefone: number; removidos: number }> {
  /*
    Uma marca de tempo só, igual em todas as linhas desta corrida.

    É ela que separa "visto agora" de "já não existe lá": as linhas que ficarem
    com um `updated_at` anterior a esta são de técnicos que desapareceram do
    Laravel. Gerar a data linha a linha dava valores ligeiramente diferentes e
    tornava essa comparação instável.
  */
  const agora = new Date().toISOString();

  const linhas = vendors
    .map((v) => {
      const trades = oficios(v);
      /*
        A categoria de cada serviço, sem repetir. Um serviço que não esteja no
        catálogo simplesmente não contribui -- é melhor do que inventar uma
        categoria a partir do nome.
      */
      const categorias = [...new Set(
        trades.map((t) => catalogo.get(t.toLowerCase())).filter((c): c is string => Boolean(c)),
      )].sort();
      return {
        phone9: fone9(v.phone_number || ""),
        technician_id: String(v.id),
        name: v.name || "",
        trades,
        categories: categorias,
        updated_at: agora,
      };
    })
    .filter((l) => l.phone9.length === 9);

  /*
    Lista vazia NÃO é motivo para limpar nada.

    Se o Laravel devolver zero -- por um erro que não lançou, por um filtro que
    mudou, por uma migração a meio -- apagar aqui deitava fora a rede inteira a
    partir de uma resposta que provavelmente está errada. Não guardar nada é
    recuperável na corrida seguinte; apagar tudo não é.
  */
  if (linhas.length === 0) {
    return { guardados: 0, semTelefone: vendors.length, removidos: 0 };
  }

  const { error } = await supabaseAdmin()
    .from("technician_phones")
    .upsert(linhas, { onConflict: "phone9" });
  if (error) throw new Error(error.message);

  /*
    Quem já não está lá, sai daqui.

    Era um upsert puro: actualizava quem existe, acrescentava quem é novo, e
    nunca esquecia ninguém. Um técnico apagado em definitivo no Laravel ficava
    nesta cópia para sempre -- e daqui saem os contactos, as contagens por
    ofício e os ficheiros que se exportam. Contactar alguém que já não pertence
    à rede é pior do que não o ter na lista.

    Só se chega aqui depois de uma leitura completa: se qualquer página falhar,
    `sincronizarTelefonesTecnicos` lança e nunca se apaga nada.
  */
  const { data: apagados, error: erroApagar } = await supabaseAdmin()
    .from("technician_phones")
    .delete()
    .lt("updated_at", agora)
    .select("phone9");
  if (erroApagar) throw new Error(erroApagar.message);

  return {
    guardados: linhas.length,
    semTelefone: vendors.length - linhas.length,
    removidos: (apagados ?? []).length,
  };

}
