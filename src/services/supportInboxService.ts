import { apiGet, apiPost, apiPut } from "./api";

/* ============================================================================
 * Caixa de entrada de tickets — modelo unificado, agnóstico ao canal.
 *
 * Base de implementação: os dados são mock. As costuras para as fontes reais
 * estão marcadas — em produção, `getInboxTickets` agrega:
 *   - Técnicos: piquetClient.getProSupportTickets() (backend Express /admin/*)
 *   - Clientes: novo endpoint /admin/customer-support-tickets (a acordar com o
 *     André — mesmo padrão dos técnicos)
 *   - Email (fase 2): fornecedor de email transacional
 * O resto do backoffice (esta UI) não muda quando se ligam as fontes reais.
 * ========================================================================== */

export type TicketChannel = "app_cliente" | "app_tecnico" | "email";
export type TicketStatus = "novo" | "em_curso" | "aguarda_cliente" | "resolvido" | "fechado";
export type TicketPriority = "baixa" | "media" | "alta" | "critica";

export interface InboxMessage {
  id: string;
  from: "requester" | "agente";
  authorName: string;
  body: string;
  at: string;
}

export interface InboxTicket {
  id: string;
  channel: TicketChannel;
  requesterType: "cliente" | "tecnico";
  requesterName: string;
  requesterEmail: string;
  subject: string;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  messages: InboxMessage[];
  openedAt: string;
  lastMessageAt: string;
  unread: number;
}

export const TICKET_STATUS: { id: TicketStatus; label: string; tone: string; dot: string }[] = [
  { id: "novo", label: "Novo", tone: "bg-danger-light text-danger", dot: "bg-danger" },
  { id: "em_curso", label: "Em curso", tone: "bg-info-light text-info", dot: "bg-info" },
  { id: "aguarda_cliente", label: "À espera do cliente", tone: "bg-warning-light text-warning", dot: "bg-warning" },
  { id: "resolvido", label: "Resolvido", tone: "bg-success-light text-success", dot: "bg-success" },
  { id: "fechado", label: "Fechado", tone: "bg-surface-subtle text-text-muted", dot: "bg-text-muted" },
];
export const statusMeta = (s: TicketStatus) => TICKET_STATUS.find((x) => x.id === s) ?? TICKET_STATUS[0];

export const CHANNEL_LABEL: Record<TicketChannel, string> = {
  app_cliente: "App · Cliente",
  app_tecnico: "App · Técnico",
  email: "Email",
};

const OPEN_STATES: TicketStatus[] = ["novo", "em_curso", "aguarda_cliente"];
export const isOpen = (s: TicketStatus) => OPEN_STATES.includes(s);

/* ------------------------------- Mock ------------------------------------- */

function mkMsgs(pairs: [InboxMessage["from"], string, string, string][]): InboxMessage[] {
  return pairs.map(([from, authorName, body, at], i) => ({ id: `im_${i}`, from, authorName, body, at }));
}

