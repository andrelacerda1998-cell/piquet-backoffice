"use client";

import { useState, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getCustomRequests, type CustomRequest, type CustomRequestStatus, type TechProposal } from "@/services/extrasService";
import { getTechnicians } from "@/services/techniciansService";
import type { Technician } from "@/types";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { X, Star, Clock, Send, Search, Check, Trash2 } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

const STATUS: Record<CustomRequestStatus, { label: string; tone: string }> = {
  novo: { label: "Novo", tone: "bg-info-light text-info" },
  em_analise: { label: "Em análise", tone: "bg-warning-light text-warning" },
  opcoes_enviadas: { label: "Opções enviadas", tone: "bg-piquet/15 text-piquet-700" },
  agendado: { label: "Agendado", tone: "bg-success-light text-success" },
  recusado: { label: "Recusado", tone: "bg-danger-light text-danger" },
};

const URGENCY: Record<CustomRequest["urgency"], string> = {
  baixa: "text-text-secondary", media: "text-warning", alta: "text-danger font-semibold",
};

/** Técnico real escolhido → proposta (o preço é definido pela equipa). */
function techToProposal(t: Technician, hours: number | null, category: string): TechProposal {
  return {
    id: `prop_${t.id}`,
    technicianId: t.id,
    technicianName: t.name,
    rating: t.averageRating,
    reviewsCount: t.servicesCompleted,
    specialization: t.categories?.[0] ?? category,
    distanceKm: 0,
    fixedPrice: Math.round((hours ?? 4) * 30 + 15),
    topReviews: [],
  };
}

export default function CustomRequestsPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getCustomRequests(), []);
  const { data: techData } = useAsyncData(() => getTechnicians(1, 200), []);
  const [requests, setRequests] = usePersistentList<CustomRequest>("custom-requests", data);
  const [tab, setTab] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const technicians = techData?.data ?? [];
  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const count = (s: CustomRequestStatus) => requests.filter((r) => r.status === s).length;

  const TABS: TabDef[] = [
    { id: "todos", label: "Todos", count: requests.length },
    { id: "novo", label: "Novos", count: count("novo") },
    { id: "em_analise", label: "Em análise", count: count("em_analise") },
    { id: "opcoes_enviadas", label: "Opções enviadas", count: count("opcoes_enviadas") },
    { id: "fechados", label: "Fechados" },
  ];

  const visible = requests.filter((r) => {
    if (tab === "todos") return true;
    if (tab === "fechados") return r.status === "agendado" || r.status === "recusado";
    return r.status === tab;
  });

  const update = (id: string, patch: Partial<CustomRequest>) =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setHoursFor = (r: CustomRequest, hours: number) => {
    update(r.id, { estimatedHours: hours, status: r.status === "novo" ? "em_analise" : r.status });
    toast(`Duração estimada: ${hours}h.`);
  };

  const toggleTech = (r: CustomRequest, tech: Technician) => {
    const exists = r.proposals.some((p) => p.technicianId === tech.id);
    if (exists) {
      update(r.id, { proposals: r.proposals.filter((p) => p.technicianId !== tech.id) });
    } else {
      if (r.proposals.length >= 3) { toast("Já escolheste 3 técnicos.", "info"); return; }
      update(r.id, { proposals: [...r.proposals, techToProposal(tech, r.estimatedHours, r.category)] });
    }
  };

  const setPrice = (r: CustomRequest, propId: string, price: number) =>
    update(r.id, { proposals: r.proposals.map((p) => (p.id === propId ? { ...p, fixedPrice: price } : p)) });

  const sendOptions = (r: CustomRequest) => {
    if (r.proposals.length !== 3) { toast("Escolhe exatamente 3 técnicos antes de enviar.", "error"); return; }
    update(r.id, { status: "opcoes_enviadas" });
    toast("3 opções enviadas para a app do cliente.");
  };

  return (
    <RouteGuard route="/servicos-personalizados">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pedidos personalizados <DemoBadge endpoint="/custom-requests" /></h1>
          <p className="text-text-secondary mt-1">Serviços complexos: define a duração e escolhe 3 técnicos (com preço fixo) para o cliente escolher na app.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Novos" metric={buildMetricValue(count("novo"), count("novo") + 1, true)} />
          <MetricCard title="Em análise" metric={buildMetricValue(count("em_analise"), 2)} />
          <MetricCard title="Opções enviadas" metric={buildMetricValue(count("opcoes_enviadas"), 2)} />
          <MetricCard title="Agendados" metric={buildMetricValue(count("agendado"), 1)} />
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((r) => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className="card p-4 text-left hover:shadow-elevated transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{r.customerName}</p>
                  <p className="text-xs text-text-secondary">{r.category} · {r.city}</p>
                </div>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0", STATUS[r.status].tone)}>{STATUS[r.status].label}</span>
              </div>
              <p className="mt-2 text-sm text-text-secondary line-clamp-2">{r.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
                <span className={cn("capitalize", URGENCY[r.urgency])}>Urgência {r.urgency}</span>
                <span>{r.estimatedHours ? `${r.estimatedHours}h · ${r.proposals.length}/3 técnicos` : "Por estimar"}</span>
              </div>
            </button>
          ))}
          {visible.length === 0 && <p className="text-sm text-text-muted">Sem pedidos neste estado.</p>}
        </div>
      </div>

      {selected && (
        <RequestDrawer
          req={selected}
          technicians={technicians}
          onClose={() => setSelectedId(null)}
          onSetHours={(h) => setHoursFor(selected, h)}
          onToggleTech={(t) => toggleTech(selected, t)}
          onSetPrice={(propId, price) => setPrice(selected, propId, price)}
          onSend={() => sendOptions(selected)}
          onSchedule={() => { update(selected.id, { status: "agendado" }); toast("Cliente escolheu um técnico — serviço agendado.", "success"); }}
        />
      )}
    </RouteGuard>
  );
}

