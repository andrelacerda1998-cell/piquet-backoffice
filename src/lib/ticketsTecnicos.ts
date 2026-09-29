/**
 * Os tickets dos TÉCNICOS, traduzidos para a caixa de entrada do suporte.
 *
 * Há dois sistemas de tickets. Os da app do cliente vivem no Supabase e
 * sempre apareceram aqui. Os dos técnicos vivem no Laravel e só se viam no
 * Filament — o backoffice não os contava, não os mostrava e não permitia
 * responder. As duas únicas mensagens que técnicos alguma vez mandaram
 * ficaram dias sem resposta por causa disso.
 *
 * Este ficheiro traduz uns nos outros. Não os unifica: continuam a ser duas
 * tabelas em dois sítios, e juntá-las a sério é outra conversa.
 */

/** Como o Laravel devolve (Api\\Admin\\SupportTicketController::present). */
export interface TicketTecnicoLaravel {
  id: number;
  subject: string;
  message: string;
  /** open | answered | closed */
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string | null;
  vendor: { id: number | null; name: string | null; phone_number: string | null };
  is_no_show_dispute: boolean;
  disputed_service_id: number | null;
}

export interface MensagemInbox {
  id: string;
  from: "requester" | "agente";
  authorName: string;
  body: string;
  at: string;
}

export interface TicketInbox {
  id: string;
  channel: string;
  requesterType: string;
  requesterName: string;
  requesterEmail: string;
  subject: string;
  category?: string;
  priority: string;
  status: string;
  messages: MensagemInbox[];
  openedAt: string;
  lastMessageAt: string;
  unread: number;
}

/**
 * Prefixo para os ids do Laravel.
 *
 * Os do Supabase são "TK-1104"; os do Laravel são inteiros. Sem prefixo, o
 * ticket 1104 de um lado e o 1104 do outro seriam o mesmo na lista — e
 * responder a um escrevia no outro.
 */
export const PREFIXO_TECNICO = "TEC-";

export const ehTicketDeTecnico = (id: string): boolean => id.startsWith(PREFIXO_TECNICO);

/** "TEC-42" → 42. `null` se não for um id de técnico válido. */
export function idLaravelDe(id: string): number | null {
  if (!ehTicketDeTecnico(id)) return null;
  const n = Number(id.slice(PREFIXO_TECNICO.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/*
  O Laravel tem três estados e a caixa de entrada tem cinco. A tradução perde
  granularidade -- não há como não perder -- e por isso fica escrita, nos dois
  sentidos, em vez de espalhada por ifs.

    open     → novo        (ninguém lhe tocou)
    answered → em_curso    (respondemos, pode haver mais)
    closed   → fechado

  De volta, "aguarda_cliente" e "resolvido" não existem do outro lado:
  aguardar resposta é continuar em aberto, e resolver é fechar.
*/
const PARA_INBOX: Record<string, string> = {
  open: "novo",
  answered: "em_curso",
  closed: "fechado",
};

const PARA_LARAVEL: Record<string, string> = {
  novo: "open",
  em_curso: "answered",
  aguarda_cliente: "answered",
  resolvido: "closed",
  fechado: "closed",
};

export const estadoParaInbox = (s: string): string => PARA_INBOX[s] ?? "novo";

/** `null` quando a caixa pede um estado que o Laravel não sabe representar. */
export const estadoParaLaravel = (s: string): string | null => PARA_LARAVEL[s] ?? null;

/**
 * Uma contestação de falta não é uma dúvida: o técnico foi cobrado em metade
 * do que ia receber e está a dizer que houve engano. Entra com importância
 * alta para não ficar atrás de um "como mudo a foto de perfil".
 */
export function importanciaDe(t: TicketTecnicoLaravel): string {
  return t.is_no_show_dispute ? "alta" : "media";
}

export function toTicketInbox(t: TicketTecnicoLaravel): TicketInbox {
  const abertura = t.created_at ?? new Date(0).toISOString();
  const nome = t.vendor?.name?.trim() || t.vendor?.phone_number?.trim() || `Técnico #${t.vendor?.id ?? "?"}`;

  const mensagens: MensagemInbox[] = [
    { id: `tec_${t.id}_1`, from: "requester", authorName: nome, body: t.message ?? "", at: abertura },
  ];
  if (t.admin_reply) {
    mensagens.push({
      id: `tec_${t.id}_r`,
      from: "agente",
      authorName: "Suporte Piquet",
      // Sem `replied_at` usa-se a abertura: inventar "agora" punha a resposta
      // no topo da caixa de cada vez que alguém abrisse o ecrã.
      body: t.admin_reply,
      at: t.replied_at ?? abertura,
    });
  }

  return {
    id: `${PREFIXO_TECNICO}${t.id}`,
    channel: "app_tecnico",
    requesterType: "tecnico",
    requesterName: nome,
    requesterEmail: "",
    subject: t.subject || "(sem assunto)",
    category: t.is_no_show_dispute ? "Contestação de falta" : undefined,
    priority: importanciaDe(t),
    status: estadoParaInbox(t.status),
    messages: mensagens,
    openedAt: abertura,
    lastMessageAt: t.replied_at ?? abertura,
    /*
      Por ler = ainda ninguém respondeu. O Laravel não guarda um contador de
      não-lidas como o Supabase; o que se sabe é se há resposta ou não, e é
      isso que a caixa precisa para o marcar a negrito.
    */
    unread: t.admin_reply ? 0 : 1,
  };
}