const SEED: InboxTicket[] = [
  {
    id: "TK-1042", channel: "app_cliente", requesterType: "cliente", requesterName: "Ana Marques", requesterEmail: "ana.marques@gmail.com",
    subject: "Técnico não apareceu à hora marcada", category: "Agendamento", priority: "alta", status: "novo",
    openedAt: "2026-07-14T08:12:00Z", lastMessageAt: "2026-07-14T08:12:00Z", unread: 1,
    messages: mkMsgs([["requester", "Ana Marques", "Marquei para as 9h e ninguém apareceu nem me avisaram. Preciso de resolver isto hoje.", "2026-07-14T08:12:00Z"]]),
  },
  {
    id: "TK-1041", channel: "app_cliente", requesterType: "cliente", requesterName: "João Pereira", requesterEmail: "joao.pereira@gmail.com",
    subject: "Cobrança duplicada no MB Way", category: "Pagamentos", priority: "critica", status: "em_curso",
    openedAt: "2026-07-14T07:40:00Z", lastMessageAt: "2026-07-14T09:05:00Z", unread: 0,
    messages: mkMsgs([
      ["requester", "João Pereira", "Fui cobrado duas vezes pelo mesmo serviço (35€ x2).", "2026-07-14T07:40:00Z"],
      ["agente", "Suporte Piquet", "Olá João, obrigado por avisar. Vou verificar os movimentos e já lhe digo algo.", "2026-07-14T08:02:00Z"],
      ["requester", "João Pereira", "Obrigado, fico a aguardar.", "2026-07-14T09:05:00Z"],
    ]),
  },
  {
    id: "TK-1040", channel: "app_tecnico", requesterType: "tecnico", requesterName: "Rui Ferreira", requesterEmail: "rui.ferreira@piquetpro.pt",
    subject: "Não consigo atualizar a disponibilidade", category: "App", priority: "media", status: "aguarda_cliente",
    openedAt: "2026-07-13T16:20:00Z", lastMessageAt: "2026-07-14T07:15:00Z", unread: 0,
    messages: mkMsgs([
      ["requester", "Rui Ferreira", "O botão de guardar disponibilidade não faz nada.", "2026-07-13T16:20:00Z"],
      ["agente", "Suporte Piquet", "Pode dizer-nos a versão da app e o modelo do telemóvel?", "2026-07-14T07:15:00Z"],
    ]),
  },
  {
    id: "TK-1039", channel: "app_tecnico", requesterType: "tecnico", requesterName: "Tiago Nogueira", requesterEmail: "tiago.n@piquetpro.pt",
    subject: "App crasha ao abrir o mapa", category: "Bug", priority: "alta", status: "novo",
    openedAt: "2026-07-14T06:50:00Z", lastMessageAt: "2026-07-14T06:50:00Z", unread: 1,
    messages: mkMsgs([["requester", "Tiago Nogueira", "Sempre que abro o mapa dos serviços a app fecha sozinha.", "2026-07-14T06:50:00Z"]]),
  },
  {
    id: "TK-1038", channel: "app_cliente", requesterType: "cliente", requesterName: "Carlos Dias", requesterEmail: "carlos.dias@gmail.com",
    subject: "Pedido de reembolso — serviço cancelado", category: "Pagamentos", priority: "alta", status: "em_curso",
    openedAt: "2026-07-13T11:30:00Z", lastMessageAt: "2026-07-13T15:10:00Z", unread: 0,
    messages: mkMsgs([
      ["requester", "Carlos Dias", "O serviço foi cancelado pelo técnico mas ainda não recebi o reembolso.", "2026-07-13T11:30:00Z"],
      ["agente", "Suporte Piquet", "Já pedimos o estorno. Costuma demorar 3-5 dias úteis a aparecer.", "2026-07-13T15:10:00Z"],
    ]),
  },
  {
    id: "TK-1035", channel: "email", requesterType: "cliente", requesterName: "Sofia Costa", requesterEmail: "sofia.costa@empresa.pt",
    subject: "Fatura com NIF errado", category: "Faturação", priority: "media", status: "novo",
    openedAt: "2026-07-13T09:05:00Z", lastMessageAt: "2026-07-13T09:05:00Z", unread: 1,
    messages: mkMsgs([["requester", "Sofia Costa", "A fatura do serviço saiu com o NIF errado, podem corrigir?", "2026-07-13T09:05:00Z"]]),
  },
  {
    id: "TK-1031", channel: "app_cliente", requesterType: "cliente", requesterName: "Marta Silva", requesterEmail: "marta.silva@gmail.com",
    subject: "Como remarcar um serviço?", category: "Dúvida", priority: "baixa", status: "resolvido",
    openedAt: "2026-07-12T14:00:00Z", lastMessageAt: "2026-07-12T14:40:00Z", unread: 0,
    messages: mkMsgs([
      ["requester", "Marta Silva", "Preciso de remarcar o serviço de amanhã para a semana que vem.", "2026-07-12T14:00:00Z"],
      ["agente", "Suporte Piquet", "Pode fazê-lo em 'Os meus serviços' → 'Remarcar'. Se preferir, remarco eu por si.", "2026-07-12T14:20:00Z"],
      ["requester", "Marta Silva", "Consegui, obrigada!", "2026-07-12T14:40:00Z"],
    ]),
  },
  {
    id: "TK-1028", channel: "app_cliente", requesterType: "cliente", requesterName: "Pedro Ramos", requesterEmail: "pedro.ramos@gmail.com",
    subject: "Elogio ao técnico João", category: "Feedback", priority: "baixa", status: "fechado",
    openedAt: "2026-07-11T18:20:00Z", lastMessageAt: "2026-07-11T18:20:00Z", unread: 0,
    messages: mkMsgs([["requester", "Pedro Ramos", "Só queria deixar um elogio — o técnico foi impecável e muito rápido.", "2026-07-11T18:20:00Z"]]),
  },
];

let cache: InboxTicket[] = SEED.map((t) => ({ ...t, messages: [...t.messages] }));

/* ------------------------------- API -------------------------------------- */

export async function getInboxTickets(): Promise<InboxTicket[]> {
  return apiGet("/support/inbox", () =>
    [...cache].sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
  ).then((r) => r.data);
}

export async function replyInboxTicket(id: string, body: string, authorName: string): Promise<InboxMessage> {
  return apiPost(`/support/inbox/${id}/reply`, { body }, () => {
    const msg: InboxMessage = { id: `im_${Date.now()}`, from: "agente", authorName, body, at: new Date().toISOString() };
    cache = cache.map((t) =>
      t.id === id
        ? { ...t, messages: [...t.messages, msg], lastMessageAt: msg.at, unread: 0, status: t.status === "novo" ? "em_curso" : t.status }
        : t
    );
    return msg;
  }).then((r) => r.data);
}

export async function updateInboxTicketStatus(id: string, status: TicketStatus): Promise<InboxTicket> {
  return apiPut(`/support/inbox/${id}/status`, { status }, () => {
    cache = cache.map((t) => (t.id === id ? { ...t, status } : t));
    const t = cache.find((x) => x.id === id);
    if (!t) throw new Error("Ticket não encontrado");
    return t;
  }).then((r) => r.data);
}