function RequestDrawer({ req, technicians, onClose, onSetHours, onToggleTech, onSetPrice, onSend, onSchedule }: {
  req: CustomRequest;
  technicians: Technician[];
  onClose: () => void;
  onSetHours: (h: number) => void;
  onToggleTech: (t: Technician) => void;
  onSetPrice: (propId: string, price: number) => void;
  onSend: () => void;
  onSchedule: () => void;
}) {
  const [hours, setHours] = useState(req.estimatedHours ?? 4);
  const [query, setQuery] = useState("");
  const sent = req.status === "opcoes_enviadas" || req.status === "agendado";
  const pickedIds = new Set(req.proposals.map((p) => p.technicianId));
  const cheapestIdx = req.proposals.length
    ? req.proposals.reduce((best, p, i, arr) => (p.fixedPrice < arr[best].fixedPrice ? i : best), 0)
    : -1;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ACTIVE = new Set(["ativo", "disponivel", "aprovado"]);
    return technicians
      .filter((t) => ACTIVE.has(t.status))
      .filter((t) => !q || `${t.name} ${t.city} ${t.categories?.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 40);
  }, [technicians, query]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10 flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-text-muted">{req.id}</p>
            <h2 className="text-lg font-bold mt-0.5">{req.customerName}</h2>
            <p className="text-sm text-text-secondary">{req.category} · {req.city} · {req.phone}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Pedido do cliente */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">1 · Pedido do cliente</h3>
            <div className="card p-4">
              <p className="text-sm text-text-primary">{req.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                <span>Urgência <b className={cn("capitalize", URGENCY[req.urgency])}>{req.urgency}</b></span>
                <span>· Recebido {formatDate(req.createdAt)}</span>
              </div>
            </div>
          </section>

          {/* 2. Duração */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">2 · Duração do serviço</h3>
            <div className="card p-4 flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-text-secondary mb-1 block">Duração estimada (horas)</label>
                <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} disabled={sent} className="input-field max-w-[140px]" />
              </div>
              {!sent && (
                <button onClick={() => onSetHours(hours)} className="btn-secondary text-sm"><Clock className="h-4 w-4" /> Guardar duração</button>
              )}
            </div>
          </section>

          {/* 3. Escolher técnicos */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">3 · {sent ? "Opções enviadas" : `Escolher técnicos (${req.proposals.length}/3)`}</h3>
              {!sent && (
                <button onClick={onSend} disabled={req.proposals.length !== 3} className="btn-primary text-xs py-1.5 disabled:opacity-40">
                  <Send className="h-3.5 w-3.5" /> Enviar 3 opções
                </button>
              )}
              {req.status === "opcoes_enviadas" && (
                <button onClick={onSchedule} className="btn-secondary text-xs py-1.5">Simular escolha do cliente</button>
              )}
            </div>

            {/* Técnicos escolhidos */}
            {req.proposals.length > 0 && (
              <div className="space-y-2 mb-3">
                {req.proposals.map((p, idx) => (
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-xs font-bold">
                      {p.technicianName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary text-sm truncate">{p.technicianName}</p>
                      <p className="text-xs text-text-secondary inline-flex items-center gap-1">
                        <Star className="h-3 w-3 text-piquet fill-piquet" />{p.rating?.toFixed(1)} · {p.reviewsCount} serviços
                      </p>
                    </div>
                    {sent ? (
                      <span className="text-base font-bold text-text-primary">{formatCurrency(p.fixedPrice)}</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
                          <input type="number" min={0} value={p.fixedPrice} onChange={(e) => onSetPrice(p.id, Number(e.target.value))} className="input-field w-24 pl-5 py-1 text-sm" />
                        </div>
                        <button onClick={() => onToggleTech({ id: p.technicianId } as Technician)} className="text-text-muted hover:text-danger" title="Remover"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                    {sent && idx === cheapestIdx && <span className="text-[10px] text-info font-medium shrink-0">mais barata</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Procurar e adicionar técnicos (só antes de enviar) */}
            {!sent && (
              <div className="card p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar técnico por nome, zona ou categoria…" className="input-field pl-8 py-1.5 text-sm" />
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-surface-border/60">
                  {results.length === 0 && <p className="text-sm text-text-muted text-center py-6">Sem técnicos para esta procura.</p>}
                  {results.map((t) => {
                    const picked = pickedIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => onToggleTech(t)}
                        disabled={!picked && req.proposals.length >= 3}
                        className={cn("w-full flex items-center gap-3 px-1 py-2 text-left hover:bg-surface-muted rounded transition-colors disabled:opacity-40",
                          picked && "bg-piquet/5")}
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", picked ? "bg-piquet text-ink" : "bg-piquet/15 text-piquet-700")}>
                          {picked ? <Check className="h-4 w-4" /> : t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-text-primary truncate">{t.name}</span>
                          <span className="block text-xs text-text-muted truncate">{t.city} · {t.categories?.[0] ?? "—"}</span>
                        </span>
                        <span className="text-xs text-text-secondary inline-flex items-center gap-1 shrink-0">
                          <Star className="h-3 w-3 text-piquet fill-piquet" />{t.averageRating?.toFixed(1)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <div className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-secondary">
            Fluxo: cliente pede → a Piquet define a duração e escolhe 3 técnicos com preço fixo → cliente escolhe na app → serviço agendado.
          </div>
        </div>
      </div>
    </div>
  );
}
