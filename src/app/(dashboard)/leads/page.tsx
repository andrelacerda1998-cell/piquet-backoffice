"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useAsyncData } from "@/hooks/useDashboard";
import { getLeads, updateLead, createLead, deleteLead, LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_STAGES_SEM_RECEITA, type Lead, type LeadStage, type LeadPatch } from "@/services/extrasService";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { categoryName } from "@/lib/categories";
import { Modal, Field } from "@/components/ui/Modal";
import { toast } from "@/stores";
import { formatCurrency, formatPercent, formatDate, getStatusColor } from "@/lib/formatters";
import { cn, downloadCsv } from "@/lib/utils";
import { Trash2, Search, MessageCircle, Headphones } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * A landing escreve "Serviço: X · Urgência: Y\n<descrição>". Separa as partes
 * para mostrar a descrição limpa (a categoria já vai na sua coluna) e assinalar
 * as leads urgentes.
 */
function parseLeadMessage(message: string): { service: string; urgency: string; description: string; urgent: boolean } {
  const service = message.match(/servi[çc]o:\s*([^·\n]+)/i)?.[1]?.trim() ?? "";
  const urgency = message.match(/urg[êe]ncia:\s*([^\n·]+)/i)?.[1]?.trim() ?? "";
  const nl = message.indexOf("\n");
  const description = nl >= 0 ? message.slice(nl + 1).trim() : "";
  const urgent = /urgente|hoje|emerg|imediat|agora/i.test(urgency);
  return { service, urgency, description, urgent };
}

/** Link click-to-chat do WhatsApp a partir de um número (só dígitos). */
const waHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;


/**
 * CRM de pedidos de serviço — leads da landing (piquetapp.com) e do WhatsApp.
 * Casa própria (antes vivia numa aba do Marketing): é trabalho diário de
 * comercial, não análise de campanhas.
 */
