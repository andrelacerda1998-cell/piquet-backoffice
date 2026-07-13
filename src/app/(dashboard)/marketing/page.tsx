"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, FunnelChartComponent, BarChartComponent, DonutChartComponent } from "@/components/charts/Charts";
import { useAsyncData, useFilters } from "@/hooks/useDashboard";
import { getMarketingMetrics, getCampaigns, getMarketingFunnel, getCreativesPerformance, getChannelBreakdown } from "@/services/marketingService";
import { getLeads, getScripts, type Lead } from "@/services/extrasService";
import { SEED_PUSH, SEED_CODES, PUSH_SEGMENTS, type PushCampaign, type DiscountCode } from "@/services/backofficeService";
import { usePersistentList } from "@/hooks/usePersistentList";
import { Modal, Field } from "@/components/ui/Modal";
import { toast } from "@/stores";
import { buildMetricValue } from "@/lib/calculations";
import { buildMetricFromSeries } from "@/lib/trends";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MessageSquare, BellRing, TicketPercent, Plus, Send } from "lucide-react";
import type { MarketingCampaign } from "@/types";

const LEAD_TONE: Record<Lead["stage"], string> = {
  novo: "bg-info-light text-info",
  contactado: "bg-warning-light text-warning",
  qualificado: "bg-piquet/15 text-piquet-700",
  convertido: "bg-success-light text-success",
  perdido: "bg-danger-light text-danger",
};

