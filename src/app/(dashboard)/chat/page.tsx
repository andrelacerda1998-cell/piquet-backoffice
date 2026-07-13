"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getTeamMessages, sendTeamMessage, getTeamMeetings, createTeamMeeting,
  getTeamTasks, createTeamTask, updateTeamTaskStatus,
  TEAM_MEMBERS, TEAM_CHANNELS, TEAM_AGENDA_DAYS, TEAM_DAY_LABEL,
  type ChatMessage, type TeamAgendaEvent, type TeamTask,
} from "@/services/extrasService";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { useTeamChatRealtime } from "@/hooks/useTeamChatRealtime";
import { useAuthStore, toast } from "@/stores";
import { daysUntil, todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { Hash, Send, Plus, Calendar, MapPin, Users, CheckCircle2, Circle, PlayCircle } from "lucide-react";

const EVENT_TONE: Record<TeamAgendaEvent["type"], string> = {
  reuniao: "bg-piquet/15 text-piquet-700 border-piquet/30",
  foco: "bg-info-light text-info border-info/30",
  externo: "bg-warning-light text-warning border-warning/30",
  ausencia: "bg-surface-subtle text-text-secondary border-surface-border",
};

function nowHM() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const { data: baseMsgs, loading, error, refetch } = useAsyncData(() => getTeamMessages(), []);
  const { data: baseAgenda } = useAsyncData(() => getTeamMeetings(), []);
  const { data: baseTasks } = useAsyncData(() => getTeamTasks(), []);
  const [tab, setTab] = useState("conversas");

  if (loading && !baseMsgs) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const TABS: TabDef[] = [
    { id: "conversas", label: "Conversas" },
    { id: "tarefas", label: "Tarefas", count: (baseTasks ?? []).filter((t) => t.status !== "concluida").length },
    { id: "agenda", label: "Agenda e reuniões" },
  ];

  return (
    <RouteGuard route="/chat">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Equipa</h1>
          <p className="text-text-secondary mt-1">Conversas internas e agenda dos colaboradores</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "conversas" && <Conversas base={baseMsgs ?? []} userName={user?.name ?? "Eu"} />}
        {tab === "tarefas" && <TarefasEquipa base={baseTasks ?? []} />}
        {tab === "agenda" && <AgendaEquipa base={baseAgenda ?? []} userName={user?.name ?? "Eu"} />}
      </div>
    </RouteGuard>
  );
}

/* ------------------------------- Conversas ------------------------------- */