function LeadsPageInner() {
  const { data: leads } = useAsyncData(() => getLeads(), []);

  // Estado local dos pedidos, para editar (com feedback otimista).
  const [leadRows, setLeadRows] = useState<Lead[]>([]);
  useEffect(() => { setLeadRows(leads ?? []); }, [leads]);

  // Filtros do CRM: pesquisa livre + mês + estado + categoria + origem.
  const [leadSearch, setLeadSearch] = useState("");
  // Por omissão mostra o mês atual (o trabalho do dia-a-dia); "" = todos.
  const [leadMonth, setLeadMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  // Estado: "" = ativos (esconde recusados, que só sujam a lista de trabalho);
  // "todos" = inclui recusados; ou um estado concreto.
  const [leadStage, setLeadStage] = useState<"" | "todos" | LeadStage>("");
  const [leadCategory, setLeadCategory] = useState("");
  const [leadSource, setLeadSource] = useState("");
  // O mês atual está sempre na lista (mesmo sem leads), por ser o valor por omissão.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const leadMonths = Array.from(new Set([currentMonth, ...leadRows.map((l) => (l.createdAt || "").slice(0, 7))].filter(Boolean))).sort().reverse();
  const leadSources = Array.from(new Set(leadRows.map((l) => l.source).filter(Boolean))).sort();

  // Filtros exceto o estado — servem de base às contagens por estado (para se
  // ver a distribuição e clicar num estado para filtrar).
  const q = leadSearch.trim().toLowerCase();
  const matchesBase = (l: Lead) => {
    if (leadMonth && (l.createdAt || "").slice(0, 7) !== leadMonth) return false;
    if (leadCategory && l.categoryId !== leadCategory) return false;
    if (leadSource && l.source !== leadSource) return false;
    if (q && !`${l.name} ${l.phone} ${l.message} ${l.city}`.toLowerCase().includes(q)) return false;
    return true;
  };
  const baseFiltered = leadRows.filter(matchesBase);
  // Urgentes primeiro (o que precisa de resposta hoje), depois as mais recentes.
  const byUrgencyThenDate = (a: Lead, b: Lead) => {
    const ua = parseLeadMessage(a.message || "").urgent ? 1 : 0;
    const ub = parseLeadMessage(b.message || "").urgent ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  };
  /**
   * Por omissão a lista mostra só o que está NA MÃO DA EQUIPA: pedidos novos e
   * orçamentos enviados à espera de resposta. Aceites, executados, recusados e
   * reembolsados são consulta, não trabalho — aparecem pelo filtro de estado
   * ou pelos cartões. O que fica oculto é dito por baixo da lista, para não
   * parecer que desapareceu.
   */
  const ESTADOS_ATIVOS: LeadStage[] = ["nao_iniciado", "orcamento_enviado"];
  const byStage = leadStage === ""
    ? baseFiltered.filter((l) => ESTADOS_ATIVOS.includes(l.stage))
    : leadStage === "todos"
      ? baseFiltered
      : baseFiltered.filter((l) => l.stage === leadStage);
  const filteredLeads = byStage.slice().sort(byUrgencyThenDate);
  const escondidas = leadStage === "" ? baseFiltered.length - byStage.length : 0;
  // O mês atual é o estado por omissão — só conta como filtro se for outro mês.
  const hasActiveFilters = !!(leadSearch || (leadMonth && leadMonth !== currentMonth) || leadStage || leadCategory || leadSource);
  const clearFilters = () => { setLeadSearch(""); setLeadMonth(currentMonth); setLeadStage(""); setLeadCategory(""); setLeadSource(""); };

  // Possíveis duplicados: mesma pessoa + mesmo pedido. Marca todas exceto a
  // primeira do grupo (o formulário costuma disparar o POST duas vezes).
  const leadKey = (l: Lead) => `${(l.phone || l.name || "").toLowerCase().trim()}|${(l.message || "").trim()}`;
  const firstByKey = new Map<string, string>();
  for (const l of leadRows) {
    const k = leadKey(l);
    const cur = firstByKey.get(k);
    if (!cur || (l.createdAt || "") < cur) firstByKey.set(k, l.createdAt || "");
  }
  const keyCount = leadRows.reduce((m, l) => m.set(leadKey(l), (m.get(leadKey(l)) ?? 0) + 1), new Map<string, number>());
  const isDuplicate = (l: Lead) => (keyCount.get(leadKey(l)) ?? 0) > 1 && (l.createdAt || "") !== firstByKey.get(leadKey(l));
  const dupCount = filteredLeads.filter(isDuplicate).length;

  // Números do CRM do período. Deliberadamente calculados sobre TODAS as leads
  // (baseFiltered), incluindo as recusadas: esconder recusadas da lista é uma
  // ajuda de trabalho, mas tirá-las do denominador inflacionaria a conversão.
  const crm = (() => {
    const total = baseFiltered.length;
    const executadas = baseFiltered.filter((l) => l.stage === "concluido");
    const porResponder = baseFiltered.filter((l) => l.stage === "nao_iniciado").length;
    // Reembolsados: o serviço chegou a fechar e o dinheiro foi devolvido. Não
    // entram no pipeline (já não podem fechar), não contam como executados, e
    // o que se devolveu aparece à parte para não desaparecer da conta.
    const reembolsadas = baseFiltered.filter((l) => l.stage === "reembolsado");
    const valorReembolsado = reembolsadas.reduce((acc, l) => acc + (l.quoteValue ?? 0), 0);
    // Pipeline = só o que ainda pode fechar (recusados e reembolsados não).
    const emAberto = baseFiltered.filter((l) => !LEAD_STAGES_SEM_RECEITA.includes(l.stage));
    const pipeline = emAberto.reduce((acc, l) => acc + (l.quoteValue ?? 0), 0);
    const comissao = emAberto.reduce(
      (acc, l) => acc + (l.quoteValue != null ? l.quoteValue - (l.technicianValue ?? 0) : 0), 0);
    const ganho = executadas.reduce((acc, l) => acc + (l.quoteValue ?? 0), 0);
    return {
      total, porResponder, pipeline, comissao, ganho,
      executadas: executadas.length,
      reembolsadas: reembolsadas.length,
      valorReembolsado,
      conversao: total ? (executadas.length / total) * 100 : 0,
    };
  })();

  /** Exporta as leads visíveis (respeita os filtros) para CSV. */
  const exportLeads = () => {
    if (filteredLeads.length === 0) { toast("Sem pedidos para exportar.", "error"); return; }
    downloadCsv(
      `crm-leads-${leadMonth || "todos"}.csv`,
      ["Recebida", "Contacto", "Telefone", "Cidade", "Categoria", "Pedido", "Observações", "Estado", "Orçamento (€)", "Técnico (€)", "Comissão (€)", "Origem"],
      filteredLeads.map((l) => [
        l.createdAt ? formatDate(l.createdAt) : "",
        l.name, l.phone || "", l.city || "",
        categoryName(l.categoryId) || "",
        (l.message || "").replace(/\n/g, " · "),
        (l.notes || "").replace(/\n/g, " · "),
        LEAD_STAGE_LABEL[l.stage] ?? l.stage,
        l.quoteValue != null ? String(l.quoteValue) : "",
        l.technicianValue != null ? String(l.technicianValue) : "",
        l.quoteValue != null ? String(Math.round((l.quoteValue - (l.technicianValue ?? 0)) * 100) / 100) : "",
        l.source || "",
      ]),
    );
    toast(`${filteredLeads.length} pedido(s) exportado(s).`);
  };

  const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    const name = MONTH_NAMES[Number(m) - 1] ?? ym;
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
  };

  // Editar pedido (dados + orçamento + valor do técnico + data + classificação + estado).
  // Modelo: escreve-se o orçamento e o valor do técnico; a margem é sempre orçamento − técnico.

  const EMPTY_EDIT = { name: "", phone: "", city: "", message: "", notes: "", technicianName: "", categoryId: "", quoteValue: "", technicianValue: "", executionDate: "", rating: "", stage: "nao_iniciado" as LeadStage };
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  /**
   * `?lead=<id>` — vindo de um alerta ("Lead sem resposta há 3 dias"). Abrir a
   * página no CRM não chegava: com dezenas de pedidos, encontrar aquele à mão
   * é o trabalho todo. Corre uma vez, quando os dados já cá estão.
   */
  const leadParam = useSearchParams().get("lead");
  const abriuDoUrl = useRef(false);
  useEffect(() => {
    if (abriuDoUrl.current || !leadParam || leadRows.length === 0) return;
    const alvo = leadRows.find((l) => l.id === leadParam);
    if (!alvo) return;
    abriuDoUrl.current = true;
    openEdit(alvo);
  }, [leadParam, leadRows]);

  const openEdit = (lead: Lead, presetStage?: LeadStage) => {
    const q = lead.quoteValue, tv = lead.technicianValue;
    // Valor do técnico é o campo editável; por omissão 75% do orçamento (margem 25%).
    const techDefault = tv != null ? tv : (q != null ? Math.round(q * 0.75 * 100) / 100 : null);
    setEditForm({
      name: lead.name === "—" ? "" : lead.name || "",
      phone: lead.phone || "",
      city: lead.city === "—" ? "" : lead.city || "",
      message: lead.message || "",
      notes: lead.notes || "",
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
      message: editForm.message.trim(), notes: editForm.notes.trim(),
      technicianName: editForm.technicianName.trim(),
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
    { key: "name", label: "Contacto", sortable: true, render: (r) => (
      <div className="min-w-0">
        <p className="font-medium text-text-primary truncate">{r.name}</p>
        {r.phone && (
          <div className="mt-0.5 flex items-center gap-1.5">
            <a href={`tel:${r.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} className="text-xs text-text-secondary hover:text-piquet-700 hover:underline">{r.phone}</a>
            <a href={waHref(r.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Abrir conversa no WhatsApp" className="text-success hover:text-success/80">
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    ) },
    { key: "createdAt", label: "Recebida", render: (r) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-secondary">
        {r.createdAt ? formatDate(r.createdAt) : "—"}
        {isDuplicate(r) && (
          <span title="Mesmo contacto e pedido de outra lead — possível duplicado"
            className="inline-flex items-center rounded-full bg-warning-light px-1.5 py-0.5 text-[10px] font-semibold text-warning">
            dup?
          </span>
        )}
      </span>
    ) },
    { key: "message", label: "Pedido", render: (r) => {
      const { service, urgency, description, urgent } = parseLeadMessage(r.message || "");
      const catName = categoryName(r.categoryId);
      // Descrição livre; senão o serviço (só se a categoria não ficou preenchida, p/ não repetir).
      const primary = description || (r.categoryId ? "" : service);
      return (
        <div className="max-w-[300px]">
          {(catName || urgent) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {catName && <span className="inline-flex items-center rounded-full bg-piquet/12 px-2 py-0.5 text-xs font-medium text-piquet-700">{catName}</span>}
              {urgent && <span title={urgency} className="inline-flex items-center rounded-full bg-danger-light px-1.5 py-0.5 text-[10px] font-semibold text-danger">Urgente</span>}
            </div>
          )}
          {primary
            ? <p className={cn("truncate text-sm text-text-secondary", (catName || urgent) && "mt-0.5")} title={r.message || undefined}>{primary}</p>
            : (!catName && !urgent) && <span className="text-text-muted">—</span>}
        </div>
      );
    } },
    { key: "quoteValue", label: "Orçamento", render: (r) => r.quoteValue != null ? (
      <span className="whitespace-nowrap">{formatCurrency(r.quoteValue)}
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
      <div className="flex items-center justify-end gap-1.5">
        {r.serviceId && <span title="Serviço criado em Operações" className="text-xs text-success mr-1">✓ serviço</span>}
        <button onClick={() => openEdit(r)} className="btn-secondary text-xs py-1">Editar</button>
        <button onClick={() => removeLead(r)} title="Eliminar pedido"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger-light hover:text-danger transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) },
  ];

  return (
    <RouteGuard route="/leads">
      <div className="space-y-6">
        <PageHeader
          icon={Headphones}
          eyebrow="Crescimento"
          title="CRM & Leads"
          subtitle="Pedidos recebidos da landing e do WhatsApp — do primeiro contacto ao serviço executado."
        />

          <div className="space-y-4">
            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={exportLeads} className="btn-secondary text-sm">Exportar CSV</button>
                <button onClick={() => setShowLead(true)} className="btn-primary text-sm">Registar pedido</button>
              </div>
            </div>

            {/* Números do período filtrado — valor do pipeline e o que falta responder. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="card p-4">
                <p className="text-xs text-text-secondary">Valor em pipeline</p>
                <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(crm.pipeline)}</p>
                <p className="text-[11px] text-text-muted mt-0.5">soma dos orçamentos</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-secondary">Comissão prevista</p>
                <p className="mt-1 text-2xl font-bold text-success tabular-nums">{formatCurrency(crm.comissao)}</p>
                <p className="text-[11px] text-text-muted mt-0.5">orçamento − técnico</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-secondary">Taxa de conversão</p>
                <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{formatPercent(Math.round(crm.conversao * 10) / 10)}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{crm.executadas} de {crm.total} executadas</p>
              </div>
              <div className={cn("card p-4", crm.porResponder > 0 && "border-l-[3px] border-l-warning")}>
                <p className="text-xs text-text-secondary">Por responder</p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums", crm.porResponder > 0 ? "text-warning" : "text-text-primary")}>{crm.porResponder}</p>
                <p className="text-[11px] text-text-muted mt-0.5">no estado &quot;Novo&quot;</p>
              </div>
            </div>

            {/* Barra de filtros: pesquisa + mês + estado + categoria + origem. */}
            <div className="card p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Pesquisar nome, telefone, pedido…" className="input-field pl-9" aria-label="Pesquisar pedidos" />
                </div>
                <select value={leadMonth} onChange={(e) => setLeadMonth(e.target.value)} className="input-field w-auto" aria-label="Filtrar por mês">
                  <option value="">Todos os meses</option>
                  {leadMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <select value={leadStage} onChange={(e) => setLeadStage(e.target.value as "" | "todos" | LeadStage)} className="input-field w-auto" aria-label="Filtrar por estado">
                  <option value="">A trabalhar (novos + orçamento enviado)</option>
                  <option value="todos">Todos os estados</option>
                  {LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select value={leadCategory} onChange={(e) => setLeadCategory(e.target.value)} className="input-field w-auto" aria-label="Filtrar por categoria">
                  <option value="">Todas as categorias</option>
                  {DEFAULT_SETTINGS.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {leadSources.length > 1 && (
                  <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} className="input-field w-auto" aria-label="Filtrar por origem">
                    <option value="">Todas as origens</option>
                    {leadSources.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                )}
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
                    <Trash2 className="h-3.5 w-3.5" /> Limpar filtros
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-text-secondary">
                  <b className="text-text-primary tabular-nums">{filteredLeads.length}</b> {filteredLeads.length === 1 ? "lead" : "leads"}
                  {hasActiveFilters ? " (filtrado)" : leadMonth ? ` em ${monthLabel(leadMonth)}` : " no total"}
                </span>
                {dupCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-0.5 text-xs font-medium text-warning" title="Leads com o mesmo contacto e pedido de outra — provavelmente o formulário enviou duas vezes.">
                    {dupCount} possíve{dupCount === 1 ? "l" : "is"} duplicado{dupCount === 1 ? "" : "s"}
                  </span>
                )}
                {escondidas > 0 && (
                  <button onClick={() => setLeadStage("todos")}
                    className="text-xs text-text-muted hover:text-text-primary underline decoration-dotted underline-offset-2">
                    +{escondidas} noutros estados (aceites, executados, recusados…) — mostrar todos
                  </button>
                )}
              </div>
            </div>

            {/* Cartões de estado — clicáveis para filtrar por esse estado. */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {LEAD_STAGES.map((s) => {
                const active = leadStage === s.id;
                return (
                  <button key={s.id} onClick={() => setLeadStage(active ? "" : s.id)}
                    className={cn("card p-3 text-left transition-shadow hover:shadow-elevated",
                      active && "ring-2 ring-piquet border-piquet")}>
                    <p className="text-xs text-text-secondary">{s.label}</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">{baseFiltered.filter((l) => l.stage === s.id).length}</p>
                  </button>
                );
              })}
            </div>
            <DataTable columns={leadColumns} data={filteredLeads} keyField="id"
              emptyMessage={hasActiveFilters ? "Nenhum pedido corresponde aos filtros." : "Sem pedidos ainda — chegam aqui assim que a landing ou o WhatsApp enviarem."} />
          </div>
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
        subtitle={
          editForm.stage === "concluido"
            ? "Ao guardar como “Executado”, cria-se o serviço em Operações (conta no GMV, Técnicos e Clientes)."
            : editForm.stage === "reembolsado"
              ? "Ao guardar como “Reembolsado”, o serviço correspondente em Operações deixa de contar como receita."
              : "Atualiza os dados e o estado do pedido."
        }
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
          <div className="sm:col-span-2">
            {/*
              Campo separado da mensagem do cliente, de propósito: a mensagem é
              o que ele escreveu e fica intacta; isto é o que a equipa vai
              anotando (o que ficou combinado ao telefone, porque foi recusado,
              o que falta confirmar).
            */}
            <Field label="Observações internas">
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="Notas da equipa sobre este pedido — o que ficou combinado, o que falta confirmar, porque foi recusado…"
                className="input-field resize-y"
              />
              <p className="mt-1 text-[11px] text-text-muted">
                Só visível no backoffice — o cliente nunca vê estas notas.
              </p>
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
          <Field label="Valor do serviço (€)">
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
                <p className="text-xs text-text-muted">Comissão da Piquet (calculada automaticamente)</p>
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

/**
 * `useSearchParams` obriga a um limite de Suspense na compilação estática
 * (o Next não consegue pré-renderizar sem saber o URL).
 */
export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-text-muted py-8 text-center">A carregar pedidos…</div>}>
      <LeadsPageInner />
    </Suspense>
  );
}
