"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getCustomRequests, type CustomRequest, type CustomRequestStatus, type TechProposal } from "@/services/extrasService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { X, Star, Clock, MapPin, Wand2, Send } from "lucide-react";

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

const SAMPLE_NAMES = ["Rui Ferreira", "Carla Sousa", "Nuno Bernardes", "Sofia Antunes", "Pedro Gomes", "Ana Martins"];
const REVIEWS = ["Trabalho impecável e profissional.", "Rápido, limpo e explicou tudo.", "Chegou à hora e resolveu logo.", "Excelente relação qualidade/preço."];

function generateProposals(reqId: string, hours: number, category: string): TechProposal[] {
  return Array.from({ length: 3 }).map((_, i) => {
    const hourly = 22 + i * 7;
    return {
      id: `prop_${reqId}_${i}`,
      technicianName: SAMPLE_NAMES[(reqId.length + i) % SAMPLE_NAMES.length],
      rating: +(4.4 + (i % 3) * 0.2).toFixed(1),
      reviewsCount: 24 + i * 31,
      specialization: category,
      distanceKm: 1 + i * 2,
      fixedPrice: Math.round(hours * hourly + 15),
      topReviews: [REVIEWS[i % REVIEWS.length], REVIEWS[(i + 2) % REVIEWS.length]],
    };
  });
}

export default function CustomRequestsPage() {
  const { data, loading, error, refetch } = useAsyncData(() => getCustomRequests(), []);
  const [requests, setRequests] = usePersistentList<CustomRequest>("custom-requests", data);
  const [tab, setTab] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

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
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));

  const setHoursFor = (id: string, hours: number, category: string) => {
    update(id, { estimatedHours: hours, status: "em_analise", proposals: generateProposals(id, hours, category) });
    toast(`Estimativa de ${hours}h definida — 3 opções de técnicos geradas.`);
  };
  const sendOptions = (id: string) => {
    update(id, { status: "opcoes_enviadas" });
    toast("3 opções enviadas para a app do cliente.");
  };

  return (
    <RouteGuard route="/servicos-personalizados">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pedidos personalizados</h1>
          <p className="text-text-secondary mt-1">Serviços complexos: a Piquet estima as horas e envia 3 opções de técnicos (preço fixo + avaliações) para o cliente escolher.</p>
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
                <span>{r.estimatedHours ? `${r.estimatedHours}h · ${r.proposals.length} opções` : "Por estimar"}</span>
              </div>
            </button>
          ))}
          {visible.length === 0 && <p className="text-sm text-text-muted">Sem pedidos neste estado.</p>}
        </div>
      </div>

      {selected && (
        <RequestDrawer
          req={selected}
          onClose={() => setSelectedId(null)}
          onSetHours={(h) => setHoursFor(selected.id, h, selected.category)}
          onSend={() => sendOptions(selected.id)}
          onSchedule={() => { update(selected.id, { status: "agendado" }); toast("Cliente escolheu um técnico — serviço agendado.", "success"); }}
        />
      )}
    </RouteGuard>
  );
}

function RequestDrawer({ req, onClose, onSetHours, onSend, onSchedule }: {
  req: CustomRequest;
  onClose: () => void;
  onSetHours: (h: number) => void;
  onSend: () => void;
  onSchedule: () => void;
}) {
  const [hours, setHours] = useState(req.estimatedHours ?? 4);

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

          {/* 2. Estimativa da Piquet */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">2 · Estimativa da Piquet</h3>
            <div className="card p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-text-secondary mb-1 block">Duração estimada (horas)</label>
                  <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input-field max-w-[140px]" />
                </div>
                <button onClick={() => onSetHours(hours)} className="btn-primary text-sm">
                  <Wand2 className="h-4 w-4" /> {req.proposals.length ? "Recalcular opções" : "Gerar 3 opções"}
                </button>
              </div>
              {req.estimatedHours && (
                <p className="mt-3 text-sm text-text-secondary inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Estimativa atual: <b className="text-text-primary">{req.estimatedHours}h</b></p>
              )}
            </div>
          </section>

          {/* 3. Opções de técnicos */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">3 · Opções para o cliente</h3>
              {req.proposals.length > 0 && req.status !== "agendado" && (
                <button onClick={req.status === "opcoes_enviadas" ? onSchedule : onSend} className="btn-secondary text-xs py-1.5">
                  {req.status === "opcoes_enviadas" ? "Simular escolha do cliente" : <><Send className="h-3.5 w-3.5" /> Enviar 3 opções ao cliente</>}
                </button>
              )}
            </div>
            {req.proposals.length === 0 ? (
              <div className="card p-6 text-center text-sm text-text-muted">Define a duração para gerar as 3 opções de técnicos.</div>
            ) : (
              <div className="space-y-3">
                {req.proposals.map((p, idx) => (
                  <div key={p.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-piquet/15 text-piquet-700 text-sm font-bold">
                          {p.technicianName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                        <div>
                          <p className="font-semibold text-text-primary">{p.technicianName}</p>
                          <p className="text-xs text-text-secondary inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-0.5"><Star className="h-3.5 w-3.5 text-piquet fill-piquet" />{p.rating} ({p.reviewsCount})</span>
                            <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.distanceKm} km</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-text-primary">{formatCurrency(p.fixedPrice)}</p>
                        <p className="text-[10px] text-text-muted uppercase tracking-wide">preço fixo</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {p.topReviews.map((rev, i) => (
                        <p key={i} className="text-xs text-text-secondary rounded-lg bg-surface-subtle px-2.5 py-1.5">“{rev}”</p>
                      ))}
                    </div>
                    {idx === 0 && req.status === "opcoes_enviadas" && (
                      <p className="mt-2 text-xs text-info font-medium">Opção mais barata — em destaque na app do cliente.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-secondary">
            Fluxo: cliente pede → Piquet estima horas → geram-se 3 técnicos com preço fixo e avaliações → cliente escolhe na app → serviço agendado.
          </div>
        </div>
      </div>
    </div>
  );
}
