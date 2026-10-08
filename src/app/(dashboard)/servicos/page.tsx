"use client";

import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, Pagination, SearchInput, ExportButton, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { FilterBar } from "@/components/ui/FilterBar";
import { useTabParam } from "@/hooks/useTabParam";
import { ouvirPedidosDeAbertura } from "@/hooks/useAbrirPeloEndereco";
import PedidosPersonalizados from "./PedidosPersonalizados";
import { ServiceDetailDrawer } from "@/components/ui/ServiceDetailDrawer";
import { OperacoesAoVivo } from "./OperacoesAoVivo";
import { ErrorState } from "@/components/ui/States";
import { useAsyncData, useFilters, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { getServices, getOperacao, getDetalheDoServico } from "@/services/dashboardService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { downloadCsv } from "@/lib/utils";
import { toast } from "@/stores";
import { ClipboardList } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import type { ServiceRequest, ServiceStatus } from "@/types";
import { ESTADOS_SIMPLES, PRECISA_DE_ATENCAO, atencaoPrimeiro, precisaDeAtencao } from "@/lib/estados";

/*
  O filtro de estado são os seis estados simples (ver lib/estados.ts) e, à
  cabeça, "Precisa de atenção". Eram oito grupos com mistura: "Em
  reclamação" estava dentro de "Recusados / Sem técnico", e "Pagamento por
  capturar" era um grupo à parte quando é um serviço feito com dinheiro por
  entrar.
*/
const STATUS_GROUPS: { id: string; label: string; statuses?: ServiceStatus[] }[] = [
  { id: "todos", label: "Todos os estados" },
  { id: "atencao", label: "Precisa de atenção", statuses: PRECISA_DE_ATENCAO },
  ...ESTADOS_SIMPLES,
];

export default function ServicesPage() {
  const filters = useFilters();
  const { page, setPage, pageSize, sortField, sortDirection, handleSort, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [selectedService, setSelectedService] = useState<ServiceRequest | null>(null);
  // "Ao vivo" é o primeiro: é o que se abre para saber se os pedidos de agora
  // vão ser servidos. A lista completa fica no separador ao lado.
  const [tab, setTab] = useTabParam("ao-vivo");
  /*
    Saiu daqui o "Registar serviço concluído" (e o "Editar" do painel).

    Escrevia no Supabase, e a lista lê do Laravel: quem registasse um serviço
    via a mensagem "registado" e não o encontrava em lado nenhum. Pior, o
    valor entrava nas contas do Supabase e não nas do Payshop, que é o GMV.
    Um trabalho combinado por telefone faz-se como pedido na app, para haver
    pagamento, fatura e técnico a sério.
  */

  /*
    Abrir um serviço pelo endereço: `/servicos?servico=282`. É para onde a
    pesquisa global (⌘K) manda. A lista é paginada e o 282 pode não estar na
    página aberta, por isso lê-se o serviço diretamente.
  */
  useEffect(() => {
    let vivo = true;
    const abrir = (search: string) => {
      const id = new URLSearchParams(search).get("servico");
      if (!id) return;
      getDetalheDoServico(id)
        .then((d) => { if (vivo && d) setSelectedService(d.servico); })
        .catch(() => { /* o painel não abre; a lista continua lá */ });
      const url = new URL(window.location.href);
      url.searchParams.delete("servico");
      window.history.replaceState(null, "", url.toString());
    };
    abrir(window.location.search);
    // Já em Operações: o ⌘K muda o endereço sem voltar a montar a página.
    const parar = ouvirPedidosDeAbertura((url) => abrir(url.search));
    return () => { vivo = false; parar(); };
  }, []);

  const [statusGroup, setStatusGroup] = useState("todos");
  const activeStatuses = STATUS_GROUPS.find((g) => g.id === statusGroup)?.statuses;

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
    { id: "desempenho", label: "Desempenho (SLA)" },
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
    () => getServices(filters, page, pageSize, sortField ? { field: sortField, direction: sortDirection } : undefined, debouncedSearch, activeStatuses),
    [filters, page, pageSize, sortField, sortDirection, debouncedSearch, statusGroup]
  );
  // Quantos precisam de alguém, para o aviso por cima da lista (uma linha só).
  const { data: comAtencao } = useAsyncData(
    () => getServices(filters, 1, 1, undefined, undefined, PRECISA_DE_ATENCAO),
    [chaveFiltros]
  );
  const quantosComAtencao = comAtencao?.total ?? 0;
  // Sem ordenação escolhida, os que precisam de atenção sobem ao topo da página.
  const linhas = sortField ? (data?.data ?? []) : atencaoPrimeiro(data?.data ?? []);

  /*
    Funil, estados e tempos numa só leitura: as três saem da MESMA lista de
    serviços, e a lista custa uma travessia paginada ao Laravel.
  */
  const { data: op, error: opErro } = useAsyncData(() => getOperacao(), []);

  // Sem ID; sem Agendado, Valor técnico, Origem, Tempo técnico e Reclamação
  // (pedido do André 2026-07-22). Avaliação visível junto ao estado.
  const columns: Column<ServiceRequest>[] = [
    { key: "requestedAt", label: "Data", sortable: true, render: (r) => formatDate(r.requestedAt) },
    { key: "customerName", label: "Cliente", sortable: true },
    { key: "technicianName", label: "Técnico", render: (r) => r.technicianName ?? "—" },
    { key: "categoryName", label: "Categoria" },
    { key: "serviceName", label: "Serviço" },
    { key: "city", label: "Localização", sortable: true },
    /*
      Quantos técnicos disseram que sim, de quantos se convidaram. É a
      primeira pergunta quando um pedido fica parado: "0 de 12" é falta de
      resposta, "0 de 0" é não haver ninguém por perto para convidar.
    */
    { key: "matching", label: "Técnicos", render: (r) => <ColunaMatching matching={r.matching} /> },
    { key: "status", label: "Estado", render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        {precisaDeAtencao(r.status) && <span className="h-2 w-2 rounded-full bg-danger shrink-0" title="Precisa de atenção" aria-label="Precisa de atenção" />}
        <StatusBadge status={r.status} label={SERVICE_STATUS_LABELS[r.status]} />
      </span>
    ) },
    { key: "rating", label: "Avaliação", render: (r) => r.rating
      ? <span className="inline-flex items-center gap-0.5 font-medium text-warning whitespace-nowrap">{"★".repeat(Math.round(r.rating))}<span className="text-text-secondary ml-1">{r.rating}</span></span>
      : <span className="text-text-muted">—</span> },
    { key: "totalCustomerValue", label: "Valor total", sortable: true, render: (r) => formatCurrency(r.totalCustomerValue) },
    { key: "piquetRevenue", label: "Receita Piquet", sortable: true, render: (r) => formatCurrency(r.piquetRevenue) },
  ];

  const handleExport = () => {
    if (!data?.data) return;
    downloadCsv("servicos.csv",
      ["ID", "Cliente", "Técnico", "Categoria", "Estado", "Valor Total", "Receita Piquet"],
      data.data.map((s) => [s.id, s.customerName, s.technicianName ?? "", s.categoryName, s.status, String(s.totalCustomerValue), String(s.piquetRevenue)])
    );
  };

  return (
    <RouteGuard route="/servicos">
      <div className="space-y-6">
        <PageHeader
          icon={ClipboardList}
          eyebrow="Operação"
          title="Operações"
          subtitle="Serviços, agendamentos e desempenho da operação"
          actions={
            <ExportButton onExport={handleExport} />
          }
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "ao-vivo" && (
          <OperacoesAoVivo
            onAbrir={(id) => {
              getDetalheDoServico(id)
                .then((d) => { if (d) setSelectedService(d.servico); })
                .catch((e) => toast(e instanceof Error ? e.message : "Não foi possível abrir o serviço.", "error"));
            }}
          />
        )}

        {tab === "pedidos" && (
          <div className="space-y-4">
            {/*
              O estado passou de sete chips a um filtro. A fila ocupava uma
              linha inteira acima da pesquisa e dos outros filtros, e lia-se
              como sub-abas -- quando é, na prática, mais um critério de
              filtragem. Agora está com os restantes, na mesma linha.
            */}
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar serviços..." />
              <select
                value={statusGroup}
                onChange={(e) => { setStatusGroup(e.target.value); setPage(1); }}
                className="input-field w-auto"
                aria-label="Filtrar por estado"
              >
                {STATUS_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}{g.id === "atencao" && quantosComAtencao ? ` (${quantosComAtencao})` : ""}</option>
                ))}
              </select>
              <FilterBar className="flex-1 min-w-[240px]" />
            </div>
            {quantosComAtencao > 0 && statusGroup !== "atencao" && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-4 py-2.5">
                <p className="text-sm text-text-primary">
                  <b>{quantosComAtencao}</b> {quantosComAtencao === 1 ? "pedido precisa" : "pedidos precisam"} de atenção:
                  pagamento por capturar ou reclamação.
                </p>
                <button onClick={() => { setStatusGroup("atencao"); setPage(1); }} className="text-sm font-medium text-danger hover:underline">
                  Ver só esses
                </button>
              </div>
            )}
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
                />
                {data && (
                  <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
                )}
              </>
            )}
          </div>
        )}

        {tab === "desempenho" && (
          <div className="space-y-6">
            {opErro && (
              <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-4 py-3">
                <p className="text-sm font-semibold text-danger">Não foi possível medir a operação</p>
                <p className="text-xs text-text-secondary mt-0.5">{opErro}</p>
              </div>
            )}

            {op && (
              <>
                {/*
                  Só os tempos que se conseguem MEDIR. O ecrã mostrava antes
                  28, 95, 180, 1440 e 120 minutos, mais "sem técnico 2,1%" e
                  "em atraso 12" — todos constantes escritas no código.

                  Medianas e não médias: um serviço esquecido em aberto durante
                  três semanas desloca uma média e não desloca a mediana.
                */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Pedidos</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">{op.total}</p>
                    <p className="text-[11px] text-text-muted">no histórico todo</p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Taxa de conclusão</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.taxaConclusao.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Taxa de cancelamento</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.taxaCancelamento.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Até encontrar técnico</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.tempoAteEncontrarTecnico == null ? "—" : `${op.tempoAteEncontrarTecnico} min`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {op.amostras.encontrar > 0 ? `mediana de ${op.amostras.encontrar} serviços` : "sem dados"}
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Duração do serviço</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.duracaoDoServico == null ? "—" : `${op.duracaoDoServico} min`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {op.amostras.duracao > 0 ? `mediana de ${op.amostras.duracao} serviços` : "sem dados"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4 space-y-3">
                    <SectionHeader title="Onde se perdem os pedidos" />
                    {op.funil.map((p, i) => (
                      <div key={p.nome}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium text-text-primary">{p.nome}</span>
                          <span className="tabular-nums text-text-secondary">
                            {p.quantos}
                            {i > 0 && p.perdaNoPasso > 0 && (
                              <span className="ml-2 text-danger">−{p.perdaNoPasso.toFixed(1).replace(".", ",")}%</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                          <div className="h-full rounded-full bg-piquet" style={{ width: `${p.percentagem}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="card p-4 space-y-3">
                    <SectionHeader title="Em que estado estão" />
                    {op.porEstado.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-muted">Sem serviços registados.</p>
                    ) : (
                      op.porEstado.map((e) => (
                        <div key={e.estado}>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium text-text-primary">
                              {SERVICE_STATUS_LABELS[e.estado] ?? e.estado}
                            </span>
                            <span className="tabular-nums text-text-secondary">
                              {e.quantos} ({op.total > 0 ? Math.round((e.quantos / op.total) * 100) : 0}%)
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                            <div
                              className="h-full rounded-full bg-piquet/70"
                              style={{ width: `${op.total > 0 ? (e.quantos / op.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <p className="card p-4 text-sm text-text-secondary">
                  Tudo aqui sai dos serviços reais. Onde não há como medir — o tempo até responder, por exemplo, se o
                  Laravel não o registar — aparece um traço em vez de um número. Para agir sobre os pedidos de agora, usa o
                  separador{" "}
                  <button onClick={() => setTab("ao-vivo")} className="font-medium text-piquet-700 hover:underline">Ao vivo</button>.
                </p>
              </>
            )}
          </div>
        )}

        {tab === "personalizados" && <PedidosPersonalizados />}

        {/* Service detail drawer (com separadores) */}
        {selectedService && (
          <ServiceDetailDrawer service={selectedService} onClose={() => setSelectedService(null)} />
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
