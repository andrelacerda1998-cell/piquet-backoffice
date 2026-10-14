/**
 * Técnicos contados pelas cidades que cada um escolhe na app — a regra com que
 * o matching distribui os pedidos (no backend, CoberturaPelasCidades).
 *
 * Uma zona é uma cidade, não uma morada: conta-se quem recebe um pedido no
 * centro dela. O backend diz em cada número como o contou (`contagem`):
 *
 *  - "raio": a cidade tem coordenadas; vale o raio das cidades de cada técnico;
 *  - "nome": ainda sem coordenadas (falta o cities:geocode no servidor); só
 *    conta quem escolheu uma cidade com o mesmo nome, e quem escolheu uma
 *    vizinha pode receber pedidos daqui sem aparecer;
 *  - "fora_do_catalogo": a cidade não está no catálogo da app. Nenhum técnico
 *    a pode escolher e não há centro para medir: o zero não quer dizer nada.
 *
 * Quem não escolheu cidade nenhuma não entra em zona nenhuma (no matching não
 * tem restrição, recebe de qualquer zona) e vem à parte, em `sem_cidades`.
 */
export type ContagemPelasCidades = "raio" | "nome" | "fora_do_catalogo";

export interface SemCidades {
  tecnicos: number;
  podem_trabalhar: number;
}

/** Sem centro para medir, o número não se mostra: "por medir" em vez de um zero. */
export function porMedir(contagem: ContagemPelasCidades | undefined): boolean {
  return contagem === "fora_do_catalogo";
}

/** A etiqueta para pôr ao lado do número, e porquê. Null quando não precisa. */
export function notaDaContagem(contagem: ContagemPelasCidades | undefined): { texto: string; explicacao: string } | null {
  if (contagem === "nome") {
    return {
      texto: "pelo nome",
      explicacao: "Esta cidade ainda não tem coordenadas: só conta quem a escolheu com este nome. Quem escolheu uma cidade vizinha pode receber pedidos daqui e não aparece.",
    };
  }
  if (contagem === "fora_do_catalogo") {
    return {
      texto: "fora do catálogo",
      explicacao: "Esta cidade não está no catálogo da app: nenhum técnico a pode escolher, e sem o centro dela não dá para contar quem a cobre.",
    };
  }
  return null;
}

/**
 * As frases do rodapé: quantas linhas não foram contadas pelo raio, e porquê.
 * `nomes` é a palavra para cada linha ("zona"/"zonas", "cidade"/"cidades").
 */
export function resumoDasContagens(
  contagens: Array<ContagemPelasCidades | undefined>,
  nomes: { um: string; varios: string },
): string[] {
  const peloNome = contagens.filter((c) => c === "nome").length;
  const fora = contagens.filter((c) => c === "fora_do_catalogo").length;
  const frases: string[] = [];

  if (peloNome > 0) {
    frases.push(peloNome === 1
      ? `1 ${nomes.um} contada só pelo nome: a cidade ainda não tem coordenadas (falta o cities:geocode no servidor), e quem escolheu uma cidade vizinha não aparece.`
      : `${peloNome} ${nomes.varios} contadas só pelo nome: as cidades ainda não têm coordenadas (falta o cities:geocode no servidor), e quem escolheu uma cidade vizinha não aparece.`);
  }
  if (fora > 0) {
    frases.push(fora === 1
      ? `1 ${nomes.um} por medir: não está no catálogo de cidades da app, e nenhum técnico a pode escolher.`
      : `${fora} ${nomes.varios} por medir: não estão no catálogo de cidades da app, e nenhum técnico as pode escolher.`);
  }

  return frases;
}
