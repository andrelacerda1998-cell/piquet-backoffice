"use client";

import { useState, useEffect } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, FunnelChartComponent, BarChartComponent, DonutChartComponent } from "@/components/charts/Charts";
import { useAsyncData, useFilters } from "@/hooks/useDashboard";
import { useTabParam } from "@/hooks/useTabParam";
import { getMarketingMetrics, getCampaigns, getMarketingFunnel, getCreativesPerformance, getChannelBreakdown } from "@/services/marketingService";
import { getLeads, getScripts, updateLead, createLead, deleteLead, LEAD_STAGES, LEAD_STAGE_LABEL, type Lead, type LeadStage, type LeadPatch } from "@/services/extrasService";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { SEED_PUSH, SEED_CODES, PUSH_SEGMENTS, type PushCampaign, type DiscountCode } from "@/services/backofficeService";
import { usePersistentList } from "@/hooks/usePersistentList";
import { Modal, Field } from "@/components/ui/Modal";
import { toast } from "@/stores";
import { buildMetricValue } from "@/lib/calculations";
import { buildMetricFromSeries } from "@/lib/trends";
import { formatCurrency, formatPercent, formatDate, getStatusColor } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MessageSquare, BellRing, TicketPercent, Plus, Send, Trash2 } from "lucide-react";
import type { MarketingCampaign } from "@/types";

/**
 * Classificação de uma campanha pelo retorno (ROAS = receita ÷ investimento).
 *
 * Regra honesta: sem conversões medidas (nem receita nem clientes atribuídos)
 * NÃO classificamos como "Má" — não há como julgar. Campanhas de notoriedade
 * ou sem tracking de conversões ficam "Sem dados" até haver o que medir.
 */
type CampaignRating = "excelente" | "bom" | "media" | "ma" | "sem_dados";

function rateCampaign(c: MarketingCampaign): CampaignRating {
  if (!c.piquetRevenue && !c.customers) return "sem_dados";
  if (c.roas >= 3) return "excelente";   // devolve 3× ou mais do investido
  if (c.roas >= 1.5) return "bom";       // lucrativa com margem confortável
  if (c.roas >= 1) return "media";       // paga-se a si própria
  return "ma";                            // gasta mais do que devolve
}

const RATING: Record<CampaignRating, { label: string; tone: string; hint: string }> = {
  excelente: { label: "Excelente", tone: "bg-success-light text-success", hint: "ROAS ≥ 3× — escalar" },
  bom: { label: "Bom", tone: "bg-piquet/15 text-piquet-700", hint: "ROAS 1,5×–3× — manter" },
  media: { label: "Média", tone: "bg-warning-light text-warning", hint: "ROAS 1×–1,5× — otimizar" },
  ma: { label: "Má", tone: "bg-danger-light text-danger", hint: "ROAS < 1× — dá prejuízo" },
  sem_dados: { label: "Sem dados", tone: "bg-surface-subtle text-text-secondary", hint: "Sem conversões medidas — não avaliável por ROAS" },
};