function Conversas({ base, userName }: { base: ChatMessage[]; userName: string }) {
  const [active, setActive] = useState("geral");
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(base);
  const seeded = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Semeia com o fetch inicial (uma vez). A partir daí o estado é mantido
  // localmente e alimentado pelo realtime + envios otimistas.
  useEffect(() => {
    if (!seeded.current && base.length) { setMsgs(base); seeded.current = true; }
  }, [base]);

  // Chat ao vivo: ouve inserts em team_messages e faz push instantâneo.
  useTeamChatRealtime(setMsgs);

  const isDm = active.startsWith("dm:");
  const memberId = isDm ? active.slice(3) : null;
  const member = TEAM_MEMBERS.find((m) => m.id === memberId);
  const activeChannel = TEAM_CHANNELS.find((c) => c.id === active);

  const messages = useMemo(
    () => msgs.filter((m) => m.threadId === active),
    [msgs, active]
  );

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const tempId = `tmp_${Date.now()}`;
    const draft: Omit<ChatMessage, "id" | "own"> = {
      threadId: active, author: userName, initials: initialsOf(userName), text: body, time: nowHM(),
    };
    // Otimista para UI imediata.
    setMsgs((prev) => [...prev, { ...draft, id: tempId, own: true }]);
    setText("");
    // Persiste no backend e troca o otimista pela mensagem real. O dedupe por
    // id evita duplicar quando o realtime devolver a mesma mensagem.
    sendTeamMessage(draft)
      .then((real) => setMsgs((prev) => {
        const rest = prev.filter((m) => m.id !== tempId);
        return rest.some((m) => m.id === real.id) ? rest : [...rest, { ...real, own: true }];
      }))
      .catch(() => {
        setMsgs((prev) => prev.filter((m) => m.id !== tempId));
        toast("Falha ao enviar mensagem.", "error");
      });
  };

  const title = isDm ? member?.name : `#${activeChannel?.name}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      {/* Lista de canais e diretas */}
      <div className="card p-2 h-fit space-y-3">
        <div>
          <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Canais</p>
          {TEAM_CHANNELS.map((c) => (
            <button key={c.id} onClick={() => setActive(c.id)}
              className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                active === c.id ? "bg-piquet/15 text-text-primary font-semibold" : "text-text-secondary hover:bg-surface-muted")}>
              <Hash className={cn("h-4 w-4", active === c.id ? "text-piquet-600" : "text-text-muted")} />
              <span className="flex-1 text-left">{c.name}</span>
              {c.unread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-piquet text-ink text-[10px] font-bold flex items-center justify-center">{c.unread}</span>}
            </button>
          ))}
        </div>
        <div>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Mensagens diretas</p>
          {TEAM_MEMBERS.filter((m) => m.name !== userName).map((m) => {
            const id = `dm:${m.id}`;
            return (
              <button key={m.id} onClick={() => setActive(id)}
                className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  active === id ? "bg-piquet/15 text-text-primary font-semibold" : "text-text-secondary hover:bg-surface-muted")}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-[10px] font-bold">{m.initials}</span>
                <span className="flex-1 text-left truncate">{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversa */}
      <div className="card flex flex-col h-[560px]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
          {isDm
            ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">{member?.initials}</span>
            : <Hash className="h-4 w-4 text-text-muted" />}
          <span className="font-semibold">{title}</span>
          {isDm && <span className="text-xs text-text-muted">· {member?.role}</span>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && <p className="text-sm text-text-muted text-center py-8">Sem mensagens ainda. Escreve a primeira 👇</p>}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.own && "flex-row-reverse")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">{m.initials}</span>
              <div className={cn("max-w-[75%]", m.own && "text-right")}>
                <div className={cn("flex items-center gap-2 text-xs text-text-muted mb-0.5", m.own && "justify-end")}>
                  <span className="font-medium text-text-secondary">{m.author}</span>
                  <span>{m.time}</span>
                </div>
                <div className={cn("inline-block rounded-2xl px-3 py-2 text-sm text-text-primary", m.own ? "bg-piquet/15" : "bg-surface-subtle")}>{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="flex items-center gap-2 p-3 border-t border-surface-border">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="input-field"
            placeholder={isDm ? `Mensagem para ${member?.name}` : `Mensagem para #${activeChannel?.name}`}
          />
          <button onClick={send} disabled={!text.trim()} className="btn-primary py-2 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Agenda da equipa --------------------------- */

