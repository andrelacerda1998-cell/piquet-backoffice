"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { metricasSuporte, formatarEspera, esperaDoTicket } from "@/lib/supportMetrics";
import { useSearchParams } from "next/navigation";
import { useAsyncData } from "@/hooks/useDashboard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAuthStore, toast } from "@/stores";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  getInboxTickets, replyInboxTicket, updateInboxTicketStatus, updateInboxTicketPriority,
  deleteInboxTicket, seedInboxExamples, clearInboxExamples,
  TICKET_STATUS, statusMeta, CHANNEL_LABEL, isOpen,
  type InboxTicket, type TicketStatus, type TicketChannel, type TicketPriority,
} from "@/services/supportInboxService";
import { Search, Send, Smartphone, HardHat, Mail, Clock, ChevronDown, Trash2, Check } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";

const CHANNEL_ICON: Record<TicketChannel, typeof Mail> = {
  app_cliente: Smartphone,
  app_tecnico: HardHat,
  email: Mail,
};

type StatusFilter = "todos" | "abertos" | TicketStatus;

function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/** Link `mailto:` pré-preenchido — para responder a tickets de email a partir
 *  do cliente de email (enquanto a integração de email não existe, fase 2). */
function mailtoHref(t: InboxTicket) {
  const subject = `Re: ${t.subject} [${t.id}]`;
  const original = t.messages.map((m) => `> ${m.authorName}: ${m.body}`).join("\n");
  const body = `Olá ${t.requesterName.split(" ")[0]},\n\n\n\n— Suporte Piquet\n\n---- mensagem original ----\n${original}`;
  return `mailto:${t.requesterEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SupportInbox() {
  const userName = useAuthStore((s) => s.user?.name ?? "Suporte Piquet");
  const { data, loading, error, refetch } = useAsyncData(() => getInboxTickets(), []);
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const seeded = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("todos");
  const [query, setQuery] = useState("");
  /** Mais recente primeiro por omissão: é onde está a conversa viva. */
  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");
  /**
   * Exemplos e eliminação. Declarados aqui em cima com os outros estados: mais
   * abaixo ficariam depois dos `return` de carregamento/erro, e um hook a
   * seguir a um return é um hook condicional.
   */
  const [aSemear, setASemear] = useState(false);
  const [ticketAApagar, setTicketAApagar] = useState<InboxTicket | null>(null);
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) { setTickets(data); if (!seeded.current) { seeded.current = true; } }
  }, [data]);

  // Deep-link `?ticket=<id>` (vindo de uma notificação) — reativo à mudança do URL.
  const ticketParam = useSearchParams().get("ticket");
  useEffect(() => {
    if (ticketParam) setSelectedId(ticketParam);
  }, [ticketParam]);

  const counts = useMemo(() => ({
    todos: tickets.length,
    abertos: tickets.filter((t) => isOpen(t.status)).length,
    novo: tickets.filter((t) => t.status === "novo").length,
    em_curso: tickets.filter((t) => t.status === "em_curso").length,
    aguarda_cliente: tickets.filter((t) => t.status === "aguarda_cliente").length,
    resolvido: tickets.filter((t) => t.status === "resolvido").length,
    fechado: tickets.filter((t) => t.status === "fechado").length,
  }), [tickets]);

  /**
   * Medidas de serviço: o que interessa não é o total de tickets, é há quanto
   * tempo alguém está à espera. Regra em src/lib/supportMetrics.ts (testada).
   */
  const metricas = useMemo(() => metricasSuporte(tickets, Date.now()), [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lista = tickets.filter((t) => {
      if (filter === "abertos" && !isOpen(t.status)) return false;
      if (!["todos", "abertos"].includes(filter) && t.status !== filter) return false;
      if (q && !(`${t.subject} ${t.requesterName} ${t.id}`.toLowerCase().includes(q))) return false;
      return true;
    });
    // Ordena pela última mensagem — é a atividade real do ticket, não a data
    // de abertura: um pedido antigo com resposta de hoje está vivo.
    return lista.sort((a, b) => {
      const d = Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt);
      return ordem === "recentes" ? d : -d;
    });
  }, [tickets, filter, query, ordem]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selected?.messages.length, selectedId]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const send = () => {
    const body = reply.trim();
    if (!body || !selected) return;
    const optimistic = { id: `tmp_${Date.now()}`, from: "agente" as const, authorName: userName, body, at: new Date().toISOString() };
    setTickets((prev) => prev.map((t) => t.id === selected.id
      ? { ...t, messages: [...t.messages, optimistic], lastMessageAt: optimistic.at, unread: 0, status: t.status === "novo" ? "em_curso" : t.status }
      : t));
    setReply("");
    replyInboxTicket(selected.id, body, userName)
      .then((real) => setTickets((prev) => prev.map((t) => t.id === selected.id
        ? { ...t, messages: t.messages.map((m) => (m.id === optimistic.id ? real : m)) } : t)))
      .catch(() => {
        // Rollback: sem isto a mensagem ficava no fio com ar de enviada, e o
        // agente ia-se embora convencido de que o cliente a tinha recebido.
        setTickets((prev) => prev.map((t) => t.id === selected.id
          ? { ...t, messages: t.messages.filter((m) => m.id !== optimistic.id) } : t));
        setReply(body); // devolve o texto para não obrigar a reescrever
        toast("Falha ao enviar resposta — não foi entregue.", "error");
      });
  };

  /**
   * Grau de importância — etiqueta posta pela equipa, não vem da app.
   * Mesmo padrão do estado: otimista, com reposição se o servidor recusar.
   */
  const changePriority = (priority: TicketPriority) => {
    if (!selected) return;
    const anterior = selected.priority;
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, priority } : t)));
    updateInboxTicketPriority(selected.id, priority)
      .then(() => toast(`Importância: ${PRIORIDADES.find((p) => p.id === priority)?.label}`, "success"))
      .catch(() => {
        setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, priority: anterior } : t)));
        toast("Falha ao mudar a importância — nada foi alterado.", "error");
      });
  };

  const criarExemplos = async () => {
    setASemear(true);
    try {
      const n = await seedInboxExamples();
      await refetch();
      toast(`${n} tickets de exemplo criados.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível criar os exemplos.", "error");
    } finally { setASemear(false); }
  };

  const limparExemplos = async () => {
    setASemear(true);
    try {
      await clearInboxExamples();
      setSelectedId(null);
      await refetch();
      toast("Tickets de exemplo removidos.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível remover os exemplos.", "error");
    } finally { setASemear(false); }
  };

  const apagarTicket = async (t: InboxTicket) => {
    try {
      await deleteInboxTicket(t.id);
      setTickets((prev) => prev.filter((x) => x.id !== t.id));
      if (selectedId === t.id) setSelectedId(null);
      toast(`Ticket ${t.id} apagado.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível apagar o ticket.", "error");
    } finally { setTicketAApagar(null); }
  };

  /** Marca resolvido a partir da tabela, sem abrir a conversa. */
  const resolverRapido = (t: InboxTicket) => {
    const anterior = t.status;
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "resolvido" } : x)));
    updateInboxTicketStatus(t.id, "resolvido")
      .then(() => toast(`${t.subject} → Resolvido`, "success"))
      .catch(() => {
        setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: anterior } : x)));
        toast("Falha ao marcar como resolvido — nada foi alterado.", "error");
      });
  };

  const changeStatus = (status: TicketStatus) => {
    if (!selected) return;
    const anterior = selected.status;
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, status } : t)));
    updateInboxTicketStatus(selected.id, status)
      // O sucesso só se anuncia depois de o servidor confirmar: antes, o toast
      // disparava sempre e o ticket ficava a dizer "Resolvido" no ecrã enquanto
      // no servidor continuava aberto.
      .then(() => toast(`Ticket ${selected.id} → ${statusMeta(status).label}`, "success"))
      .catch(() => {
        setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, status: anterior } : t)));
        toast("Falha ao mudar o estado — nada foi alterado.", "error");
      });
  };

  return (
    <div className="space-y-4">
      {/* Só aparece quando há exemplos por limpar — não estorva no dia a dia. */}
      {tickets.some((t) => t.id.startsWith("EX-")) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-surface-border bg-surface-subtle/50 px-3 py-2">
          <p className="text-xs text-text-secondary">
            <strong className="text-text-primary">Tickets de exemplo</strong> na caixa — são os que têm
            &quot;[EXEMPLO]&quot; no assunto. Servem para experimentar o ecrã.
          </p>
          <button onClick={limparExemplos} disabled={aSemear}
            className="btn-secondary text-xs disabled:opacity-60">
            {aSemear ? "A remover…" : "Remover exemplos"}
          </button>
        </div>
      )}

      {/*
        Uma linha em vez de quatro cartões: o que interessa a quem abre esta
        página é se há alguém à espera, não um painel de indicadores. A mediana
        de resposta e o resto só faziam ruído por cima da caixa.
      */}
      {metricas.abertos > 0 && (
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{metricas.abertos}</strong> por fechar
          {metricas.semPrimeiraResposta > 0 && (
            <> · <span className="text-warning font-medium">{metricas.semPrimeiraResposta} ainda sem resposta</span></>
          )}
          {(metricas.horasDoMaisAntigo ?? 0) >= 24 && (
            <> · o mais antigo espera há <span className="text-danger font-medium">{formatarEspera(metricas.horasDoMaisAntigo)}</span></>
          )}
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar ticket, cliente…"
            className="input-field pl-8 py-1.5 text-sm" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}
          aria-label="Filtrar por estado" className="input-field py-1.5 text-sm w-auto">
          <option value="todos">Todos ({counts.todos})</option>
          {TICKET_STATUS.map((st) => (
            <option key={st.id} value={st.id}>{st.label} ({counts[st.id as keyof typeof counts] ?? 0})</option>
          ))}
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as "recentes" | "antigos")}
          aria-label="Ordenar" title="Ordena pela última mensagem — a atividade real do ticket"
          className="input-field py-1.5 text-sm w-auto">
          <option value="recentes">Recentes primeiro</option>
          <option value="antigos">Antigos primeiro</option>
        </select>
      </div>

      {/* Tabela — clicar numa linha abre a conversa */}
      {filtered.length === 0 ? (
        tickets.length === 0 ? (
          /*
            Caixa vazia por não haver NENHUM ticket é diferente de vazia por
            causa de um filtro. Enquanto as apps não chamarem o endpoint, este
            ecrã fica assim — e sem explicação parecia avaria do backoffice.
          */
          <div className="card px-4 py-12 text-center">
            <Mail className="h-9 w-9 mx-auto text-text-muted opacity-40 mb-3" />
            <p className="text-sm font-medium text-text-primary">Ainda não chegou nenhum ticket</p>
            <p className="mt-1 text-xs text-text-secondary max-w-sm mx-auto">
              A caixa recebe pedidos da app do cliente e da app do técnico assim que elas começarem
              a enviá-los. O backoffice já está pronto do lado dele.
            </p>
            <p className="mt-2 text-[11px] text-text-muted font-mono">POST /api/tickets</p>
            <button onClick={criarExemplos} disabled={aSemear} className="btn-secondary mt-4 text-xs disabled:opacity-60">
              {aSemear ? "A criar…" : "Criar tickets de exemplo"}
            </button>
            <p className="mt-1.5 text-[10px] text-text-muted">Para experimentar o ecrã. Apagam-se a qualquer momento.</p>
          </div>
        ) : (
          <div className="card px-4 py-10 text-center text-sm text-text-muted">Sem tickets neste filtro.</div>
        )
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-text-muted">
                  {/*
                    Cinco colunas. O tempo vive dentro do Assunto e o ícone de
                    origem dentro do De — como colunas próprias empurravam a
                    Importância para fora do ecrã em 1280px.
                  */}
                  <th className="px-4 py-2.5 font-medium">Assunto</th>
                  <th className="px-3 py-2.5 font-medium">De</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 font-medium">Importância</th>
                  <th className="px-2 py-2.5"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const Icon = CHANNEL_ICON[t.channel];
                  const meta = statusMeta(t.status);
                  const pri = PRIORIDADES.find((x) => x.id === t.priority);
                  const espera = esperaDoTicket(t, Date.now());
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "group border-b border-surface-border/60 last:border-0 cursor-pointer hover:bg-surface-muted transition-colors",
                        // Quem espera há mais de um dia sem resposta fica
                        // marcado na própria linha — não basta estar escrito
                        // numa coluna que se lê de passagem.
                        espera.tipo === "sem_resposta" && espera.urgente && "bg-danger-light/30",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {t.unread > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-danger shrink-0" title={`${t.unread} por ler`} />
                          )}
                          <span className={cn("font-medium text-text-primary truncate", t.unread > 0 && "font-semibold")}>
                            {t.subject}
                          </span>
                          <span className="ml-auto shrink-0 text-xs">
                            {espera.tipo === "sem_resposta" ? (
                              <span className={cn("font-medium", espera.urgente ? "text-danger" : "text-warning")}
                                title="Ninguém da equipa respondeu ainda">
                                sem resposta há {formatarEspera(espera.horas)}
                              </span>
                            ) : (
                              <span className="text-text-muted">{timeAgo(t.lastMessageAt)}</span>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted truncate mt-0.5">
                          {t.messages[t.messages.length - 1]?.from === "agente" ? "Tu: " : ""}
                          {t.messages[t.messages.length - 1]?.body}
                        </p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-text-secondary">
                          <span
                            className="inline-flex text-text-muted"
                            title={`${CHANNEL_LABEL[t.channel]} · ${t.requesterType === "tecnico" ? "Técnico" : "Cliente"}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          {t.requesterName}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.tone)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {/* Só quando sai do normal: "Média" repetida em todas as
                            linhas não dizia nada e ocupava a coluna toda. */}
                        {t.priority === "critica" || t.priority === "alta" ? (
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold",
                            t.priority === "critica" ? "text-danger" : "text-warning")}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", pri?.dot)} />
                            {pri?.label}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted" title={pri?.label}>—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-right">
                        {/* Ação rápida: fechar um ticket simples sem abrir a
                            conversa. Só aparece ao passar o rato, para não
                            encher a tabela de botões. */}
                        {isOpen(t.status) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resolverRapido(t); }}
                            title="Marcar como resolvido"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg text-text-muted hover:bg-success-light hover:text-success"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conversa em modal — abre ao clicar numa linha */}
      <Modal
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.subject ?? ""}
        subtitle={selected
          ? `${selected.requesterName} · ${selected.requesterEmail} · ${CHANNEL_LABEL[selected.channel]}${selected.category ? ` · ${selected.category}` : ""}`
          : undefined}
        size="xl"
      >
        {selected && (
          <div className="flex flex-col h-[60vh] -mx-1">
            {/* Estado, importância e ações */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-surface-border">
              <StatusPicker status={selected.status} onChange={changeStatus} />
              <PriorityPicker priority={selected.priority} onChange={changePriority} />
              <span className="text-[11px] text-text-muted inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />aberto {formatDateTime(selected.openedAt)}
              </span>
              <button
                onClick={() => setTicketAApagar(selected)}
                title="Apagar este ticket (irreversível)"
                className="ml-auto p-1.5 rounded-lg text-text-muted hover:bg-danger-light hover:text-danger transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {selected.messages.map((m) => {
                const own = m.from === "agente";
                return (
                  <div key={m.id} className={cn("flex gap-2.5", own && "flex-row-reverse")}>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      own ? "bg-piquet/15 text-piquet-700" : "bg-surface-strong text-text-secondary")}>
                      {initials(m.authorName)}
                    </span>
                    <div className={cn("max-w-[78%]", own && "text-right")}>
                      <div className={cn("flex items-center gap-2 text-[11px] text-text-muted mb-0.5", own && "justify-end")}>
                        <span className="font-medium text-text-secondary">{m.authorName}</span>
                        <span>{timeAgo(m.at)}</span>
                      </div>
                      <div className={cn("inline-block rounded-2xl px-3 py-2 text-sm text-text-primary text-left whitespace-pre-wrap",
                        own ? "bg-piquet/15" : "bg-surface-subtle")}>{m.body}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Resposta */}
            {selected.status === "fechado" ? (
              <div className="pt-3 border-t border-surface-border text-center text-sm text-text-muted">
                Ticket fechado. <button onClick={() => changeStatus("em_curso")} className="text-piquet-600 hover:underline">Reabrir</button>
              </div>
            ) : (
              <div className="pt-3 border-t border-surface-border">
                {selected.channel === "email" ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs text-text-muted inline-flex items-center gap-1.5 flex-1">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> Este pedido chegou por email — responde a partir do teu cliente de email.
                    </span>
                    <a href={mailtoHref(selected)} className="btn-primary text-sm inline-flex items-center justify-center gap-1.5 shrink-0">
                      <Mail className="h-4 w-4" /> Responder por email
                    </a>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      rows={2} placeholder={`Responder a ${selected.requesterName.split(" ")[0]}… (chega pelo canal ${CHANNEL_LABEL[selected.channel]})`}
                      className="input-field text-sm resize-none flex-1" />
                    <button onClick={send} disabled={!reply.trim()} className="btn-primary py-2 disabled:opacity-40 shrink-0"><Send className="h-4 w-4" /></button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {selected.status !== "resolvido" && (
                    <button onClick={() => changeStatus("resolvido")} className="btn-secondary text-xs py-1">Marcar resolvido</button>
                  )}
                  {selected.status !== "aguarda_cliente" && (
                    <button onClick={() => changeStatus("aguarda_cliente")} className="btn-secondary text-xs py-1">À espera do cliente</button>
                  )}
                  <button onClick={() => changeStatus("fechado")} className="text-xs text-text-muted hover:text-text-primary ml-auto">Fechar ticket</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={ticketAApagar !== null}
        onClose={() => setTicketAApagar(null)}
        onConfirm={async () => { if (ticketAApagar) await apagarTicket(ticketAApagar); }}
        title="Apagar este ticket?"
        description={
          <>
            <strong>{ticketAApagar?.subject}</strong> de {ticketAApagar?.requesterName} e toda a conversa
            desaparecem de vez. Não há como repor.
          </>
        }
        confirmLabel="Apagar"
        tone="danger"
      />
    </div>
  );
}

/* --------------------------- Seletor de estado --------------------------- */

/** Graus de importância, do mais grave para o menos. */
const PRIORIDADES: { id: TicketPriority; label: string; tone: string; dot: string }[] = [
  { id: "critica", label: "Crítica", tone: "bg-danger-light text-danger", dot: "bg-danger" },
  { id: "alta", label: "Alta", tone: "bg-warning-light text-warning", dot: "bg-warning" },
  { id: "media", label: "Média", tone: "bg-info-light text-info", dot: "bg-info" },
  { id: "baixa", label: "Baixa", tone: "bg-surface-subtle text-text-muted", dot: "bg-text-muted" },
];

function PriorityPicker({ priority, onChange }: { priority: TicketPriority; onChange: (p: TicketPriority) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const meta = PRIORIDADES.find((p) => p.id === priority) ?? PRIORIDADES[2];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} title="Mudar o grau de importância"
        className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity", meta.tone)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-40 bg-surface border border-surface-border rounded-lg shadow-elevated z-30 py-1">
          {PRIORIDADES.map((p) => (
            <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted inline-flex items-center gap-2", p.id === priority && "font-semibold")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />{p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPicker({ status, onChange }: { status: TicketStatus; onChange: (s: TicketStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const meta = statusMeta(status);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", meta.tone)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />{meta.label}<ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-surface-border rounded-lg shadow-elevated z-30 py-1">
          {TICKET_STATUS.map((s) => (
            <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted inline-flex items-center gap-2", s.id === status && "font-semibold")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