export default function MarketingPage() {
  const filters = useFilters();
  // ?tab= no URL (deep-link das notificações de leads → /marketing?tab=crm).
  const [tab, setTab] = useTabParam("desempenho");
  const { data: metrics } = useAsyncData(() => getMarketingMetrics(filters), [filters]);
  const { data: campaigns } = useAsyncData(() => getCampaigns(), []);
  const { data: funnel } = useAsyncData(() => getMarketingFunnel(), []);
  const { data: creatives } = useAsyncData(() => getCreativesPerformance(), []);
  const { data: leads } = useAsyncData(() => getLeads(), []);
  const { data: scripts } = useAsyncData(() => getScripts(), []);

  // Estado local dos pedidos, para editar (com feedback otimista).
  const [leadRows, setLeadRows] = useState<Lead[]>([]);
  useEffect(() => { setLeadRows(leads ?? []); }, [leads]);

  // Editar pedido (dados + orçamento + valor do técnico + data + classificação + estado).
  // Modelo: escreve-se o orçamento e o valor do técnico; a margem é sempre orçamento − técnico.
  const EMPTY_EDIT = { name: "", phone: "", city: "", message: "", technicianName: "", categoryId: "", quoteValue: "", technicianValue: "", executionDate: "", rating: "", stage: "nao_iniciado" as LeadStage };
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const openEdit = (lead: Lead, presetStage?: LeadStage) => {
    const q = lead.quoteValue, tv = lead.technicianValue;
    // Valor do técnico é o campo editável; por omissão 75% do orçamento (margem 25%).
    const techDefault = tv != null ? tv : (q != null ? Math.round(q * 0.75 * 100) / 100 : null);
    setEditForm({
      name: lead.name === "—" ? "" : lead.name || "",
      phone: lead.phone || "",
      city: lead.city === "—" ? "" : lead.city || "",
      message: lead.message || "",
      technicianName: lead.technicianName || "",
      categoryId: lead.categoryId || "",
      quoteValue: q != null ? String(q) : "",
      technicianValue: techDefault != null ? String(techDefault) : "",
      executionDate: lead.executionDate ? lead.executionDate.slice(0, 10) : "",
      rating: lead.rating != null ? String(lead.rating) : "",
      stage: presetStage ?? lead.stage,
    });
    setEditing(lead);
  };
  const saveEdit = async () => {
    if (!editing) return;
    const q = editForm.quoteValue.trim() === "" ? null : Number(editForm.quoteValue);
    // O técnico é o valor introduzido; por omissão 75% do orçamento. Margem = orçamento − técnico.
    const techValue = editForm.technicianValue.trim() !== ""
      ? Number(editForm.technicianValue)
      : (q != null ? Math.round(q * 0.75 * 100) / 100 : null);
    const patch: LeadPatch = {
      name: editForm.name.trim(), phone: editForm.phone.trim(), city: editForm.city.trim(),
      message: editForm.message.trim(), technicianName: editForm.technicianName.trim(),
      categoryId: editForm.categoryId, quoteValue: q, technicianValue: techValue,
      executionDate: editForm.executionDate || "",
      rating: editForm.rating.trim() === "" ? null : Number(editForm.rating),
      stage: editForm.stage,
    };
    try {
      const { serviceId } = await updateLead(editing.id, patch);
      setLeadRows(await getLeads());
      setEditing(null);
      toast(serviceId ? "Concluído — serviço criado em Operações." : "Pedido atualizado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível guardar.", "error");
    }
  };

  // Mudança rápida de estado pela tabela. Concluir passa pelo editar (precisa de
  // técnico + valor para criar o serviço).
  const changeStage = async (lead: Lead, stage: LeadStage) => {
    if (stage === "concluido") { openEdit(lead, "concluido"); return; }
    setLeadRows((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    try {
      await updateLead(lead.id, { stage });
      toast(`Estado atualizado para "${LEAD_STAGE_LABEL[stage]}".`);
    } catch {
      setLeadRows((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: lead.stage } : l)));
      toast("Não foi possível atualizar o estado.", "error");
    }
  };

  // Eliminar um pedido (com confirmação; o serviço em Operações não é afetado).
  const removeLead = async (lead: Lead) => {
    const label = lead.name || lead.phone || "este pedido";
    const aviso = lead.serviceId ? "\n\nO serviço já criado em Operações NÃO é afetado." : "";
    if (!window.confirm(`Eliminar o pedido de "${label}"?${aviso}`)) return;
    const prev = leadRows;
    setLeadRows((rows) => rows.filter((l) => l.id !== lead.id));
    try {
      await deleteLead(lead.id);
      toast("Pedido eliminado.");
    } catch {
      setLeadRows(prev);
      toast("Não foi possível eliminar o pedido.", "error");
    }
  };

  // Registo manual de um pedido (ex.: recebido pela app do WhatsApp).
  const [showLead, setShowLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", city: "", message: "" });
  const submitLead = async () => {
    if (!leadForm.name.trim() && !leadForm.phone.trim()) { toast("Indica o nome ou o telefone.", "info"); return; }
    try {
      const created = await createLead({ ...leadForm, source: "whatsapp" });
      setLeadRows((prev) => [created, ...prev]);
      setLeadForm({ name: "", phone: "", city: "", message: "" });
      setShowLead(false);
      toast("Pedido registado no CRM.");
    } catch {
      toast("Não foi possível registar o pedido.", "error");
    }
  };

  const leadColumns: Column<Lead>[] = [
    { key: "name", label: "Contacto", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "phone", label: "Telefone", render: (r) => r.phone || "—" },
    { key: "message", label: "Pedido", render: (r) => <span className="block max-w-[220px] truncate text-text-secondary" title={r.message}>{r.message || "—"}</span> },
    { key: "quoteValue", label: "Orçamento", render: (r) => r.quoteValue != null ? (
      <span>{formatCurrency(r.quoteValue)}
        {r.technicianValue != null && <span className="block text-xs text-text-muted">margem {formatCurrency(r.quoteValue - r.technicianValue)}</span>}
      </span>
    ) : <span className="text-text-muted">—</span> },
    { key: "stage", label: "Estado", render: (r) => (
      <select value={r.stage} onChange={(e) => changeStage(r, e.target.value as LeadStage)}
        className={cn("text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-piquet", getStatusColor(r.stage))}>
        {LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    ) },
    { key: "acoes", label: "", render: (r) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openEdit(r)} className="btn-secondary text-xs py-1">Editar</button>
        {r.serviceId && <span title="Serviço criado em Operações" className="text-xs text-success">✓ serviço</span>}
        <button onClick={() => removeLead(r)} title="Eliminar pedido" className="text-text-muted hover:text-danger transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) },
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
    { key: "rating", label: "Classificação", render: (r) => {
      const c = RATING[rateCampaign(r)];
      return <span title={c.hint} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-help", c.tone)}>{c.label}</span>;
    } },
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
    { id: "comunicacao", label: "Comunicação" },
    { id: "crm", label: "CRM & Leads", count: leads?.length },
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
          <SubTabs tabs={[{ id: "campanhas", label: "Campanhas" }, { id: "criativos", label: "Criativos" }]}>
            {(sub) => (
              <>
                {sub === "campanhas" && (
                  <div className="space-y-3">
                    {/* Legenda dos critérios de classificação (baseados no ROAS). */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <span className="font-medium">Classificação por retorno (ROAS):</span>
                      {(["excelente", "bom", "media", "ma", "sem_dados"] as CampaignRating[]).map((k) => (
                        <span key={k} className="inline-flex items-center gap-1.5">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full font-medium", RATING[k].tone)}>{RATING[k].label}</span>
                          <span className="text-text-muted">{RATING[k].hint}</span>
                        </span>
                      ))}
                    </div>
                    <DataTable columns={campaignColumns} data={campaigns ?? []} keyField="id" />
                  </div>
                )}
                {sub === "criativos" && (
                  <DataTable columns={creativeColumns} data={(creatives ?? []) as unknown as Record<string, unknown>[]} keyField="id" />
                )}
              </>
            )}
          </SubTabs>
        )}

        {tab === "comunicacao" && (
          <SubTabs tabs={[
            { id: "push", label: "Push" },
            { id: "codigos", label: "Códigos de desconto" },
            { id: "guioes", label: "Guiões e mensagens" },
          ]}>
            {(sub) => (
              <>
                {sub === "push" && <PushTab />}
                {sub === "codigos" && <CodigosTab />}
                {sub === "guioes" && (
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
              </>
            )}
          </SubTabs>
        )}

        {tab === "crm" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-text-secondary max-w-2xl">
                Pedidos de serviço recebidos do formulário da landing (piquetapp.com) e do WhatsApp.
                Muda o estado de cada pedido à medida que avança.
              </p>
              <button onClick={() => setShowLead(true)} className="btn-primary text-sm shrink-0">Registar pedido</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {LEAD_STAGES.map((s) => (
                <div key={s.id} className="card p-3">
                  <p className="text-xs text-text-secondary">{s.label}</p>
                  <p className="text-xl font-bold text-text-primary">{leadRows.filter((l) => l.stage === s.id).length}</p>
                </div>
              ))}
            </div>
            <DataTable columns={leadColumns} data={leadRows} keyField="id"
              emptyMessage="Sem pedidos ainda — chegam aqui assim que a landing ou o WhatsApp enviarem." />
          </div>
        )}

      </div>

      <Modal
        open={showLead}
        onClose={() => setShowLead(false)}
        title="Registar pedido"
        subtitle="Um pedido recebido por WhatsApp ou telefone. Entra no CRM como “Não iniciado”."
        footer={
          <>
            <button onClick={() => setShowLead(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={submitLead} className="btn-primary text-sm">Registar</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">
            <input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} placeholder="Nome do cliente" className="input-field" />
          </Field>
          <Field label="Telefone">
            <input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="912 000 000" className="input-field" />
          </Field>
          <Field label="Cidade">
            <input value={leadForm.city} onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })} placeholder="Ex.: Almada" className="input-field" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Pedido">
              <textarea value={leadForm.message} onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })} rows={3} placeholder="O que o cliente precisa" className="input-field" />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Editar pedido — dados, orçamento, margem, execução, classificação, estado */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar pedido"
        subtitle={editForm.stage === "concluido"
          ? "Ao guardar como “Concluído”, cria-se o serviço em Operações (conta no GMV, Técnicos e Clientes)."
          : "Atualiza os dados e o estado do pedido."}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveEdit} className="btn-primary text-sm">Guardar</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome do cliente">
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" />
          </Field>
          <Field label="Telefone">
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-field" />
          </Field>
          <Field label="Cidade">
            <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="input-field" />
          </Field>
          <Field label="Estado">
            <select value={editForm.stage} onChange={(e) => setEditForm({ ...editForm, stage: e.target.value as LeadStage })} className="input-field">
              {LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Mensagem recebida (landing / WhatsApp)">
              {editForm.message.trim()
                ? <p className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2 text-sm text-text-primary whitespace-pre-wrap">{editForm.message}</p>
                : <p className="text-sm text-text-muted">Sem mensagem registada.</p>}
            </Field>
          </div>
          <Field label="Técnico">
            <input value={editForm.technicianName} onChange={(e) => setEditForm({ ...editForm, technicianName: e.target.value })} placeholder="Nome do técnico" className="input-field" />
          </Field>
          <Field label="Categoria">
            <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })} className="input-field">
              <option value="">—</option>
              {DEFAULT_SETTINGS.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Valor do orçamento (€)">
            <input type="number" step="0.01" min="0" value={editForm.quoteValue}
              onChange={(e) => {
                const v = e.target.value;
                const q = v.trim() === "" ? null : Number(v);
                // Sugere 75% ao técnico enquanto não for definido à mão (margem 25%).
                setEditForm((f) => ({ ...f, quoteValue: v, technicianValue: f.technicianValue.trim() === "" && q != null ? String(Math.round(q * 0.75 * 100) / 100) : f.technicianValue }));
              }}
              placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Valor a pagar ao técnico (€)">
            <input type="number" step="0.01" min="0" value={editForm.technicianValue}
              onChange={(e) => setEditForm({ ...editForm, technicianValue: e.target.value })} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Data de execução">
            <input type="date" value={editForm.executionDate} onChange={(e) => setEditForm({ ...editForm, executionDate: e.target.value })} className="input-field" />
          </Field>
          <Field label="Classificação (1–5)">
            <select value={editForm.rating} onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })} className="input-field">
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </Field>
        </div>
        {editForm.quoteValue.trim() !== "" && (() => {
          const q = Number(editForm.quoteValue) || 0;
          const tech = editForm.technicianValue.trim() !== "" ? (Number(editForm.technicianValue) || 0) : q * 0.75;
          const margin = Math.max(0, q - tech);
          const pct = q > 0 ? (margin / q) * 100 : 0;
          return (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-piquet/10 border border-piquet/20 px-4 py-3">
              <div>
                <p className="text-xs text-text-muted">Margem da Piquet (calculada automaticamente)</p>
                <p className="text-xl font-bold text-text-primary">{formatCurrency(margin)} <span className="text-sm font-normal text-text-secondary">· {pct.toFixed(0)}%</span></p>
              </div>
              <p className="text-xs text-text-secondary text-right leading-relaxed">
                Orçamento {formatCurrency(q)}<br />− Técnico {formatCurrency(tech)}
              </p>
            </div>
          );
        })()}
      </Modal>
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
