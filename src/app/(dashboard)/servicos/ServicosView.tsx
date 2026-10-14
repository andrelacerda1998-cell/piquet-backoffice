"use client";

import { useCallback, useEffect, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, Pagination, SearchInput, ExportButton, type Column } from "@/components/ui/DataTable";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { FilterBar } from "@/components/ui/FilterBar";
import { useTabParam } from "@/hooks/useTabParam";
import { ouvirPedidosDeAbertura, useAcaoPeloEndereco } from "@/hooks/useAbrirPeloEndereco";
import PedidosPersonalizados from "./PedidosPersonalizados";
import { ServiceDetailDrawer } from "@/components/ui/ServiceDetailDrawer";
import { OperacoesAoVivo } from "./OperacoesAoVivo";
import { ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { getServices, getDetalheDoServico } from "@/services/dashboardService";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { downloadCsv } from "@/lib/utils";
import { toast } from "@/stores";
import { Phone, MessageCircle, Copy } from "lucide-react";
import { EstadoDoPedido } from "@/components/ui/EstadoDoPedido";
import { MOTIVOS } from "@/lib/aoVivo";
import { USE_REAL_API } from "@/services/api";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ServiceRequest, ServiceStatus } from "@/types";
import { ESTADOS_SIMPLES, PRECISA_DE_ATENCAO, atencaoPrimeiro, precisaDeAtencao, rotuloSimples } from "@/lib/estados";
import { pedidoHref } from "@/lib/fichas";

/*
  As vistas rápidas da lista (auditoria de 08/10/2026, anexo D): o que se
  procura todos os dias, num clique. "Precisa de atenção" vem primeiro; "Hoje"
  e "Agendados" vêm do Laravel (backend #171) e não do estado.
*/
type Vista = "todos" | "atencao" | "hoje" | "agendados" | "curso" | "concluidos" | "cancelados";
const estadosDe = (id: string) => ESTADOS_SIMPLES.find((e) => e.id === id)?.statuses ?? [];
const VISTAS: { id: Vista; label: string; statuses?: ServiceStatus[] }[] = [
  { id: "todos", label: "Todos" },
  { id: "atencao", label: "Precisa de atenção", statuses: PRECISA_DE_ATENCAO },
  { id: "hoje", label: "Hoje" },
  { id: "agendados", label: "Agendados" },
  { id: "curso", label: "Em curso", statuses: estadosDe("curso") },
  { id: "concluidos", label: "Concluídos", statuses: estadosDe("concluido") },
  { id: "cancelados", label: "Cancelados", statuses: estadosDe("cancelado") },
];

/** Só os dígitos, com o indicativo de Portugal quando o número vem sem ele. */
const paraWhatsApp = (telefone: string) => {
  const d = telefone.replace(/\D/g, "");
  return d.length === 9 ? `351${d}` : d;
};