function AgendaEquipa({ base, userName }: { base: TeamAgendaEvent[]; userName: string }) {
  const [localMeetings, setLocalMeetings] = useState<TeamAgendaEvent[]>([]);
  const [person, setPerson] = useState<string>("Todos");
  const [view, setView] = useState<"semana" | "dia">("semana");
  const [day, setDay] = useState<string>(TEAM_AGENDA_DAYS[3]); // Seg 06
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", withPerson: TEAM_MEMBERS[2].name, date: TEAM_AGENDA_DAYS[3], start: "10:00", end: "10:30", location: "" });

  const all = useMemo(() => [...base, ...localMeetings], [base, localMeetings]);
  const days = view === "semana" ? TEAM_AGENDA_DAYS : [day];

  const filtered = (d: string) =>
    all.filter((e) => e.date === d && (person === "Todos" || e.person === person))
      .sort((a, b) => a.start.localeCompare(b.start));

  const create = () => {
    if (!form.title.trim()) { toast("Indica o título da reunião.", "error"); return; }
    if (form.end <= form.start) { toast("A hora de fim tem de ser depois do início.", "error"); return; }
    const ev: Omit<TeamAgendaEvent, "id"> = {
      person: form.withPerson, date: form.date, start: form.start, end: form.end,
      title: form.title.trim(), type: "reuniao", participants: [userName],
      location: form.location.trim() || undefined,
    };
    setLocalMeetings((prev) => [...prev, { ...ev, id: `tmp_${Date.now()}` }]);
    setOpen(false);
    setForm({ title: "", withPerson: TEAM_MEMBERS[2].name, date: TEAM_AGENDA_DAYS[3], start: "10:00", end: "10:30", location: "" });
    createTeamMeeting(ev).catch(() => toast("Falha ao marcar reunião.", "error"));
    toast(`Reunião marcada com ${ev.person} (${TEAM_DAY_LABEL[ev.date]}, ${ev.start}).`);
  };

  return (
    <div className="space-y-4">
      {/* Barra de controlo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setPerson("Todos")}
            className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              person === "Todos" ? "bg-piquet/15 text-piquet-700 border-piquet/30" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
            Todos
          </button>
          {TEAM_MEMBERS.map((m) => (
            <button key={m.id} onClick={() => setPerson(m.name)}
              className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-1.5",
                person === m.name ? "bg-piquet/15 text-piquet-700 border-piquet/30" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-[9px] font-bold">{m.initials}</span>
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-surface-border bg-surface p-0.5 text-xs">
            {(["semana", "dia"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-3 py-1 rounded-md font-medium capitalize transition-colors", view === v ? "bg-piquet/15 text-piquet-700" : "text-text-secondary hover:text-text-primary")}>{v}</button>
            ))}
          </div>
          {view === "dia" && (
            <select value={day} onChange={(e) => setDay(e.target.value)} className="input-field text-sm py-1.5 w-auto">
              {TEAM_AGENDA_DAYS.map((d) => <option key={d} value={d}>{TEAM_DAY_LABEL[d]}</option>)}
            </select>
          )}
          <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Marcar reunião</button>
        </div>
      </div>

      {/* Grelha da agenda */}
      <div className={cn("grid gap-3", view === "semana" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" : "grid-cols-1")}>
        {days.map((d) => {
          const evs = filtered(d);
          return (
            <div key={d} className="card p-3">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-text-primary">
                <Calendar className="h-4 w-4 text-piquet-600" /> {TEAM_DAY_LABEL[d]}
                <span className="ml-auto text-xs text-text-muted font-normal">{evs.length} {evs.length === 1 ? "evento" : "eventos"}</span>
              </div>
              <div className="space-y-2">
                {evs.length === 0 && <p className="text-xs text-text-muted py-3 text-center">Sem eventos</p>}
                {evs.map((e) => (
                  <div key={e.id} className={cn("rounded-lg border px-2.5 py-2 text-xs", EVENT_TONE[e.type])}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{e.start}–{e.end}</span>
                      {person === "Todos" && <span className="opacity-80">{e.person.split(" ")[0]}</span>}
                    </div>
                    <p className="font-medium text-text-primary mt-0.5">{e.title}</p>
                    {(e.participants?.length || e.location) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
                        {e.participants?.length ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.participants.join(", ")}</span> : null}
                        {e.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span> : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal marcar reunião */}
      <Modal open={open} onClose={() => setOpen(false)} title="Marcar reunião" subtitle="Adiciona à agenda do colaborador"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm">Marcar</button>
        </>}>
        <div className="space-y-3">
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Ex.: Ponto de situação de operações" /></Field>
          <Field label="Com"><select value={form.withPerson} onChange={(e) => setForm({ ...form, withPerson: e.target.value })} className="input-field">
            {TEAM_MEMBERS.filter((m) => m.name !== userName).map((m) => <option key={m.id} value={m.name}>{m.name} · {m.role}</option>)}
          </select></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Dia"><select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field">
              {TEAM_AGENDA_DAYS.map((d) => <option key={d} value={d}>{TEAM_DAY_LABEL[d]}</option>)}
            </select></Field>
            <Field label="Início"><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="input-field" /></Field>
            <Field label="Fim"><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="input-field" /></Field>
          </div>
          <Field label="Local (opcional)"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" placeholder="Sala Lisboa / Online" /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ Tarefas ------------------------------ */

const STATUS_LABEL: Record<TeamTask["status"], string> = { aberta: "Aberta", em_curso: "Em curso", concluida: "Concluída" };
const STATUS_ICON = { aberta: Circle, em_curso: PlayCircle, concluida: CheckCircle2 };
const STATUS_TONE = { aberta: "text-text-muted", em_curso: "text-info", concluida: "text-success" };
const NEXT_STATUS: Record<TeamTask["status"], TeamTask["status"] | null> = { aberta: "em_curso", em_curso: "concluida", concluida: null };

function TarefasEquipa({ base }: { base: TeamTask[] }) {
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [person, setPerson] = useState("Todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", assignee: TEAM_MEMBERS[2].name, priority: "media" as TeamTask["priority"], due: "2026-07-10" });

  useEffect(() => { setTasks(base); }, [base]);

  const filtered = tasks
    .filter((t) => person === "Todos" || t.assignee === person)
    .sort((a, b) => (a.status === "concluida" ? 1 : 0) - (b.status === "concluida" ? 1 : 0) || a.due.localeCompare(b.due));

  const advance = (t: TeamTask) => {
    const next = NEXT_STATUS[t.status];
    if (!next) return;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    updateTeamTaskStatus(t.id, next).catch(() => toast("Falha ao atualizar tarefa.", "error"));
    toast(next === "concluida" ? "Tarefa concluída 🎉" : "Tarefa iniciada.");
  };

  const create = () => {
    if (!form.title.trim()) { toast("Indica o título da tarefa.", "error"); return; }
    const member = TEAM_MEMBERS.find((m) => m.name === form.assignee);
    const task: Omit<TeamTask, "id"> = {
      title: form.title.trim(), assignee: form.assignee, department: member?.department ?? "",
      priority: form.priority, status: "aberta", due: form.due,
    };
    setTasks((prev) => [{ ...task, id: `tmp_${Date.now()}` }, ...prev]);
    setOpen(false);
    setForm({ title: "", assignee: TEAM_MEMBERS[2].name, priority: "media", due: "2026-07-10" });
    createTeamTask(task).catch(() => toast("Falha ao criar tarefa.", "error"));
    toast(`Tarefa atribuída a ${form.assignee.split(" ")[0]}.`);
  };

  return (
    <div className="space-y-4">
      {/* Filtro por membro + nova tarefa */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setPerson("Todos")}
            className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              person === "Todos" ? "bg-piquet/15 text-piquet-700 border-piquet/30" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
            Todos
          </button>
          {TEAM_MEMBERS.map((m) => {
            const openCount = tasks.filter((t) => t.assignee === m.name && t.status !== "concluida").length;
            return (
              <button key={m.id} onClick={() => setPerson(m.name)}
                className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-1.5",
                  person === m.name ? "bg-piquet/15 text-piquet-700 border-piquet/30" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-[9px] font-bold">{m.initials}</span>
                {m.name.split(" ")[0]}
                {openCount > 0 && <span className="text-[10px] text-text-muted">· {openCount}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova tarefa</button>
      </div>

      {/* Tarefas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.length === 0 && <p className="text-sm text-text-muted py-6 text-center col-span-full">Sem tarefas para este membro.</p>}
        {filtered.map((t) => {
          const Icon = STATUS_ICON[t.status];
          const d = daysUntil(t.due);
          const next = NEXT_STATUS[t.status];
          return (
            <div key={t.id} className={cn("card p-4 space-y-2.5", t.status === "concluida" && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", STATUS_TONE[t.status])}>
                  <Icon className="h-4 w-4" /> {STATUS_LABEL[t.status]}
                </span>
                <PriorityBadge priority={t.priority} />
              </div>
              <p className={cn("font-medium text-text-primary leading-snug", t.status === "concluida" && "line-through text-text-muted")}>{t.title}</p>
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="inline-flex items-center gap-1.5 text-text-secondary">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-[9px] font-bold">{initialsOf(t.assignee)}</span>
                  {t.assignee.split(" ")[0]}
                </span>
                <span className={cn(t.status !== "concluida" && d < 0 ? "text-danger font-medium" : "text-text-muted")}>
                  {t.status === "concluida" ? "Concluída" : d < 0 ? `Atrasada ${Math.abs(d)}d` : d === 0 ? "Vence hoje" : `Vence em ${d}d`}
                </span>
              </div>
              {next && (
                <button onClick={() => advance(t)} className="btn-secondary text-xs py-1.5 w-full">
                  {next === "em_curso" ? "Iniciar" : "Marcar concluída"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal atribuir tarefa */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nova tarefa" subtitle="Atribui a um membro da equipa"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm">Atribuir</button>
        </>}>
        <div className="space-y-3">
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Ex.: Preparar relatório mensal" /></Field>
          <Field label="Atribuir a"><select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="input-field">
            {TEAM_MEMBERS.map((m) => <option key={m.id} value={m.name}>{m.name} · {m.role}</option>)}
          </select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TeamTask["priority"] })} className="input-field">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select></Field>
            <Field label="Prazo"><input type="date" value={form.due} min={todayISO()} onChange={(e) => setForm({ ...form, due: e.target.value })} className="input-field" /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
