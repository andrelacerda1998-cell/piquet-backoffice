/**
 * O que está à espera de alguém, e o que disso é NOVO.
 *
 * A parte difícil de avisar não é encontrar o que está pendente — é não
 * repetir. Um aviso que chega de quinze em quinze minutos a dizer a mesma
 * coisa é desligado ao fim de uma hora, e depois já não avisa de nada.
 *
 * Por isso guarda-se o que já foi avisado e só se avisa do que entrou desde
 * então.
 */

export interface Pendente {
  /** Identifica a coisa, para não se avisar dela duas vezes. */
  id: string;
  titulo: string;
  corpo: string;
  url: string;
}

export interface Aviso {
  titulo: string;
  corpo: string;
  url: string;
  tag: string;
}

/**
 * Junta o que há a avisar numa única notificação.
 *
 * Cinco coisas novas dão UM aviso, não cinco: cinco vibrações seguidas são a
 * maneira mais rápida de alguém desligar isto para sempre. Quando é uma só,
 * diz-se qual — porque "1 coisa nova" obriga a abrir para saber o quê.
 */
export function juntar(novos: Pendente[]): Aviso | null {
  if (novos.length === 0) return null;
  if (novos.length === 1) {
    const u = novos[0];
    return { titulo: u.titulo, corpo: u.corpo, url: u.url, tag: "pendentes" };
  }

  // Com vários, leva-se para o sítio do primeiro (o mais antigo a esperar).
  return {
    titulo: `${novos.length} coisas à tua espera`,
    corpo: novos.slice(0, 3).map((n) => n.titulo).join(" · ") + (novos.length > 3 ? " …" : ""),
    url: novos[0].url,
    tag: "pendentes",
  };
}

/** O que é novo face ao que já foi avisado. */
export function apenasNovos(pendentes: Pendente[], jaAvisados: string[]): Pendente[] {
  const vistos = new Set(jaAvisados);
  return pendentes.filter((p) => !vistos.has(p.id));
}

/**
 * A memória do que já se avisou, limitada.
 *
 * Sem limite, a lista cresceria para sempre. Guardam-se os ids ainda
 * pendentes mais os últimos avisados: o que já foi resolvido cai fora
 * sozinho, e se voltar a aparecer volta a avisar — que é o comportamento
 * certo, porque voltou mesmo a acontecer.
 */
export function memoriaAtualizada(pendentes: Pendente[], jaAvisados: string[], limite = 200): string[] {
  const idsAgora = pendentes.map((p) => p.id);
  const aindaRelevantes = jaAvisados.filter((id) => idsAgora.includes(id));
  return [...new Set([...aindaRelevantes, ...idsAgora])].slice(-limite);
}