export default function MarketingPage() {
  const filters = useFilters();
  const [tab, setTab] = useState("desempenho");
  const { data: metrics } = useAsyncData(() => getMarketingMetrics(filters), [filters]);
  const { data: campaigns } = useAsyncData(() => getCampaigns(), []);
  const { data: funnel } = useAsyncData(() => getMarketingFunnel(), []);
  const { data: creatives } = useAsyncData(() => getCreativesPerformance(), []);
  const { data: leads } = useAsyncData(() => getLeads(), []);
  const { data: scripts } = useAsyncData(() => getScripts(), []);

  const leadColumns: Column<Lead>[] = [
    { key: "name", label: "Lead", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "source", label: "Origem" },
    { key: "city", label: "Cidade" },
    { key: "value", label: "Valor estimado", render: (r) => formatCurrency(r.value) },
    { key: "stage", label: "Fase", render: (r) => <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", LEAD_TONE[r.stage])}>{r.stage}</span> },
    { key: "createdAt", label: "Entrada", sortable: true, render: (r) => formatDate(r.createdAt) },
  ];
  const { data: channels } = useAsyncData(() => getChannelBreakdown(), []);

  const campaignColumns: Column<MarketingCampaign>[] = [
    { key: "platform", label: "Plataforma" },
    { key: "campaignName", label: "Campanha" },
    { key: "investment", label: "Investimento", render: (r) => formatCurrency(r.investment) },
    { key: "impressions", label: "Impressões" },
    { key: "clicks", label: "Cliques" },
    { key: "ctr", label: "CTR", render: (r) => formatPercent(r.ctr) },
    { key: "leads", label: "Leads" },
    { key: "cpl", label: "CPL", render: (r) => formatCurrency(r.cpl) },
    { key: "customers", label: "Clientes" },
    { key: "cac", label: "CAC", render: (r) => formatCurrency(r.cac) },
    { key: "piquetRevenue", label: "Receita Piquet", render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "roas", label: "ROAS", render: (r) => `${r.roas.toFixed(2)}x` },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const creativeColumns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Criativo" },
    { key: "format", label: "Formato" },
    { key: "investment", label: "Investimento", render: (r) => formatCurrency(r.investment as number) },
    { key: "ctr", label: "CTR", render: (r) => formatPercent(r.ctr as number) },
    { key: "cpl", label: "CPL", render: (r) => formatCurrency(r.cpl as number) },
    { key: "cac", label: "CAC", render: (r) => formatCurrency(r.cac as number) },
    { key: "revenue", label: "Receita", render: (r) => formatCurrency(r.revenue as number) },
    { key: "roas", label: "ROAS", render: (r) => `${(r.roas as number).toFixed(2)}x` },
    { key: "recommendation", label: "Recomendação", render: (r) => <StatusBadge status={(r.recommendation as string) === "Escalar" ? "ativo" : (r.recommendation as string) === "Desativar" ? "cancelado_cliente" : "em_analise"} label={r.recommendation as string} /> },
  ];

  const TABS: TabDef[] = [
    { id: "desempenho", label: "Desempenho" },
    { id: "campanhas", label: "Campanhas", count: campaigns?.length },
    { id: "push", label: "Push" },
    { id: "codigos", label: "Códigos de desconto" },
    { id: "criativos", label: "Criativos", count: creatives?.length },
    { id: "crm", label: "CRM & Leads", count: leads?.length },
    { id: "guioes", label: "Guiões e mensagens" },
  ];

  return (
    <RouteGuard route="/marketing">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-text-secondary mt-1">Campanhas, aquisição e ROAS</p>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "desempenho" && (
          <div className="space-y-6">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Investimento" metric={buildMetricFromSeries(metrics.totalInvestment, { key: "mkt:investimento", monthlyGrowth: 0.03 })} format="currency" />
                <MetricCard title="Leads" metric={buildMetricFromSeries(metrics.leads, { key: "mkt:leads", monthlyGrowth: 0.05 })} />
                <MetricCard title="Clientes pagantes" metric={buildMetricFromSeries(metrics.payingCustomers, { key: "mkt:clientes", monthlyGrowth: 0.045 })} />
                <MetricCard title="CPL" metric={buildMetricFromSeries(metrics.cpl, { key: "mkt:cpl", monthlyGrowth: -0.02, invertTrend: true })} format="currency" />
                <MetricCard title="CAC" metric={buildMetricFromSeries(metrics.cac, { key: "mkt:cac", monthlyGrowth: -0.015, invertTrend: true })} format="currency" />
                <MetricCard title="Receita Piquet" metric={buildMetricFromSeries(metrics.piquetRevenue, { key: "mkt:receita", monthlyGrowth: 0.04 })} format="currency" />
                <MetricCard title="ROAS Piquet" metric={buildMetricFromSeries(metrics.roas, { key: "mkt:roas", monthlyGrowth: 0.02 })} />
                <MetricCard title="Campanhas ativas" metric={buildMetricFromSeries(metrics.activeCampaigns, { key: "mkt:campanhas", monthlyGrowth: 0.01, volatility: 0.02 })} />
              </div>
            )}
            <SubTabs
              tabs={[
                { id: "funil", label: "Funil" },
                { id: "canais", label: "Canais" },
                { id: "cac", label: "CAC por canal" },
                { id: "investimento", label: "Investimento" },
              ]}
            >
              {(sub) => (
                <>
                  {sub === "funil" && (
                    <ChartCard title="Funil de marketing">
                      <FunnelChartComponent data={(funnel ?? []).map((s) => ({ name: s.name, count: s.count, conversionRate: s.conversionRate }))} />
                    </ChartCard>
                  )}
                  {sub === "canais" && (
                    <ChartCard title="Performance por canal" subtitle="Investimento vs receita">
                      <BarChartComponent
                        data={(channels ?? []).map((c) => ({ name: c.name, investimento: c.investment, receita: c.revenue }))}
                        bars={[{ key: "investimento", color: "#D6503B", name: "Investimento" }, { key: "receita", color: "#FAB347", name: "Receita" }]}
                        currency
                      />
                    </ChartCard>
                  )}
                  {sub === "cac" && (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">
                        <b className="text-text-primary">CAC = investimento ÷ clientes adquiridos.</b> Custo de aquisição por cliente pagante, por canal.
                      </div>
                      <ChartCard title="CAC por canal" subtitle="Menor é melhor">
                        <BarChartComponent
                          data={(channels ?? []).map((c) => ({ name: c.name, value: (c as { cac?: number }).cac ?? 0 }))}
                          bars={[{ key: "value", color: "#3E7C8C", name: "CAC" }]}
                          currency
                        />
                      </ChartCard>
                      <DataTable
                        columns={[
                          { key: "name", label: "Canal", render: (r) => <span className="font-medium">{r.name as string}</span> },
                          { key: "investment", label: "Investimento", render: (r) => formatCurrency(r.investment as number) },
                          { key: "customers", label: "Clientes", render: (r) => `${(r.customers as number) ?? 0}` },
                          { key: "cac", label: "CAC", render: (r) => <span className="font-semibold">{formatCurrency((r.cac as number) ?? 0)}</span> },
                          { key: "roas", label: "ROAS", render: (r) => `${((r.roas as number) ?? 0).toFixed(2)}x` },
                        ]}
                        data={(channels ?? []) as unknown as Record<string, unknown>[]}
                        keyField="name"
                      />
                    </div>
                  )}
                  {sub === "investimento" && (
                    <ChartCard title="Distribuição do investimento por canal">
                      <DonutChartComponent data={(channels ?? []).map((c) => ({ name: c.name, value: c.investment }))} currency centerLabel="Investido" />
                    </ChartCard>
                  )}
                </>
              )}
            </SubTabs>
          </div>
        )}

        {tab === "campanhas" && (
          <DataTable columns={campaignColumns} data={campaigns ?? []} keyField="id" />
        )}

        {tab === "push" && <PushTab />}
        {tab === "codigos" && <CodigosTab />}

        {tab === "criativos" && (
          <DataTable columns={creativeColumns} data={(creatives ?? []) as unknown as Record<string, unknown>[]} keyField="id" />
        )}

        {tab === "crm" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(["novo", "contactado", "qualificado", "convertido", "perdido"] as Lead["stage"][]).map((st) => (
                <div key={st} className="card p-3">
                  <p className="text-xs text-text-secondary capitalize">{st}</p>
                  <p className="text-xl font-bold text-text-primary">{(leads ?? []).filter((l) => l.stage === st).length}</p>
                </div>
              ))}
            </div>
            <DataTable columns={leadColumns} data={leads ?? []} keyField="id" />
          </div>
        )}

        {tab === "guioes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(scripts ?? []).map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">{s.title}</p>
                    <p className="text-xs text-text-secondary">{s.purpose}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-piquet/15 text-piquet-700">
                    <MessageSquare className="h-3 w-3" />{s.channel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-text-secondary rounded-lg bg-surface-subtle px-3 py-2">{s.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

/* ------------------------------ Push notifications ------------------------------ */

function PushTab() {
  const [campaigns, setCampaigns] = usePersistentList<PushCampaign>("push-campaigns", SEED_PUSH);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", segment: PUSH_SEGMENTS[0] as string, when: "agora" as "agora" | "agendar", scheduledFor: "2026-07-10T10:00" });

  const create = () => {
    if (!form.title.trim() || !form.message.trim()) { toast("Indica o título e a mensagem.", "error"); return; }
    const now = form.when === "agora";
    const c: PushCampaign = {
      id: `push_${Date.now()}`, title: form.title.trim(), message: form.message.trim(), segment: form.segment,
      status: now ? "enviada" : "agendada",
      sentAt: now ? new Date().toISOString() : undefined,
      scheduledFor: now ? undefined : form.scheduledFor,
      delivered: now ? Math.round(300 + Math.random() * 200) : 0,
      deliveryRate: now ? Math.round((92 + Math.random() * 6) * 10) / 10 : 0,
      openRate: now ? Math.round((25 + Math.random() * 20) * 10) / 10 : 0,
      conversions: now ? Math.round(5 + Math.random() * 30) : 0,
    };
    setCampaigns((prev) => [c, ...prev]);
    setOpen(false);
    setForm({ title: "", message: "", segment: PUSH_SEGMENTS[0], when: "agora", scheduledFor: "2026-07-10T10:00" });
    toast(now ? `Push "${c.title}" enviada ao segmento "${c.segment}".` : `Push "${c.title}" agendada.`);
  };

  const pushColumns: Column<PushCampaign>[] = [
    { key: "title", label: "Campanha", render: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-text-muted truncate max-w-[280px]">{r.message}</p></div> },
    { key: "segment", label: "Segmento" },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.status === "enviada" ? "bg-success-light text-success" : r.status === "agendada" ? "bg-info-light text-info" : "bg-surface-subtle text-text-secondary")}>
        {r.status === "enviada" ? "Enviada" : r.status === "agendada" ? "Agendada" : "Rascunho"}
      </span>
    ) },
    { key: "delivered", label: "Entregues", render: (r) => r.status === "enviada" ? `${r.delivered} (${r.deliveryRate}%)` : "—" },
    { key: "openRate", label: "Abertura", render: (r) => r.status === "enviada" ? formatPercent(r.openRate) : "—" },
    { key: "conversions", label: "Conversões", render: (r) => r.status === "enviada" ? `${r.conversions}` : "—" },
    { key: "when", label: "Quando", render: (r) => r.sentAt ? formatDate(r.sentAt) : r.scheduledFor ? `Agendada ${formatDate(r.scheduledFor)}` : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary inline-flex items-center gap-2"><BellRing className="h-4 w-4 text-piquet-600" /> Campanhas push para clientes e técnicos, por segmento.</p>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova campanha</button>
      </div>
      <DataTable columns={pushColumns} data={campaigns} keyField="id" emptyMessage="Sem campanhas push" />

      <Modal open={open} onClose={() => setOpen(false)} title="Nova campanha push" subtitle="Notificação para um segmento"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm"><Send className="h-4 w-4" /> {form.when === "agora" ? "Enviar agora" : "Agendar"}</button>
        </>}>
        <div className="space-y-3">
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Ex.: ☀️ Verão sem avarias" /></Field>
          <Field label="Mensagem"><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-field resize-none" rows={3} placeholder="Texto da notificação (máx. ~140 caracteres)" /></Field>
          <Field label="Segmento"><select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="input-field">
            {PUSH_SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Envio"><select value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value as "agora" | "agendar" })} className="input-field">
              <option value="agora">Enviar imediatamente</option>
              <option value="agendar">Agendar</option>
            </select></Field>
            {form.when === "agendar" && (
              <Field label="Data e hora"><input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} className="input-field" /></Field>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ Códigos de desconto ------------------------------ */

function CodigosTab() {
  const [codes, setCodes] = usePersistentList<DiscountCode>("discount-codes", SEED_CODES);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", kind: "percentagem" as DiscountCode["kind"], value: 10, usageLimit: 200, validUntil: "2026-09-30", categories: "Todas", cities: "Todas" });

  const create = () => {
    if (!form.code.trim()) { toast("Indica o código.", "error"); return; }
    const c: DiscountCode = {
      id: `dc_${Date.now()}`, code: form.code.trim().toUpperCase(), kind: form.kind, value: Number(form.value) || 0,
      usageLimit: Number(form.usageLimit) || 0, used: 0, validUntil: form.validUntil,
      categories: form.categories.trim() || "Todas", cities: form.cities.trim() || "Todas", active: true, revenue: 0,
    };
    setCodes((prev) => [c, ...prev]);
    setOpen(false);
    setForm({ code: "", kind: "percentagem", value: 10, usageLimit: 200, validUntil: "2026-09-30", categories: "Todas", cities: "Todas" });
    toast(`Código ${c.code} criado e ativo.`);
  };

  const toggle = (id: string) => {
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
    const c = codes.find((x) => x.id === id);
    toast(`Código ${c?.code} ${c?.active ? "desativado" : "ativado"}.`, c?.active ? "info" : "success");
  };

  const codeColumns: Column<DiscountCode>[] = [
    { key: "code", label: "Código", render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: "value", label: "Desconto", render: (r) => r.kind === "percentagem" ? `${r.value}%` : formatCurrency(r.value) },
    { key: "used", label: "Utilizações", render: (r) => `${r.used}/${r.usageLimit}` },
    { key: "revenue", label: "Receita gerada", sortable: true, render: (r) => formatCurrency(r.revenue) },
    { key: "categories", label: "Categorias" },
    { key: "cities", label: "Cidades" },
    { key: "validUntil", label: "Válido até", render: (r) => formatDate(r.validUntil) },
    { key: "active", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", r.active ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
        {r.active ? "Ativo" : "Inativo"}
      </span>
    ) },
    { key: "acao", label: "", render: (r) => (
      <button onClick={() => toggle(r.id)} className={cn("text-xs hover:underline", r.active ? "text-danger" : "text-success")}>
        {r.active ? "Desativar" : "Ativar"}
      </button>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary inline-flex items-center gap-2"><TicketPercent className="h-4 w-4 text-piquet-600" /> Códigos promocionais — valor fixo ou percentagem, com limite e validade.</p>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo código</button>
      </div>
      <DataTable columns={codeColumns} data={codes} keyField="id" emptyMessage="Sem códigos de desconto" />

      <Modal open={open} onClose={() => setOpen(false)} title="Novo código de desconto"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm">Criar código</button>
        </>}>
        <div className="space-y-3">
          <Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="VERAO25" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo"><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DiscountCode["kind"] })} className="input-field">
              <option value="percentagem">Percentagem (%)</option>
              <option value="valor_fixo">Valor fixo (€)</option>
            </select></Field>
            <Field label={form.kind === "percentagem" ? "Desconto (%)" : "Desconto (€)"}><input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input-field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Limite de utilizações"><input type="number" min={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} className="input-field" /></Field>
            <Field label="Válido até"><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="input-field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categorias" hint="Ex.: AVAC, Limpeza — ou Todas"><input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} className="input-field" /></Field>
            <Field label="Cidades" hint="Ex.: Lisboa, Cascais — ou Todas"><input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} className="input-field" /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