export default function ServicosView({ abrirId }: { abrirId?: string }) {
  const filters = useFilters();
  const { page, setPage, pageSize, sortField, sortDirection, handleSort, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [selectedService, setSelectedService] = useState<ServiceRequest | null>(null);
  // "Ao vivo" é o primeiro: é o que se abre para saber se os pedidos de agora
  // vão ser servidos. A lista completa fica no separador ao lado.
  const [tab, setTab] = useTabParam("ao-vivo");
  // O Desempenho (SLA) passou para Mercado › Liquidez (09/10/2026).
  useEffect(() => {
    if (tab === "desempenho") window.location.replace("/mercado");
  }, [tab]);
  /*
    Saiu daqui o "Registar serviço concluído" (e o "Editar" do painel).

    Escrevia no Supabase, e a lista lê do Laravel: quem registasse um serviço
    via a mensagem "registado" e não o encontrava em lado nenhum. Pior, o
    valor entrava nas contas do Supabase e não nas do Payshop, que é o GMV.
    Um trabalho combinado por telefone faz-se como pedido na app, para haver
    pagamento, fatura e técnico a sério.
  */

  /*
    A ficha do pedido tem endereço próprio: /servicos/282 (desde 12/10/2026).
    É para lá que levam o ⌘K, os alertas, os avisos no telemóvel e o "Copiar
    ligação". A lista é paginada e o 282 pode não estar na página aberta, por
    isso lê-se o pedido diretamente.

    Os endereços antigos (`?servico=282`, e `?pedido=282`) continuam a abrir a
    ficha -- há avisos já enviados para telemóveis com eles.
  */
  const [urlPronta, setUrlPronta] = useState(!abrirId);
  const abrirPedido = useCallback((id: string) => {
    getDetalheDoServico(id)
      .then((d) => {
        if (d) setSelectedService(d.servico);
        else toast(`Não encontrei o pedido #${id}.`, "error");
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Não foi possível abrir o pedido.", "error"))
      .finally(() => setUrlPronta(true));
  }, []);
  useEffect(() => { if (abrirId) abrirPedido(abrirId); }, [abrirId, abrirPedido]);
  useEffect(() => {
    const doEndereco = (search: string) => {
      const q = new URLSearchParams(search);
      const id = q.get("pedido") ?? q.get("servico");
      if (!id) return;
      const url = new URL(window.location.href);
      url.searchParams.delete("servico");
      url.searchParams.delete("pedido");
      window.history.replaceState(null, "", url.toString());
      abrirPedido(id);
    };
    doEndereco(window.location.search);
    // Já em Pedidos: o ⌘K muda o endereço sem voltar a montar a página.
    return ouvirPedidosDeAbertura((url) => doEndereco(url.search));
  }, [abrirPedido]);
  // Vindo de um comando do ⌘K: `?acao=reembolsar` abre a confirmação do
  // reembolso; `?nota=1` põe o cursor nas notas.
  const [acaoInicial, setAcaoInicial] = useState<string | null>(null);
  const [focarNota, setFocarNota] = useState(false);
  useAcaoPeloEndereco("acao", setAcaoInicial);
  useAcaoPeloEndereco("nota", () => setFocarNota(true));
  // O endereço acompanha a ficha: aberta é /servicos/282, fechada volta à lista.
  useEffect(() => {
    if (!urlPronta) return;
    const aqui = window.location.pathname;
    const alvo = selectedService ? pedidoHref(selectedService.id) : null;
    if (alvo && aqui !== alvo) window.history.replaceState(null, "", alvo);
    else if (!alvo && /^\/servicos\/[^/]+$/.test(aqui)) window.history.replaceState(null, "", `/servicos?tab=${tab}`);
  }, [selectedService, urlPronta, tab]);

  const [vista, setVista] = useState<Vista>("todos");
  const activeStatuses = VISTAS.find((v) => v.id === vista)?.statuses;
  const extra = vista === "hoje" ? { dia: todayISO() } : vista === "agendados" ? { agendados: true } : {};

  const TABS: TabDef[] = [
    { id: "ao-vivo", label: "Ao vivo" },
    { id: "pedidos", label: "Serviços" },
    /*
      "Reservas da app" saiu a 22/09/2026.

      Falava com um backend Express em localhost:3100 -- o do protótipo
      Flutter em ~/dev/piquet, não o Laravel que serve as apps das lojas. Em
      produção a variável NEXT_PUBLIC_PIQUET_API nunca foi definida, por isso
      o separador tentava chamar o localhost DO BROWSER de quem abria o
      backoffice: falhava sempre, e desde sempre.

      Os pedidos feitos na app verdadeira já estão no separador "Serviços" --
      entram pela ponte com o Laravel (ver _lib/appPedidos.ts). Não se perde
      nada; deixa de haver um separador que nunca mostrou nada.
    */
    { id: "personalizados", label: "Pedidos personalizados" },
  ];

  /**
   * Mudar o período/filtro global repõe a página 1. Sem isto, quem estivesse
   * na página 5 e mudasse o filtro para um período mais curto ficava com a
   * tabela vazia ("Sem dados") — parecia não haver serviços nenhuns, quando
   * só não havia página 5 nesse período. Os chips e a pesquisa já o faziam.
   */
  const chaveFiltros = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [chaveFiltros, setPage]);

  const { data, loading, error, refetch } = useAsyncData(
    () => getServices(filters, page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined, debouncedSearch, activeStatuses, extra),
    [filters, page, pageSize, sortField, sortDirection, debouncedSearch, vista]
  );
  // Quantos precisam de alguém, para o aviso por cima da lista (uma linha só).
  const { data: comAtencao } = useAsyncData(
    () => getServices(filters, 1, 1, undefined, undefined, PRECISA_DE_ATENCAO),
    [chaveFiltros]
  );
  const quantosComAtencao = comAtencao?.total ?? 0;
  // Sem ordenação escolhida, os que precisam de atenção vêm primeiro: no servidor
  // (backend #171, que sabe porquê); em demonstração, nesta página.
  const linhas = sortField || USE_REAL_API ? (data?.data ?? []) : atencaoPrimeiro(data?.data ?? []);


  /*
    Oito colunas, as que respondem "o que é, de quem, onde, em que pé está e
    quanto vale" (auditoria, anexo D). As outras ficam em "Colunas", para quem
    as quiser. O n.º voltou: é o que o cliente diz ao telefone. Só se ordena
    pelo que o servidor sabe ordenar (n.º, data e valor).
  */
  const columns: Column<ServiceRequest>[] = [
    { key: "id", label: "N.º", sortable: true, render: (r) => <span className="font-mono text-xs text-text-secondary">#{r.id}</span> },
    { key: "requestedAt", label: "Quando", sortable: true, render: (r) => (
      <span className="whitespace-nowrap">
        {formatDate(r.requestedAt)}
        {r.scheduledAt && <span className="block text-[11px] text-text-muted">marcado {r.scheduledAt.length > 10 ? formatDateTime(r.scheduledAt) : formatDate(r.scheduledAt)}</span>}
      </span>
    ) },
    { key: "customerName", label: "Cliente" },
    { key: "serviceName", label: "Serviço", render: (r) => (
      <span>
        {r.serviceName || "—"}
        {r.categoryName && r.categoryName !== r.serviceName && <span className="block text-[11px] text-text-muted">{r.categoryName}</span>}
      </span>
    ) },
    { key: "city", label: "Cidade", render: (r) => r.city || "—" },
    { key: "technicianName", label: "Técnico", render: (r) => r.technicianName ?? <span className="text-text-muted">—</span> },
    { key: "status", label: "Estado", render: (r) => (
      <span className="inline-flex items-center gap-1.5" title={r.atencao ? MOTIVOS[r.atencao.motivo] ?? r.atencao.motivo : undefined}>
        {(r.atencao || precisaDeAtencao(r.status)) && <span className="h-2 w-2 rounded-full bg-danger shrink-0" aria-label="Precisa de atenção" />}
        <EstadoDoPedido status={r.status} />
      </span>
    ) },
    { key: "totalCustomerValue", label: "Valor", sortable: true, render: (r) => formatCurrency(r.totalCustomerValue) },
    // Secundárias: em "Colunas".
    { key: "matching", label: "Convidados", hidden: true, render: (r) => <ColunaMatching matching={r.matching} /> },
    { key: "rating", label: "Avaliação", hidden: true, render: (r) => r.rating
      ? <span className="inline-flex items-center gap-0.5 font-medium text-warning whitespace-nowrap">{"★".repeat(Math.round(r.rating))}<span className="text-text-secondary ml-1">{r.rating}</span></span>
      : <span className="text-text-muted">—</span> },
    { key: "piquetRevenue", label: "Comissão", hidden: true, render: (r) => formatCurrency(r.piquetRevenue) },
    // As ações de cada linha: ligar, WhatsApp e copiar o n.º, sem abrir o pedido.
    { key: "acoes", label: "", render: (r) => <AcoesDaLinha pedido={r} /> },
  ];

  const handleExport = () => {
    if (!data?.data) return;
    // O estado como se lê no ecrã, não o identificador interno.
    downloadCsv("pedidos.csv",
      ["N.º", "Data", "Cliente", "Serviço", "Cidade", "Técnico", "Estado", "Estado técnico", "Valor", "Comissão"],
      data.data.map((s) => [s.id, s.requestedAt, s.customerName, s.serviceName, s.city, s.technicianName ?? "", rotuloSimples(s.status), SERVICE_STATUS_LABELS[s.status] ?? s.status, String(s.totalCustomerValue), String(s.piquetRevenue)])
    );
  };

  return (
    <RouteGuard route="/servicos">
      <div className="space-y-6">
        <PageHeader
          title="Pedidos"
          subtitle="O que está a acontecer agora, a lista de todos os pedidos e os personalizados"
          actions={
            <ExportButton onExport={handleExport} />
          }
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "ao-vivo" && (
          <OperacoesAoVivo
            onAbrir={(id) => {
              abrirPedido(id);
            }}
          />
        )}

        {tab === "pedidos" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="N.º, cliente, telefone, técnico…" />
              <FilterBar className="flex-1 min-w-[240px]" />
            </div>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Vistas rápidas">
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={vista === v.id}
                  onClick={() => { setVista(v.id); setPage(1); }}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    vista === v.id ? "border-piquet/30 bg-piquet/15 text-piquet-700" : "border-surface-border text-text-secondary hover:bg-surface-muted",
                    v.id === "atencao" && quantosComAtencao > 0 && vista !== v.id && "border-danger/40 text-danger")}
                >
                  {v.label}
                  {v.id === "atencao" && quantosComAtencao > 0 && <span className="tabular-nums text-xs">{quantosComAtencao}</span>}
                </button>
              ))}
            </div>
            {error ? <ErrorState message={error} onRetry={refetch} /> : (
              <>
                <DataTable
                  columns={columns}
                  data={linhas}
                  keyField="id"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={setSelectedService}
                  loading={loading}
                  columnToggle
                />
                {data && (
                  <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
                )}
              </>
            )}
          </div>
        )}

        {tab === "personalizados" && <PedidosPersonalizados />}

        {/* Service detail drawer (com separadores) */}
        {selectedService && (
          <ServiceDetailDrawer
            service={selectedService}
            acaoInicial={acaoInicial}
            focarNota={focarNota}
            onClose={() => { setSelectedService(null); setAcaoInicial(null); setFocarNota(false); }}
          />
        )}
      </div>
    </RouteGuard>
  );
}

