"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import type { PersonalTask, TaskStatus } from "@/services/tasksService";

/**
 * Cronograma das tarefas — cada barra vai de quando a tarefa foi criada até ao
 * seu prazo, com a linha do dia de hoje por cima.
 *
 * Porquê barras e não só marcadores: com data de criação e prazo dá para ver
 * há quanto tempo uma coisa está em cima da mesa, não apenas quando termina —
 * é o que distingue "prazo apertado" de "arrasta-se há dois meses".
 */

const ESTADO: Record<TaskStatus, { label: string; barra: string; ponto: string }> = {
  backlog: { label: "Backlog", barra: "bg-text-muted/40", ponto: "bg-text-muted" },
  em_curso: { label: "Em curso", barra: "bg-info/50", ponto: "bg-info" },
  a_espera: { label: "À espera", barra: "bg-warning/50", ponto: "bg-warning" },
  concluido: { label: "Concluído", barra: "bg-success/40", ponto: "bg-success" },
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIA = 86_400_000;
const dias = (a: number, b: number) => Math.round((b - a) / DIA);

export function TaskTimeline({ tasks }: { tasks: PersonalTask[] }) {
  const [incluirConcluidas, setIncluirConcluidas] = useState(false);

  const comPrazo = useMemo(
    () => tasks
      .filter((t) => t.dueDate && (incluirConcluidas || t.status !== "concluido"))
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [tasks, incluirConcluidas],
  );
  const semPrazo = useMemo(
    () => tasks.filter((t) => !t.dueDate && t.status !== "concluido"),
    [tasks],
  );

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeMs = hoje.getTime();

  // Janela: do mais antigo (criação ou prazo) ao prazo mais distante, com
  // folga para hoje ficar sempre visível.
  const janela = useMemo(() => {
    if (comPrazo.length === 0) return null;
    const marcos = comPrazo.flatMap((t) => [
      new Date(t.createdAt).getTime(),
      new Date(`${t.dueDate}T00:00:00`).getTime(),
    ]).filter((n) => Number.isFinite(n));
    const inicio = Math.min(...marcos, hojeMs);
    const fim = Math.max(...marcos, hojeMs);
    // margem de 3 dias de cada lado para as barras não colarem às bordas
    return { inicio: inicio - 3 * DIA, fim: fim + 3 * DIA };
  }, [comPrazo, hojeMs]);

  if (comPrazo.length === 0 && semPrazo.length === 0) {
    return <p className="py-10 text-center text-sm text-text-muted">Sem tarefas para mostrar.</p>;
  }

  const total = janela ? Math.max(1, janela.fim - janela.inicio) : 1;
  const pct = (ms: number) => janela ? ((ms - janela.inicio) / total) * 100 : 0;

  // Marcas de mês para o cabeçalho da escala.
  const marcasMes: { label: string; left: number }[] = [];
  if (janela) {
    const d = new Date(janela.inicio);
    d.setDate(1); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= janela.fim) {
      const t = d.getTime();
      if (t >= janela.inicio) marcasMes.push({ label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, left: pct(t) });
      d.setMonth(d.getMonth() + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          <b className="text-text-primary tabular-nums">{comPrazo.length}</b> {comPrazo.length === 1 ? "tarefa com prazo" : "tarefas com prazo"}
          {semPrazo.length > 0 && ` · ${semPrazo.length} sem prazo definido`}
        </p>
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" className="accent-piquet" checked={incluirConcluidas}
            onChange={(e) => setIncluirConcluidas(e.target.checked)} />
          Mostrar concluídas
        </label>
      </div>

      {janela && comPrazo.length > 0 && (
        <div className="card overflow-hidden">
          {/* Escala de meses */}
          <div className="relative h-7 border-b border-surface-border bg-surface-muted/60">
            {marcasMes.map((m) => (
              <span key={m.label} className="absolute top-1.5 text-[11px] font-medium text-text-muted"
                style={{ left: `calc(${m.left}% + 4px)` }}>
                {m.label}
              </span>
            ))}
          </div>

          <div className="divide-y divide-surface-border">
            {comPrazo.map((t) => {
              const criada = new Date(t.createdAt).getTime();
              const prazo = new Date(`${t.dueDate}T00:00:00`).getTime();
              const inicioBarra = Math.min(criada, prazo);
              const esq = pct(inicioBarra);
              const larg = Math.max(1.5, pct(prazo) - esq);
              const atrasada = t.status !== "concluido" && prazo < hojeMs;
              const faltam = dias(hojeMs, prazo);
              const est = ESTADO[t.status];
              return (
                <div key={t.id} className="grid grid-cols-[minmax(140px,220px)_1fr] gap-3 px-3 py-2 hover:bg-surface-muted/50 transition-colors">
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium truncate", t.status === "concluido" ? "text-text-muted line-through" : "text-text-primary")}>
                      {t.title}
                    </p>
                    <p className={cn("text-[11px]", atrasada ? "text-danger font-medium" : "text-text-muted")}>
                      {formatDate(t.dueDate!)}
                      {t.status === "concluido" ? " · concluída"
                        : atrasada ? ` · ${Math.abs(faltam)} ${Math.abs(faltam) === 1 ? "dia" : "dias"} de atraso`
                        : faltam === 0 ? " · é hoje"
                        : ` · faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`}
                    </p>
                  </div>

                  {/* Faixa da barra */}
                  <div className="relative h-9">
                    {/* linha de hoje */}
                    <div className="absolute inset-y-0 w-px bg-piquet/70 z-10" style={{ left: `${pct(hojeMs)}%` }} />
                    <div
                      className={cn("absolute top-1/2 -translate-y-1/2 h-3 rounded-full",
                        atrasada ? "bg-danger/50" : est.barra)}
                      style={{ left: `${esq}%`, width: `${larg}%` }}
                      title={`${t.title} · criada ${formatDate(t.createdAt)} · prazo ${formatDate(t.dueDate!)}`}
                    />
                    {/* marcador do prazo */}
                    <span
                      className={cn("absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full ring-2 ring-surface",
                        atrasada ? "bg-danger" : est.ponto)}
                      style={{ left: `${pct(prazo)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-3 border-t border-surface-border px-3 py-2 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 bg-piquet" />hoje</span>
            {Object.entries(ESTADO).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", v.ponto)} />{v.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-danger" />atrasada</span>
          </div>
        </div>
      )}

      {/* Sem prazo: ficam à vista, senão desaparecem do planeamento */}
      {semPrazo.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">Sem prazo definido</p>
          <div className="flex flex-wrap gap-2">
            {semPrazo.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border px-2.5 py-1 text-xs text-text-secondary">
                <span className={cn("h-2 w-2 rounded-full", ESTADO[t.status].ponto)} />
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
