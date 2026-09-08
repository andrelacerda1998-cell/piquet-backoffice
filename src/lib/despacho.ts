/**
 * Difusão de um pedido à comunidade de técnicos, e leitura das respostas.
 *
 * O fluxo é: o cliente pede → o pedido vai a vários técnicos ao mesmo tempo →
 * quem pode responde → o staff escolhe entre quem aceitou. Este ficheiro tem a
 * parte que decide o que uma resposta quer dizer, separada do WhatsApp e da
 * base de dados para poder ser testada com todas as formas de escrever "sim"
 * que um técnico usa na prática.
 */

export type EstadoDifusao = "enviado" | "aceite" | "recusado" | "falhou";

export interface Difusao {
  id: string;
  technicianId: string;
  technicianName: string;
  phone: string;
  status: EstadoDifusao;
  error: string;
  respondedAt: string | null;
  createdAt: string;
}

/** Acentos fora, minúsculas, sem pontuação: "Sim!" e "sím" são a mesma coisa. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/*
  Um técnico ocupado responde do telemóvel, com uma mão, entre serviços. Não
  escreve "SIM" sozinho: escreve "sim posso", "vou eu", "aceito", "ok". Exigir
  a palavra exacta era desperdiçar respostas boas -- e uma resposta perdida é
  um cliente sem técnico.
*/
const SIM = [
  "sim", "s", "ok", "okay", "aceito", "aceite", "posso", "vou",
  "vou eu", "eu vou", "eu posso", "disponivel", "confirmo", "yes", "1",
];

const NAO = [
  "nao", "n", "no", "nop", "negativo", "recuso", "nao posso", "nao consigo",
  "nao dou", "ocupado", "indisponivel", "2",
];

/**
 * O que o técnico quis dizer, ou null quando a mensagem não é uma resposta.
 *
 * O null é importante: um técnico que escreve "a que horas?" não pode ser
 * contado como recusa. Sem resposta clara, a difusão fica como estava e a
 * mensagem entra na conversa para alguém ler.
 *
 * O "não" é procurado primeiro porque "não posso" contém "posso": pela ordem
 * inversa, uma recusa era lida como aceitação e o cliente recebia um técnico
 * que tinha dito que não podia.
 */
export function interpretarResposta(texto: string): "aceite" | "recusado" | null {
  const t = normalizar(texto);
  if (!t) return null;
  const palavras = t.split(/\s+/);

  const contem = (lista: string[]) =>
    lista.some((termo) =>
      termo.includes(" ") ? t.includes(termo) : palavras.includes(termo),
    );

  if (contem(NAO)) return "recusado";
  if (contem(SIM)) return "aceite";
  return null;
}

/**
 * Só os últimos 9 dígitos.
 *
 * O mesmo técnico aparece como "912345678" no Laravel e como "351912345678"
 * no webhook da Meta; comparar as cadeias tal como estão nunca casava, e a
 * resposta dele ficava por atribuir.
 */
export function fone9(telefone: string): string {
  return (telefone || "").replace(/\D/g, "").slice(-9);
}

/** Resumo para o ecrã: quantos foram perguntados e quantos já responderam. */
export function resumirDifusoes(difusoes: Difusao[]): {
  enviadas: number; aceites: number; recusadas: number; falhadas: number; porResponder: number;
} {
  const conta = (e: EstadoDifusao) => difusoes.filter((d) => d.status === e).length;
  return {
    enviadas: difusoes.length,
    aceites: conta("aceite"),
    recusadas: conta("recusado"),
    falhadas: conta("falhou"),
    porResponder: conta("enviado"),
  };
}

/**
 * Este técnico faz esta categoria?
 *
 * As categorias do técnico vêm do Laravel em `operation_areas` -- o nome engana
 * (parece geografia) mas são ofícios: "Canalização", "Eletricista". A geografia
 * real vive noutro sítio (AllowedZone) e a API de admin ainda não a expõe, por
 * isso proximidade não é coisa que se possa decidir aqui.
 *
 * A comparação é tolerante de propósito: o catálogo da Piquet diz
 * "Canalização" e o Laravel pode ter "Canalizador" ou "Canalização e água".
 * Exigir igualdade exacta deixava de fora técnicos qualificados -- e um
 * técnico a mais na lista custa a quem escolhe um segundo de leitura, um
 * técnico a menos custa o serviço.
 */
export function fazCategoria(categoriasTecnico: string[], categoria: string): boolean {
  const alvo = normalizar(categoria);
  if (!alvo) return false;
  const raiz = alvo.slice(0, Math.max(5, Math.floor(alvo.length * 0.7)));
  return categoriasTecnico.some((c) => {
    const t = normalizar(c);
    return t === alvo || t.includes(alvo) || alvo.includes(t) || (raiz.length >= 5 && t.startsWith(raiz));
  });
}

/**
 * O corpo do modelo dos técnicos continua a pedir uma resposta que sabemos ler?
 *
 * Este texto é metade de um acordo: a outra metade é `interpretarResposta`.
 * Trocar "responda SIM" por "responda ACEITO" não parte nada de visível -- os
 * pedidos continuam a sair --, mas as aceitações deixam de ser reconhecidas e
 * ninguém dá por isso até um cliente ficar sem técnico.
 *
 * Por isso a validação usa as MESMAS listas que a leitura das respostas: se o
 * que está escrito no modelo não é reconhecível, não se guarda.
 *
 * Devolve o motivo, ou null quando está bom.
 */
export function validarCorpoTecnico(corpo: string): string | null {
  const t = (corpo || "").trim();
  if (!t) return "O texto não pode ficar vazio.";
  if (t.length > 1024) return "A Meta não aceita corpos com mais de 1024 caracteres.";
  if (!t.includes("{{1}}")) return "Falta {{1}} — é onde entra o serviço e a localidade.";
  if (!t.includes("{{2}}")) return "Falta {{2}} — é onde entra a urgência.";

  /*
    Os parâmetros saem primeiro. A normalização transforma "{{1}}" em "1" e
    "{{2}}" em "2" -- que são respostas válidas ("1" para sim, "2" para não) --
    e por isso qualquer texto passava esta verificação só por ter os
    parâmetros lá dentro. A validação parecia estar a proteger e não protegia.
  */
  const palavras = normalizar(t.replace(/\{\{\s*\d+\s*\}\}/g, " ")).split(/\s+/);
  const temSim = SIM.some((s) => !s.includes(" ") && palavras.includes(s));
  const temNao = NAO.some((n) => !n.includes(" ") && palavras.includes(n));
  if (!temSim || !temNao) {
    return "O texto tem de pedir uma resposta que o backoffice saiba ler — SIM/NÃO, ou equivalentes como \"aceito\"/\"recuso\".";
  }
  return null;
}