/** "2 de 5": aceitaram, de quantos se convidaram; e os que ainda não responderam. */
function ColunaMatching({ matching }: { matching: ServiceRequest["matching"] }) {
  if (!matching) return <span className="text-text-muted">—</span>;
  const { invited, accepted, notified } = matching;
  if (invited === 0) return <span className="text-text-muted whitespace-nowrap">ninguém convidado</span>;
  return (
    <span className="whitespace-nowrap tabular-nums" title={`${accepted} aceitaram de ${invited} convidados`}>
      <span className={accepted > 0 ? "font-medium text-text-primary" : "text-danger"}>{accepted}</span>
      <span className="text-text-secondary"> de {invited}</span>
      {notified > 0 && <span className="ml-1 text-[11px] text-text-muted">· {notified} por responder</span>}
    </span>
  );
}

/** Ligar, WhatsApp e copiar o n.º, sem abrir o pedido (os telefones só para quem os pode ver). */
function AcoesDaLinha({ pedido }: { pedido: ServiceRequest }) {
  const botao = "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text-primary";
  const tel = pedido.customerPhone;
  const copiar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(pedido.id); toast(`N.º ${pedido.id} copiado.`); }
    catch { toast(pedido.id, "info"); }
  };
  return (
    <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {tel && <a href={`tel:${tel.replace(/\s/g, "")}`} className={botao} title={`Ligar ao cliente (${tel})`} aria-label="Ligar ao cliente"><Phone className="h-3.5 w-3.5" /></a>}
      {tel && <a href={`https://wa.me/${paraWhatsApp(tel)}`} target="_blank" rel="noreferrer" className={botao} title="WhatsApp do cliente" aria-label="WhatsApp do cliente"><MessageCircle className="h-3.5 w-3.5" /></a>}
      <button onClick={copiar} className={botao} title="Copiar o n.º" aria-label="Copiar o número do pedido"><Copy className="h-3.5 w-3.5" /></button>
    </span>
  );
}
