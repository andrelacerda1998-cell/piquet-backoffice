/**
 * Ler a conversa cliente-técnico de um pedido, só para resolver uma reclamação
 * ou uma disputa (decisão do André, 15/10/2026).
 *
 * As mensagens ficam cifradas na base de dados, mas o servidor tem a chave de
 * cada serviço e decifra-as para as apps: não é cifra ponta a ponta. O
 * backoffice não as lia por não haver acesso, e não por não poder. O acesso
 * abre-se com regras:
 *
 *  - só com um CASO aberto neste pedido: um ticket de Suporte ligado a ele e
 *    ainda por resolver, um problema reportado na app (pelo cliente ou pelo
 *    técnico) ou uma falta do técnico;
 *  - com o MOTIVO escrito, gravado em nome de quem leu no histórico do pedido
 *    (`acoes_da_equipa`), e no log do Laravel;
 *  - só para quem trata de reclamações: Suporte, Operações e direção
 *    (`view_support` e `view_personal_data`, ver acessoApi).
 */

/**
 * DESLIGADO até as Políticas de Privacidade novas (clientes 1.3, prestadores
 * 1.2) estarem em vigor em piquetapp.com: hoje não dizem que as conversas
 * ficam guardadas nem que a Piquet as pode ler. Ligar é mudar isto para
 * `true`, num PR à parte, depois de as páginas novas estarem no ar.
 */
export const CONVERSAS_EM_DISPUTAS_LIGADO = false;

/** O interruptor, lido no servidor a cada pedido (uma função, para os testes o trocarem). */
export function conversasEmDisputasLigadas(): boolean {
  return CONVERSAS_EM_DISPUTAS_LIGADO;
}

/** Mais do que o motivo das outras ações: ler uma conversa privada pede uma frase. */
export const MOTIVO_MINIMO_DA_CONVERSA = 15;

/** Os estados de um ticket em que a reclamação ainda está por resolver. */
const TICKET_ABERTO = new Set(["novo", "em_curso", "aguarda_cliente"]);

export interface CasoDaConversa {
  /** O que segue para o Laravel: `problema`, `falta` ou `ticket:TK-…`. */
  id: string;
  /** Como se lê no ecrã. */
  rotulo: string;
}

export interface CasosDoLaravel {
  problema: { em: string; por: string | null; motivo: string | null } | null;
  falta: { em: string } | null;
  mensagens: number;
}

export interface TicketDoCaso {
  id: string;
  assunto: string;
  estado: string;
}

export interface MensagemDaConversa {
  id: number;
  de: "cliente" | "tecnico" | "outro";
  /** null quando a mensagem não se decifrou. */
  texto: string | null;
  enviada_em: string | null;
  lida: boolean;
}

export interface LeituraDaConversa {
  em: string;
  por: string | null;
  motivo: string | null;
  caso: string | null;
}

export interface EstadoDaConversa {
  ligado: boolean;
  casos: CasoDaConversa[];
  mensagens: number;
  leituras: LeituraDaConversa[];
}

const QUEM_REPORTOU: Record<string, string> = { customer: "pelo cliente", vendor: "pelo técnico" };

/** Os casos que abrem a conversa deste pedido. A ordem é a do ecrã. */
export function casosDoPedido(laravel: Pick<CasosDoLaravel, "problema" | "falta">, tickets: TicketDoCaso[]): CasoDaConversa[] {
  const casos: CasoDaConversa[] = tickets
    .filter((t) => TICKET_ABERTO.has(t.estado) && /^TK-\d{1,10}$/.test(t.id))
    .map((t) => ({ id: `ticket:${t.id}`, rotulo: `Ticket ${t.id}${t.assunto ? ` · ${t.assunto}` : ""}` }));
  if (laravel.problema) {
    const por = laravel.problema.por ? QUEM_REPORTOU[laravel.problema.por] ?? "" : "";
    casos.push({ id: "problema", rotulo: `Problema reportado na app${por ? ` ${por}` : ""}` });
  }
  if (laravel.falta) casos.push({ id: "falta", rotulo: "Falta do técnico" });
  return casos;
}

/** O motivo, arrumado; null se não chegar para justificar a leitura. */
export function motivoDaConversa(motivo: unknown): string | null {
  if (typeof motivo !== "string") return null;
  const m = motivo.trim().replace(/\s+/g, " ");
  return m.length >= MOTIVO_MINIMO_DA_CONVERSA ? m.slice(0, 500) : null;
}
