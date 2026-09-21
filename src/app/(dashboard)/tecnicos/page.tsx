"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { HardHat, Eye } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent, DonutChartComponent, HeatMapGrid } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { useTabParam } from "@/hooks/useTabParam";
import {
  getVendors, suspendVendor, restoreVendor, deleteVendorPermanently, getVendorMetrics, getVendorsByCategory,
  getVendorsByLocation, getTopVendors, getVendorCoverage, setVendorAtValidation, getVendorLiveLocations,
  createVendorInvoiceWorkspace,
  createTestVendor, type RealVendor, type TopVendor, type NewTestVendor,
} from "@/services/vendorsService";

// Leaflet mexe em `window`/`document` na inicialização — sem ssr:false a
// build do Next.js falha (o componente tenta correr no servidor).
const TechnicianMap = dynamic(() => import("@/components/ui/TechnicianMap").then((m) => m.TechnicianMap), { ssr: false });
import { getCoverage, type CoverageTechnician, type CoverageOpenZone, type CoverageCandidateCity } from "@/services/coverageService";
import {
  getVendorDocuments, getAllVendorDocuments, approveVendorDocument, declineVendorDocument,
  type VendorDocument, type VendorDocumentStatus,
} from "@/services/vendorDocumentsService";
import { Modal, Field } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WhatsappConversa } from "@/components/ui/WhatsappConversa";
import { REQUIRED_DOCS, DOC_STATE_UI, indexDocsByVendor, missingCount, classifyDocument, atValidationState, AT_STATE_UI } from "@/lib/vendorDocs";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function TechniciansPage() {
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  // ?tab=aprovacoes — deep-link vindo dos avisos da Visão executiva.
  const [tab, setTab] = useTabParam("visao");

  // Indicadores reais da Visão geral (App\Http\Controllers\Api\Admin\
  // VendorController::metrics() e derivados) -- substituem os "estados"
  // fictícios do mock (aprovado/disponivel/ativo/em_validacao/suspenso).
  const { data: metrics } = useAsyncData(() => getVendorMetrics(), []);
  // Lista real de técnicos (App\Filament\Resources\VendorResource migrado)
  // -- sem sort do lado do servidor, tal como Clientes.
  const { data: vendors, loading, refetch: refetchVendors } = useAsyncData(
    () => getVendors(page, pageSize, debouncedSearch || undefined),
    [page, pageSize, debouncedSearch]
  );
  // Técnicos suspensos (soft-delete real) -- separado do "Todos", tal como o
  // Filament faz com o TrashedFilter, para o separador "Suspensões" e a
  // contagem no TabDef não dependerem da paginação da lista principal.
  const { data: suspendedVendors, loading: suspendedLoading, refetch: refetchSuspended } = useAsyncData(
    () => getVendors(1, 100, undefined, true),
    []
  );
  const { data: byLocation } = useAsyncData(() => getVendorsByLocation(), []);
  const { data: byCategory } = useAsyncData(() => getVendorsByCategory(), []);
  const { data: coverage } = useAsyncData(() => getVendorCoverage(), []);
  const { data: topVendors } = useAsyncData(() => getTopVendors(10), []);
  // Cobertura por técnico — os técnicos declaram na própria app onde
  // podem/querem atuar (POST /vendor/survey/vote); esta vista junta zonas já
  // abertas com quem lá atua e cidades candidatas com quem manifestou
  // interesse (App\Http\Controllers\Api\Admin\CoverageController, sem
  // equivalente direto no Filament, pedido explícito do utilizador 2026-08-10).
  const { data: technicianCoverage } = useAsyncData(() => getCoverage(), []);
  const [selectedArea, setSelectedArea] = useState<{ label: string; technicians: CoverageTechnician[] } | null>(null);

  // Mapa ao vivo — técnicos Online com localização recente (App\Http\
  // Controllers\Api\Admin\VendorController::liveLocations()). Só
  // informativo; não interfere no matching/fluxo de pedidos, esse continua
  // inteiramente na app. Atualiza a cada 15s enquanto esta página está aberta.
  // `showTestAccounts` é um interruptor manual para validar o mapa sem
  // depender de um técnico real estar online — off por omissão.
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const { data: liveLocations, refetch: refetchLiveLocations } = useAsyncData(
    () => getVendorLiveLocations(showTestAccounts),
    [showTestAccounts]
  );
  useEffect(() => {
    const id = setInterval(refetchLiveLocations, 15000);
    return () => clearInterval(id);
  }, [refetchLiveLocations]);

  // Criar conta de teste — já pronta a ficar Online (documentos aprovados,
  // faturação/AT preenchidos). A password só aparece uma vez, na resposta.
  const [testAccountModalOpen, setTestAccountModalOpen] = useState(false);
  const [testAccountForm, setTestAccountForm] = useState({ first_name: "", last_name: "", phone_number: "", email: "" });
  const [creatingTestAccount, setCreatingTestAccount] = useState(false);
  const [newTestVendor, setNewTestVendor] = useState<NewTestVendor | null>(null);

  const openTestAccountModal = () => {
    setNewTestVendor(null);
    setTestAccountForm({ first_name: "", last_name: "", phone_number: "", email: "" });
    setTestAccountModalOpen(true);
  };

  const submitTestAccount = async () => {
    if (!testAccountForm.first_name.trim() || !testAccountForm.last_name.trim() || !testAccountForm.phone_number.trim()) {
      toast("Nome e telefone são obrigatórios.", "error");
      return;
    }
    setCreatingTestAccount(true);
    try {
      const vendor = await createTestVendor({
        first_name: testAccountForm.first_name.trim(),
        last_name: testAccountForm.last_name.trim(),
        phone_number: testAccountForm.phone_number.trim(),
        email: testAccountForm.email.trim() || undefined,
      });
      setNewTestVendor(vendor);
      toast("Conta de teste criada — já pode ficar Online na app.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível criar a conta de teste.", "error");
    } finally {
      setCreatingTestAccount(false);
    }
  };

  // Cobertura: o que interessa decidir — onde falta gente e onde abrir a seguir.
  const zonasAbertasOrdenadas = useMemo(() =>
    [...(technicianCoverage?.open ?? [])].sort((a, b) => a.technicians.length - b.technicians.length),
  [technicianCoverage]);
  const candidatasOrdenadas = useMemo(() =>
    [...(technicianCoverage?.candidate ?? [])].sort((a, b) => b.technicians.length - a.technicians.length),
  [technicianCoverage]);
  // A "oferta" vem das zonas que os técnicos declaram na app. Se ninguém
  // declarou, vem tudo a zero — o que NÃO significa que não haja técnicos na
  // zona, significa que não está medido. Distinguir os dois casos evita
  // afirmar "nenhum técnico cobre esta zona" quando não sabemos.
  const coberturaPorMedir = useMemo(() => {
    const zonas = coverage ?? [];
    return zonas.length > 0 && zonas.every((z) => z.oferta === 0);
  }, [coverage]);
  const zonasEmFalta = useMemo(() =>
    [...(coverage ?? [])]
      .filter((z) => z.procura > 0 && (z.oferta === 0 || z.procura > z.oferta))
      .sort((a, b) => (a.oferta === 0 ? -1 : b.oferta === 0 ? 1 : b.procura - a.procura))
      .slice(0, 8),
  [coverage]);
  const coberturaResumo = useMemo(() => {
    const abertas = technicianCoverage?.open ?? [];
    const distintos = new Set<number>();
    for (const z of abertas) for (const t of z.technicians) distintos.add(t.id);
    return {
      zonasAbertas: abertas.length,
      zonasSemTecnicos: abertas.filter((z) => z.technicians.length === 0).length,
      candidatas: (technicianCoverage?.candidate ?? []).length,
      tecnicosDistintos: distintos.size,
    };
  }, [technicianCoverage]);

  // KYC — fila real de documentos por rever (App\Filament\...\VendorDocumentTextEntry
  // migrado). Contagem do separador vem sempre de "pending", independente do
  // filtro escolhido dentro do separador.
  // `revisaoFeita` incrementa a cada documento aprovado/recusado: sem isso, o
  // badge do separador e o banner de avisos ficavam com os números de quando a
  // página abriu — a tabela esvaziava ("Sem documentos pendentes") mas o topo
  // continuava a dizer que havia N por validar até se recarregar à mão.
  const [revisaoFeita, setRevisaoFeita] = useState(0);
  const { data: pendingDocsMeta } = useAsyncData(() => getVendorDocuments("pending", 1, 1), [revisaoFeita]);
  // Aviso por técnico: quais os técnicos com documentos por validar (não só o total).
  const { data: pendingDocsList } = useAsyncData(() => getVendorDocuments("pending", 1, 100), [revisaoFeita]);
  const pendingByVendor = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of pendingDocsList?.items ?? []) {
      const name = d.vendor_name?.trim() || "Técnico sem nome";
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]); // mais pendentes primeiro
  }, [pendingDocsList]);
  const [docStatus, setDocStatus] = useState<VendorDocumentStatus>("pending");
  const docsData = useAsyncData(() => getVendorDocuments(docStatus, 1, 50), [docStatus]);

  // Todos os documentos (os três estados) para saber, por técnico, o que já
  // entregou e o que falta — alimenta as colunas de KYC e o perfil.
  // Percorre TODAS as páginas de cada estado: há centenas de documentos e o
  // backend limita a 100 por página — sem isto, os técnicos validados há mais
  // tempo apareciam sem documentos nenhuns.
  const { data: allDocsResult, refetch: refetchAllDocs } = useAsyncData(async () => {
    const parts = await Promise.all(
      (["pending", "approved", "declined"] as VendorDocumentStatus[]).map((s) => getAllVendorDocuments(s)),
    );
    return {
      items: parts.flatMap((p) => p.items),
      falharam: parts.reduce((a, p) => a + p.falharam, 0),
    };
  }, []);
  const allDocs = allDocsResult?.items;
  const docsIncompletos = allDocsResult?.falharam ?? 0;
  const docsByVendor = useMemo(() => indexDocsByVendor(allDocs ?? []), [allDocs]);
  const docsOfVendor = (vendorId: number) => (allDocs ?? []).filter((d) => d.vendor_id === vendorId);

  // Filtro por validação AT. A lista normal é paginada pelo servidor, por isso
  // filtrar só a página daria contas erradas — com filtro ativo carregamos a
  // lista toda de uma vez e filtramos aqui.
  const [atFilter, setAtFilter] = useState<"" | "validada" | "por_validar" | "sem_nif">("");
  const { data: allVendors, loading: allVendorsLoading } = useAsyncData(
    () => (atFilter ? getVendors(1, 500, debouncedSearch || undefined) : Promise.resolve(null)),
    [atFilter, debouncedSearch]
  );
  const atFiltered = useMemo(() => {
    const list = allVendors?.data ?? [];
    if (!atFilter) return [];
    // "Sem NIF" não é sobre a AT, mas usa a mesma mecânica (carregar tudo e
    // filtrar aqui) porque a contagem tem de ser sobre a lista completa.
    if (atFilter === "sem_nif") return list.filter((v) => !v.nif?.trim());
    return list.filter((v) => atValidationState(v) === (atFilter === "validada" ? "validado" : "por_validar"));
  }, [allVendors, atFilter]);
  const atCounts = useMemo(() => {
    const list = allVendors?.data ?? [];
    return {
      validada: list.filter((v) => atValidationState(v) === "validado").length,
      por_validar: list.filter((v) => atValidationState(v) === "por_validar").length,
      sem_nif: list.filter((v) => !v.nif?.trim()).length,
      total: allVendors?.total ?? 0,
      carregados: list.length,
    };
  }, [allVendors]);

  // Perfil do técnico (documentos entregues, em falta e por validar).
  const [profileVendor, setProfileVendor] = useState<RealVendor | null>(null);

  // Subutilizador AT: o backend pode enviá-lo com nomes diferentes (ou ainda
  // não o enviar de todo) — aceitamos qualquer um.
  const atUser = (v: RealVendor) => v.at_username || v.at_user || v.at_subuser || null;
  const [atSaving, setAtSaving] = useState(false);
  /*
    Criar o workspace de faturação. É o passo sem o qual a Piquet não consegue
    emitir fatura em nome do técnico quando o serviço fecha -- daí estar aqui
    e não escondido numa lista de ações.
  */
  const [wsSaving, setWsSaving] = useState(false);
  const criarWorkspace = async (v: RealVendor) => {
    setWsSaving(true);
    try {
      const atualizado = await createVendorInvoiceWorkspace(v.id);
      toast(`Workspace de faturação criado para ${v.name ?? "o técnico"}.`);
      setProfileVendor(atualizado);
      refetchVendors();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar o workspace.", "error");
    } finally {
      setWsSaving(false);
    }
  };

  const setAtValidation = async (v: RealVendor, valid: boolean) => {
    setAtSaving(true);
    try {
      await setVendorAtValidation(v.id, valid);
      toast(valid ? `Subutilizador AT de ${v.name ?? "técnico"} validado.` : "Validação AT retirada.");
      setProfileVendor({ ...v, at_valid: valid });
      refetchVendors();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível gravar a validação AT.", "error");
    } finally {
      setAtSaving(false);
    }
  };
  const [reviewDoc, setReviewDoc] = useState<VendorDocument | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "decline" | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  // Pré-visualização inline do documento (ver sem descarregar).
  const [previewDoc, setPreviewDoc] = useState<VendorDocument | null>(null);

  const openApprove = (doc: VendorDocument) => { setReviewDoc(doc); setReviewAction("approve"); setExpirationDate(""); };
  const openDecline = (doc: VendorDocument) => { setReviewDoc(doc); setReviewAction("decline"); setDeclineReason(""); };
  const closeReview = () => { setReviewDoc(null); setReviewAction(null); };

  const confirmReview = async () => {
    if (!reviewDoc || !reviewAction) return;
    if (reviewAction === "decline" && !declineReason.trim()) { toast("Indica o motivo da recusa.", "error"); return; }
    setSavingReview(true);
    try {
      if (reviewAction === "approve") {
        await approveVendorDocument(reviewDoc.id, expirationDate || null);
        toast(`"${reviewDoc.document_type}" de ${reviewDoc.vendor_name ?? "técnico"} aprovado — notificação enviada.`);
      } else {
        await declineVendorDocument(reviewDoc.id, declineReason.trim());
        toast(`"${reviewDoc.document_type}" de ${reviewDoc.vendor_name ?? "técnico"} recusado — notificação enviada.`, "error");
      }
      closeReview();
      docsData.refetch();
      refetchAllDocs();
      setRevisaoFeita((n) => n + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível processar o documento.", "error");
    } finally {
      setSavingReview(false);
    }
  };

  // Suspender/Reativar = soft-delete real do Vendor no Laravel (ver
  // vendorsService.ts) -- SEM a restrição de super-admin que o Filament tem
  // (decisão explícita, ver nota no VendorController do backend).
  const [actingId, setActingId] = useState<number | null>(null);
  const handleSuspend = async (v: RealVendor) => {
    setActingId(v.id);
    try {
      await suspendVendor(v.id);
      toast(`Técnico ${v.name ?? v.id} suspenso.`, "error");
      refetchVendors();
      refetchSuspended();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível suspender o técnico.", "error");
    } finally {
      setActingId(null);
    }
  };
  const handleRestore = async (v: RealVendor) => {
    setActingId(v.id);
    try {
      await restoreVendor(v.id);
      toast(`Técnico ${v.name ?? v.id} reativado.`);
      refetchVendors();
      refetchSuspended();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível reativar o técnico.", "error");
    } finally {
      setActingId(null);
    }
  };

  /*
    Apagar de vez. Duas coisas diferentes do suspender:

    1. Confirmação explícita, porque não há volta -- o `suspend` reverte-se
       num clique, isto não se reverte de todo.
    2. O resultado diz quantos serviços ficaram sem dono. É o custo real da
       operação e o Laravel devolve-o de propósito; escondê-lo aqui seria
       deixar a pessoa sem saber o que acabou de acontecer ao histórico.
  */
  const [vendorParaApagar, setVendorParaApagar] = useState<RealVendor | null>(null);
  const [aApagar, setAApagar] = useState(false);
  const apagarDeVez = async (v: RealVendor) => {
    setAApagar(true);
    try {
      const r = await deleteVendorPermanently(v.id);
      toast(
        r.orphan_services > 0
          ? `${v.name ?? v.id} apagado. ${r.orphan_services} ${r.orphan_services === 1 ? "serviço ficou" : "serviços ficaram"} sem técnico associado.`
          : `${v.name ?? v.id} apagado.`,
        "error",
      );
      setVendorParaApagar(null);
      setProfileVendor(null);
      refetchVendors();
      refetchSuspended();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível apagar o técnico.", "error");
    } finally {
      setAApagar(false);
    }
  };

  const TABS: TabDef[] = [
    { id: "visao", label: "Visão geral" },
    { id: "lista", label: "Lista" },
    { id: "aprovacoes", label: "Aprovações e KYC", count: pendingDocsMeta?.meta.total ?? 0 },
  ];

  const topColumns: Column<TopVendor>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "servicesCompleted", label: "Serviços" },
    { key: "averageRating", label: "Avaliação", render: (r) => r.averageRating > 0 ? `${r.averageRating}★` : "—" },
    { key: "piquetRevenue", label: "Receita gerada", render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "amountReceived", label: "Valor recebido", render: (r) => formatCurrency(r.amountReceived) },
  ];

  // Colunas do VendorResource::table() do Filament (nif/telefone/preço/
  // categorias/elegibilidade/validação AT/estado) -- sem os campos fictícios
  // que a lista mock tinha (avaliação, receita, serviços concluídos, ...).
  // NOTA: "operation_areas" são categorias/ofícios (ex.: "Canalização"), não
  // zonas geográficas -- a geografia real são as zonas de cobertura
  // (AllowedZone, ver aba "Cobertura" na Visão geral); rótulo corrigido de
  // "Zonas" para "Categorias".
  const columns: Column<RealVendor>[] = [
    { key: "name", label: "Nome", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "nif", label: "NIF", render: (r) => r.nif ?? "—" },
    { key: "phone_number", label: "Contacto", render: (r) => r.phone_number ?? "—" },
    { key: "price_rate", label: "Preço/h", render: (r) => r.price_rate !== null ? formatCurrency(r.price_rate) : "—" },
    // Os três documentos obrigatórios, cada um na sua coluna: vê-se de relance
    // o que falta a cada técnico, sem abrir o perfil.
    ...REQUIRED_DOCS.map((d) => ({
      key: `doc_${d.key}`,
      label: d.short,
      render: (r: RealVendor) => {
        const st = docsByVendor.get(r.id)?.[d.key] ?? "em_falta";
        const ui = DOC_STATE_UI[st];
        return <span title={`${d.label}: ${ui.label}`} className={cn("font-bold", ui.tone)}>{ui.symbol}</span>;
      },
    })),
    { key: "at_valid", label: "AT", render: (r) => {
      const ui = AT_STATE_UI[atValidationState(r)];
      return <span title={`Subutilizador AT — ${ui.label}: ${ui.hint}`} className={cn("font-bold", ui.tone)}>{ui.symbol}</span>;
    } },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status ?? "Offline"} /> },
    { key: "acao", label: "", render: (r) => (
      <div className="flex items-center justify-end gap-3">
        <button onClick={(e) => { e.stopPropagation(); setProfileVendor(r); }} className="btn-secondary text-xs py-1">Ver perfil</button>
        <button disabled={actingId === r.id} onClick={(e) => { e.stopPropagation(); handleSuspend(r); }} className="text-xs text-danger hover:underline disabled:opacity-50">Suspender</button>
      </div>
    ) },
  ];

  const suspendedColumns: Column<RealVendor>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "nif", label: "NIF", render: (r) => r.nif ?? "—" },
    { key: "suspended_at", label: "Suspenso em", render: (r) => r.suspended_at ? formatDate(r.suspended_at) : "—" },
    /*
      Reativar e apagar lado a lado, mas não com o mesmo peso.

      Um técnico suspenso está à espera de uma de duas decisões: volta, ou vai
      de vez. Fazer a segunda obrigava a abrir a ficha -- e é aqui que se olha
      para a lista de quem está parado.

      "Apagar" fica em cinzento e só fica vermelho ao passar o rato: a ação sem
      retorno não deve ter o mesmo destaque da que se desfaz num clique.
    */
    { key: "acao", label: "", render: (r) => (
      <div className="flex items-center justify-end gap-3">
        <button disabled={actingId === r.id} onClick={() => handleRestore(r)} className="text-sm text-success hover:underline disabled:opacity-50">Reativar</button>
        <button onClick={() => setVendorParaApagar(r)} className="text-sm text-text-muted hover:text-danger transition-colors">Apagar</button>
      </div>
    ) },
  ];

  return (
    <RouteGuard route="/tecnicos">
      <div className="space-y-6">
        <PageHeader
          icon={HardHat}
          eyebrow="Pessoas"
          title={<>Técnicos <DemoBadge endpoint="/technicians" /></>}
          subtitle={`${metrics?.registered ?? 0} técnicos registados`}
        />

        {/* Aviso: quais os técnicos com documentos por validar (não só o total). */}
        {pendingByVendor.length > 0 && (
          <div className="card border-l-4 border-l-warning bg-warning-light/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-text-primary">
                  ⚠️ {pendingByVendor.length} técnico(s) com documentos por validar
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pendingByVendor.slice(0, 12).map(([name, n]) => (
                    <button
                      key={name}
                      onClick={() => setTab("aprovacoes")}
                      title="Abrir a fila de aprovações KYC"
                      className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium border border-surface-border hover:border-warning"
                    >
                      {name}
                      <span className="text-warning font-bold">{n}</span>
                    </button>
                  ))}
                  {pendingByVendor.length > 12 && (
                    <span className="text-xs text-text-muted self-center">+{pendingByVendor.length - 12} …</span>
                  )}
                </div>
              </div>
              <button onClick={() => setTab("aprovacoes")} className="btn-primary text-sm shrink-0">Rever documentos</button>
            </div>
          </div>
        )}

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <SubTabs tabs={[
            { id: "resumo", label: "Resumo" },
            { id: "categoria", label: "Por categoria" },
            { id: "cobertura", label: "Cobertura" },
            { id: "mapa", label: "Mapa ao vivo" },
          ]}>
            {(sub) => (
              <>
                {sub === "resumo" && (
                  <div className="space-y-6">
                    {metrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                        <MetricCard title="Registados" metric={buildMetricValue(metrics.registered, metrics.registered)} hideDelta />
                        <MetricCard title="Podem aceitar serviço" metric={buildMetricValue(metrics.eligible, metrics.eligible)} hideDelta />
                        <MetricCard title="Online agora" metric={buildMetricValue(metrics.online, metrics.online)} hideDelta />
                        <MetricCard title="Sem serviços" metric={buildMetricValue(metrics.noServices, metrics.noServices)} hideDelta />
                        <MetricCard title="Taxa de elegibilidade" metric={buildMetricValue(metrics.approvalRate, metrics.approvalRate)} hideDelta format="percent" />
                      </div>
                    )}
                    <div>
                      <h2 className="font-semibold mb-3">Top técnicos por receita gerada</h2>
                      <DataTable columns={topColumns} data={topVendors ?? []} keyField="id" emptyMessage="Sem serviços concluídos ainda." />
                    </div>
                  </div>
                )}
                {/* Só o circular: as barras e o donut liam os MESMOS `byCategory`,
                    lado a lado. Duas leituras do mesmo número não acrescentam
                    nada — e a proporção é o que interessa aqui. */}
                {sub === "categoria" && (
                  <ChartCard title="Distribuição de técnicos por categoria" subtitle="Áreas de operação em que estão registados">
                    <DonutChartComponent data={byCategory ?? []} centerLabel="Técnicos" />
                  </ChartCard>
                )}
                {sub === "cobertura" && (
                  <div className="space-y-5">
                    {/* Sem cobertura declarada não se pode falar de oferta —
                        dizê-lo em vez de mostrar zeros que parecem factos. */}
                    {coberturaPorMedir && (
                      <div className="card border-l-[3px] border-l-warning p-4">
                        <p className="font-semibold text-text-primary">Cobertura por medir</p>
                        <p className="text-sm text-text-secondary mt-1">
                          Nenhum técnico declarou zonas na app, por isso a &ldquo;oferta&rdquo; aparece a zero em todas as cidades —
                          <b className="text-text-primary"> isso não quer dizer que não haja técnicos lá</b>, quer dizer que não está medido.
                          A procura abaixo é real. Para saber quem cobre cada zona, o backend precisa de expor a morada/cidade
                          de cada técnico (ver INTEGRACAO_LARAVEL_BACKOFFICE.md).
                        </p>
                      </div>
                    )}

                    {/* O que decide: onde falta gente e onde vale a pena abrir. */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MetricCard title="Zonas abertas" metric={buildMetricValue(coberturaResumo.zonasAbertas, coberturaResumo.zonasAbertas)} hideDelta />
                      <MetricCard title={coberturaPorMedir ? "Zonas por medir" : "Zonas sem técnicos"}
                        metric={buildMetricValue(coberturaResumo.zonasSemTecnicos, coberturaResumo.zonasSemTecnicos)} hideDelta />
                      <MetricCard title="Cidades candidatas" metric={buildMetricValue(coberturaResumo.candidatas, coberturaResumo.candidatas)} hideDelta />
                      <MetricCard title="Técnicos a cobrir zonas" metric={buildMetricValue(coberturaResumo.tecnicosDistintos, coberturaResumo.tecnicosDistintos)} hideDelta />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Onde falta gente — procura acima da oferta, o mais urgente primeiro. */}
                      <div className="card overflow-hidden">
                        <div className="border-b border-surface-border px-4 py-3">
                          <h3 className="font-semibold text-text-primary">
                            {coberturaPorMedir ? "Onde há mais procura" : "Onde falta gente"}
                          </h3>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {coberturaPorMedir
                              ? "Pedidos de serviço por cidade (dados reais)"
                              : "Zonas com mais pedidos do que técnicos a cobri-las"}
                          </p>
                        </div>
                        <div className="p-4 space-y-2.5">
                          {zonasEmFalta.length === 0 ? (
                            <p className="text-sm text-text-muted py-4 text-center">Sem dados de procura por zona.</p>
                          ) : zonasEmFalta.map((z) => (
                            <div key={z.name}>
                              <div className="flex items-baseline justify-between text-sm">
                                <span className="font-medium text-text-primary">{z.name}</span>
                                <span className="text-text-secondary tabular-nums">
                                  {z.procura} pedido{z.procura === 1 ? "" : "s"}
                                  {!coberturaPorMedir && ` · ${z.oferta} técnico${z.oferta === 1 ? "" : "s"}`}
                                </span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                                <div className={cn("h-full rounded-full", z.oferta === 0 ? "bg-danger" : z.ratio > 2 ? "bg-warning" : "bg-piquet")}
                                  style={{ width: `${Math.min(100, (z.procura / Math.max(1, zonasEmFalta[0].procura)) * 100)}%` }} />
                              </div>
                              {z.oferta === 0 && !coberturaPorMedir && (
                                <p className="text-[11px] text-danger mt-0.5">Nenhum técnico cobre esta zona</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Onde abrir a seguir — candidatas por interesse declarado. */}
                      <div className="card overflow-hidden">
                        <div className="flex items-start justify-between gap-2 border-b border-surface-border px-4 py-3">
                          <div>
                            <h3 className="font-semibold text-text-primary">Onde abrir a seguir</h3>
                            <p className="text-xs text-text-secondary mt-0.5">Cidades candidatas, por técnicos interessados</p>
                          </div>
                          <DemoBadge endpoint="/coverage" />
                        </div>
                        <div className="p-4 space-y-2.5">
                          {candidatasOrdenadas.length === 0 ? (
                            <p className="text-sm text-text-muted py-4 text-center">Sem cidades candidatas.</p>
                          ) : candidatasOrdenadas.slice(0, 8).map((c) => (
                            <button key={c.id} onClick={() => setSelectedArea({ label: c.city, technicians: c.technicians })}
                              className="w-full text-left group">
                              <div className="flex items-baseline justify-between text-sm">
                                <span className="font-medium text-text-primary group-hover:text-piquet-700 transition-colors">
                                  {c.city}
                                  {c.district && <span className="text-text-muted font-normal"> · {c.district}</span>}
                                  {!c.active && <span className="ml-1.5 text-[11px] rounded bg-surface-subtle px-1 py-0.5 text-text-muted">fechada a votos</span>}
                                </span>
                                <span className="text-text-secondary tabular-nums">{c.technicians.length}</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                                <div className="h-full rounded-full bg-piquet"
                                  style={{ width: `${Math.min(100, (c.technicians.length / Math.max(1, candidatasOrdenadas[0].technicians.length)) * 100)}%` }} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Zonas já abertas — quem as cobre. */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Zonas abertas</h3>
                        <DemoBadge endpoint="/coverage" />
                      </div>
                      <p className="text-sm text-text-secondary mb-3">
                        Cada técnico indica na própria app onde pode atuar — clica numa zona para ver quem a marcou.
                      </p>
                      <DataTable<CoverageOpenZone>
                        columns={[
                          { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
                          { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
                          { key: "technicians", label: "Técnicos", render: (r) => (
                            <span className={cn("tabular-nums font-medium", r.technicians.length === 0 && "text-danger")}>
                              {r.technicians.length}
                            </span>
                          ) },
                          { key: "estado", label: "", render: (r) => r.technicians.length === 0
                            ? <span className="text-xs text-danger">sem cobertura</span>
                            : <span className="text-xs text-text-muted">ver técnicos →</span> },
                        ]}
                        data={zonasAbertasOrdenadas}
                        keyField="id"
                        onRowClick={(r) => setSelectedArea({ label: r.city, technicians: r.technicians })}
                        emptyMessage="Sem zonas abertas"
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <ChartCard title="Técnicos por zona" subtitle="Zonas de cobertura declaradas"><BarChartComponent data={byLocation ?? []} /></ChartCard>
                      <ChartCard title="Procura vs oferta" subtitle="Pedidos de serviço vs técnicos que cobrem a zona">
                        <HeatMapGrid data={(coverage ?? []).map((c) => ({ name: c.name, value: c.procura, ratio: c.ratio }))} />
                      </ChartCard>
                    </div>
                  </div>
                )}
                {sub === "mapa" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-secondary">
                        {(liveLocations?.length ?? 0) === 0
                          ? "Nenhum técnico online com localização recente."
                          : `${liveLocations!.length} técnico${liveLocations!.length === 1 ? "" : "s"} online agora`}
                        {" — "}atualiza a cada 15s. Só informativo: não afeta a atribuição de serviços.
                      </p>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showTestAccounts}
                            onChange={(e) => setShowTestAccounts(e.target.checked)}
                            className="rounded border-surface-border"
                          />
                          Mostrar contas de teste
                        </label>
                        <button onClick={openTestAccountModal} className="btn-secondary text-xs py-1">Criar conta de teste</button>
                      </div>
                    </div>
                    <div className="card overflow-hidden">
                      <TechnicianMap locations={liveLocations ?? []} />
                    </div>
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}

        {tab === "aprovacoes" && (
          <div className="space-y-4">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Documentação completa" metric={buildMetricValue(metrics.docComplete, metrics.docComplete)} hideDelta />
                <MetricCard title="Em validação" metric={buildMetricValue(metrics.inValidation, metrics.inValidation)} hideDelta />
                <MetricCard title="Taxa conclusão perfil" metric={buildMetricValue(metrics.profileCompletionRate, metrics.profileCompletionRate)} hideDelta format="percent" />
                <MetricCard title="Podem aceitar serviço" metric={buildMetricValue(metrics.eligible, metrics.eligible)} hideDelta />
              </div>
            )}
            {docsIncompletos > 0 && (
              <div className="card border-l-[3px] border-l-warning p-4">
                <p className="font-semibold text-text-primary">Lista incompleta</p>
                <p className="text-sm text-text-secondary mt-1">
                  O backend não conseguiu devolver cerca de <b className="text-text-primary">{docsIncompletos}</b> documentos
                  (erro do servidor em algumas páginas). Os estados mostrados nas colunas e nos perfis podem estar
                  incompletos para esses técnicos — não quer dizer que não tenham entregado.
                </p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-text-secondary max-w-2xl">
                Documentos enviados pelos técnicos, à espera de revisão. Aprovar ou recusar notifica o técnico a sério (email + push) <DemoBadge endpoint="/vendor-documents" />
              </p>
              <div className="flex gap-1 shrink-0">
                {([
                  { id: "pending", label: "Pendentes" },
                  { id: "approved", label: "Aprovados" },
                  { id: "declined", label: "Recusados" },
                ] as { id: VendorDocumentStatus; label: string }[]).map((s) => (
                  <button key={s.id} onClick={() => setDocStatus(s.id)}
                    className={cn("text-xs px-2 py-1 rounded", docStatus === s.id ? "bg-piquet text-ink" : "bg-surface-muted text-text-secondary")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <DataTable
              columns={[
                { key: "vendor_name", label: "Técnico", render: (r: VendorDocument) => <span className="font-medium">{r.vendor_name ?? "—"}</span> },
                { key: "document_type", label: "Documento", render: (r: VendorDocument) => r.document_type ?? "—" },
                { key: "created_at", label: "Enviado em", render: (r: VendorDocument) => r.created_at ? formatDateTime(r.created_at) : "—" },
                { key: "file_url", label: "Ficheiro", render: (r: VendorDocument) => r.file_url
                  ? <button onClick={() => setPreviewDoc(r)} className="inline-flex items-center gap-1.5 text-xs font-medium text-piquet-600 hover:text-piquet-700">
                      <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                    </button>
                  : <span className="text-text-muted text-xs">—</span> },
                { key: "acao", label: "", render: (r: VendorDocument) => r.status === "pending" ? (
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => openApprove(r)} className="text-xs text-success hover:underline">Aprovar</button>
                    <button onClick={() => openDecline(r)} className="text-sm text-danger hover:underline">Recusar</button>
                  </div>
                ) : null },
              ]}
              data={docsData.data?.items ?? []}
              keyField="id"
              loading={docsData.loading}
              emptyMessage={docStatus === "pending" ? "Sem documentos pendentes 🎉" : "Sem documentos neste estado"}
            />
          </div>
        )}

        {tab === "lista" && (
          <SubTabs tabs={[
            { id: "todos", label: "Todos" },
            { id: "suspensoes", label: "Suspensões", count: suspendedVendors?.total ?? 0 },
          ]}>
            {(sub) => (
              <>
                {sub === "todos" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar técnicos..." />
                      <div className="chip-row">
                        {([
                          { id: "", label: "Todos" },
                          { id: "validada", label: "AT validada" },
                          { id: "por_validar", label: "AT por validar" },
                          // Sem NIF não há como faturar em nome do técnico —
                          // são registos que nunca poderão receber.
                          { id: "sem_nif", label: "Sem NIF" },
                        ] as const).map((f) => (
                          <button key={f.id} onClick={() => setAtFilter(f.id)}
                            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                              atFilter === f.id
                                ? "border-piquet/30 bg-piquet/15 text-piquet-700"
                                : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
                            {f.label}
                            {f.id && atFilter && (
                              <span className={cn("tabular-nums text-xs", atFilter === f.id ? "opacity-80" : "text-text-muted")}>
                                {f.id === "validada" ? atCounts.validada
                                  : f.id === "por_validar" ? atCounts.por_validar
                                  : atCounts.sem_nif}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {atFilter ? (
                      <>
                        <p className="text-sm text-text-secondary">
                          <b className="text-text-primary tabular-nums">{atFiltered.length}</b>{" "}
                          {atFilter === "validada" ? "com a AT validada" : "com a AT por validar"}
                          {atCounts.carregados > 0 && ` · de ${atCounts.carregados} técnicos`}
                        </p>
                        <DataTable columns={columns} data={atFiltered} keyField="id" loading={allVendorsLoading}
                          onRowClick={(r) => setProfileVendor(r)}
                          emptyMessage={atFilter === "validada" ? "Nenhum técnico com a AT validada." : "Nenhum técnico com a AT por validar 🎉"} />
                      </>
                    ) : (
                      <>
                        <DataTable columns={columns} data={vendors?.data ?? []} keyField="id" loading={loading}
                          onRowClick={(r) => setProfileVendor(r)} />
                        {vendors && <Pagination page={page} totalPages={vendors.totalPages} total={vendors.total} pageSize={pageSize} onPageChange={setPage} />}
                      </>
                    )}
                  </div>
                )}
                {sub === "suspensoes" && (
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Técnicos suspensos — sem acesso a novos serviços até reativação.</p>
                    <DataTable
                      columns={suspendedColumns}
                      data={suspendedVendors?.data ?? []}
                      keyField="id"
                      loading={suspendedLoading}
                      emptyMessage="Sem técnicos suspensos 🎉"
                    />
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}
      </div>

      <Modal
        open={!!reviewDoc}
        onClose={closeReview}
        title={reviewAction === "approve" ? "Aprovar documento" : "Recusar documento"}
        subtitle={reviewDoc ? `${reviewDoc.document_type ?? "Documento"} · ${reviewDoc.vendor_name ?? "—"}` : undefined}
        footer={
          <>
            <button onClick={closeReview} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={confirmReview} disabled={savingReview} className="btn-primary text-sm">
              {savingReview ? "A processar…" : reviewAction === "approve" ? "Aprovar" : "Recusar"}
            </button>
          </>
        }
      >
        {reviewDoc && reviewAction === "approve" && (
          <div className="space-y-4">
            {reviewDoc.file_url && <DocumentPreview url={reviewDoc.file_url} docId={reviewDoc.id} heightClass="h-[40vh]" />}
            <Field label="Data de expiração" hint="Opcional">
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="input-field" />
            </Field>
          </div>
        )}
        {reviewDoc && reviewAction === "decline" && (
          <div className="space-y-4">
            {reviewDoc.file_url && <DocumentPreview url={reviewDoc.file_url} docId={reviewDoc.id} heightClass="h-[40vh]" />}
            <Field label="Motivo" hint="Obrigatório — vai no email para o técnico">
              <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={4} className="input-field" placeholder="Ex.: Documento ilegível, por favor envia uma foto mais nítida." />
            </Field>
          </div>
        )}
      </Modal>

      {/* Perfil do técnico — o que entregou, o que falta e o que está por validar. */}
      <Modal
        open={!!profileVendor}
        onClose={() => setProfileVendor(null)}
        size="full"
        title={profileVendor?.name ?? "Técnico"}
        subtitle={profileVendor ? [profileVendor.nif && `NIF ${profileVendor.nif}`, profileVendor.phone_number, profileVendor.created_at && `registado ${formatDate(profileVendor.created_at)}`].filter(Boolean).join(" · ") : undefined}
        footer={<button onClick={() => setProfileVendor(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {profileVendor && (() => {
          const v = profileVendor;
          const states = docsByVendor.get(v.id);
          const emFalta = missingCount(states);
          const meus = docsOfVendor(v.id);
          const outros = meus.filter((d) => !classifyDocument(d.document_type));
          const at = atValidationState(v);
          const atUi = AT_STATE_UI[at];
          const utilizador = atUser(v);
          const morada = v.address || v.billing_address || null;
          // A designação fiscal é a própria company_name -- não há coluna
          // separada no backend.
          const temFaturacao = Boolean(v.company_name || morada || v.postal_code || v.city || v.iban);

          /*
            Há workspace de faturação?

            Três respostas, não duas -- e a diferença importa. `undefined` é o
            backend a NÃO enviar o campo (a versão em produção ainda não o
            expõe); `null`/"" é o backend a dizer que não existe. Tratar as
            duas como "não existe" punha um aviso vermelho e um botão ativo em
            técnicos que já têm workspace, e clicar dava erro.

            E há uma prova indireta: `can_accept_service` é calculado no
            Laravel e EXIGE invoice_workspace != null (Vendor::canAcceptService).
            Se o técnico pode aceitar serviços, o workspace existe -- mesmo que
            o seu nome não venha na resposta.
          */
          const wsDesconhecido = v.invoice_workspace === undefined;
          const temWorkspace = Boolean(v.invoice_workspace) || (wsDesconhecido && v.can_accept_service);
          const podeCriarWs = !temWorkspace && !wsDesconhecido && !v.invoice_workspace_blocker;
          const wsMotivo = temWorkspace
            ? null
            : wsDesconhecido
              ? "O backend em produção ainda não devolve o workspace de faturação, por isso não dá para saber se existe. Criar às cegas podia duplicá-lo."
              : v.invoice_workspace_blocker
                ?? null;

          /** Rótulo curto do que falta ou está feito — o essencial de relance. */
          const chip = (ok: boolean, texto: string) => (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              ok ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-warning")} />
              {texto}
            </span>
          );

          return (
            <div className="space-y-5">
              {/* Estado de relance — substitui as três faixas de aviso que havia. */}
              <div className="flex flex-wrap items-center gap-2">
                {chip(emFalta === 0, emFalta === 0
                  ? "Documentação completa"
                  : `${emFalta} de ${REQUIRED_DOCS.length} documentos por aprovar`)}
                {chip(at === "validado", at === "validado" ? "AT validada" : "AT por validar")}
                {chip(v.can_accept_service, v.can_accept_service ? "Pode aceitar serviços" : "Não pode aceitar serviços")}
                {/* Sem NIF não há fatura possível em nome dele — 168 dos 422
                    técnicos estão assim (medido a 22/08). É bloqueio, não
                    detalhe: por isso aparece a vermelho e não como os outros. */}
                {!v.nif?.trim() && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-danger-light px-2.5 py-1 text-xs font-medium text-danger"
                    title="O técnico registou-se sem NIF. Sem ele não é possível emitir fatura em nome dele."
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                    Sem NIF
                  </span>
                )}
                {docsIncompletos > 0 && (
                  <span
                    className="text-xs text-text-muted cursor-help"
                    title={`O backend falhou a devolver ~${docsIncompletos} documentos. Se este técnico aparecer sem documentos, pode ser essa a razão.`}
                  >
                    · lista possivelmente incompleta
                  </span>
                )}
              </div>

              {/* Duas colunas: à esquerda o que se aprova, à direita o que se consulta. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* ------------------------- Documentos ------------------------- */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">Documentos obrigatórios</p>
                  {REQUIRED_DOCS.map((req) => {
                    const st = states?.[req.key] ?? "em_falta";
                    const ui = DOC_STATE_UI[st];
                    const doc = meus.find((d) => classifyDocument(d.document_type) === req.key);
                    return (
                      <div key={req.key} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary">{req.label}</p>
                          <p className={cn("text-sm", ui.tone)}>
                            {ui.symbol} {ui.label}
                            {doc?.created_at && st !== "em_falta" && ` · ${formatDate(doc.created_at)}`}
                            {doc?.expiration_date && st === "aprovado" && ` · expira ${formatDate(doc.expiration_date)}`}
                            {doc?.reason && st === "recusado" && ` · ${doc.reason}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc?.file_url && (
                            <button onClick={() => { setProfileVendor(null); setPreviewDoc(doc); }}
                              className="btn-secondary text-xs py-1" title="Ver documento">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {doc && doc.status === "pending" && (
                            <>
                              <button onClick={() => { setProfileVendor(null); openApprove(doc); }}
                                className="text-sm font-medium text-success hover:underline">Aprovar</button>
                              <button onClick={() => { setProfileVendor(null); openDecline(doc); }}
                                className="text-xs text-danger hover:underline">Recusar</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {outros.length > 0 && (
                    <details className="pt-1">
                      <summary className="text-xs text-text-muted cursor-pointer hover:text-text-primary">
                        Outros documentos ({outros.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {outros.map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-3 py-2">
                            <p className="text-sm text-text-primary truncate">{d.document_type ?? "Documento"}</p>
                            {d.file_url && (
                              <button onClick={() => { setProfileVendor(null); setPreviewDoc(d); }}
                                className="btn-secondary text-xs py-1 shrink-0"><Eye className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                {/* ------------------- Faturação: AT + empresa + dados ------------------ */}
                {/*
                  Uma tabela só, não três blocos. O subutilizador AT aparecia em
                  cima E outra vez nos dados da empresa (identificador, válido,
                  validado em) -- as mesmas três linhas duas vezes eram metade
                  do scroll deste painel.
                */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">Faturação e dados</p>
                    <div className="flex items-center gap-2">
                      {at === "validado" ? (
                        <button disabled={atSaving} onClick={() => setAtValidation(v, false)}
                          className="text-sm text-warning hover:underline disabled:opacity-50">Retirar AT</button>
                      ) : (
                        <button disabled={atSaving || !utilizador} onClick={() => setAtValidation(v, true)}
                          title={utilizador ? "Confirmar que o subutilizador está correto" : "Sem o identificador à vista, validar seria carimbar às cegas"}
                          className="btn-secondary text-sm py-1 disabled:opacity-40 disabled:cursor-not-allowed">
                          {atSaving ? "A gravar…" : "Validar AT"}
                        </button>
                      )}
                      {!temWorkspace && (
                        <button
                          disabled={wsSaving || !podeCriarWs}
                          onClick={() => criarWorkspace(v)}
                          title={wsMotivo ?? "Cria o workspace no InvoiceXpress para se poder faturar em nome deste técnico"}
                          className="btn-primary text-sm py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {wsSaving ? "A criar…" : "Criar workspace"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sem workspace não há fatura possível no fim do serviço --
                      é aviso a sério, e diz a razão que o backend dá. */}
                  {!temWorkspace && (
                    <div className="rounded-xl border-l-[3px] border-l-warning bg-warning-light/30 px-3 py-2">
                      <p className="text-sm text-text-secondary">
                        <b className="text-text-primary">Sem workspace de faturação.</b>{" "}
                        {wsMotivo ?? "A Piquet não pode emitir faturas em nome deste técnico até o workspace ser criado."}
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-surface-border divide-y divide-surface-border/60">
                    {([
                      ["Workspace de faturação", temWorkspace
                        ? (v.invoice_workspace ?? "Existe (nome não enviado)")
                        : "—"],
                      ["Nome da empresa", v.company_name ?? "—"],
                      ["Subutilizador AT", utilizador
                        ? <span key="at-user" className="font-mono">{utilizador}</span>
                        : "—"],
                      ["AT", <span key="at" className={atUi.tone}>{atUi.symbol} {atUi.label}
                        {v.at_validated_at && <span key="at-date" className="text-text-muted"> · {formatDate(v.at_validated_at)}</span>}</span>],
                      ["NIF", v.nif || "—"],
                      ["Morada fiscal", [morada, v.postal_code, v.city].filter(Boolean).join(", ") || "—"],
                      ["IBAN", v.iban ? <span key="iban" className="font-mono text-sm">{v.iban}</span> : "—"],
                      ["Preço/hora", v.price_rate !== null ? formatCurrency(v.price_rate) : "—"],
                      ["Categorias", v.operation_areas.length ? v.operation_areas.join(", ") : "—"],
                    ] as [string, React.ReactNode][]).map(([rotulo, valor]) => (
                      <div key={rotulo} className="flex items-baseline justify-between gap-4 px-3 py-1.5">
                        <span className="text-sm text-text-muted shrink-0">{rotulo}</span>
                        <span className="text-sm text-text-primary text-right truncate">{valor}</span>
                      </div>
                    ))}
                  </div>

                  {/*
                    Os serviços que o técnico escolheu fazer.

                    Lista própria e não mais uma linha na tabela acima: são
                    serviços do catálogo, não categorias, e um técnico costuma
                    ter dezenas -- juntá-los por vírgulas numa linha truncada
                    dava uma frase cortada que não responde a nada.

                    Fechado por omissão, com a contagem à vista: quem abre a
                    ficha quer saber QUANTOS e, às vezes, SE faz um em
                    concreto. Aberto de origem, empurrava o resto do perfil
                    para fora do ecrã.
                  */}
                  {(() => {
                    const servicos = v.services_types ?? [];
                    if (servicos.length === 0) {
                      return (
                        <p className="text-sm text-text-muted">
                          Sem serviços escolhidos — este técnico não entra no matching de nenhum pedido.
                        </p>
                      );
                    }
                    return (
                      <details open>
                        <summary className="text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary">
                          Serviços que faz ({servicos.length})
                        </summary>
                        {/*
                          Lista e não etiquetas: os nomes são frases ("Limpeza de
                          Colchão de Casal"), e em etiquetas o olho tem de saltar
                          entre linhas de larguras diferentes para ler cada uma.
                          Em coluna, lê-se de cima a baixo.

                          Duas colunas em ecrãs largos porque a maioria dos nomes
                          é curta e uma coluna só desperdiçava metade da largura
                          com dezenas de linhas.
                        */}
                        <ul className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface-subtle p-3
                                       columns-1 sm:columns-2 gap-x-6">
                          {[...servicos].sort((a, b) => a.localeCompare(b, "pt")).map((nome) => (
                            <li key={nome} className="break-inside-avoid py-1 pl-3 text-sm text-text-secondary
                                                      relative before:absolute before:left-0 before:top-[0.6em]
                                                      before:h-1 before:w-1 before:rounded-full before:bg-text-muted">
                              {nome}
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  })()}

                  {/*
                    Aviso preciso, e só quando se aplica. As colunas existem
                    todas na BD (company_name, at_user, iban, invoice_workspace
                    e a morada FISCAL_ADDRESS): o que falta é o
                    VendorController::present() as devolver, o que já está
                    escrito na branch feat/admin-payment-refund-cancel e à
                    espera de deploy da RW Interactive. Dizer "por enviar pelo
                    backend" sem mais mandava procurar um problema que não
                    existe.
                  */}
                  {/*
                    O que a API devolve MESMO, para este técnico.
                    Quando um campo aparece vazio no painel, a pergunta é
                    sempre a mesma -- "o backend não manda, ou manda com outro
                    nome?" -- e discutir isso de memória não leva a lado
                    nenhum. Aqui vê-se a resposta crua, sem sair do ecrã.
                  */}
                  <details>
                    <summary className="text-xs text-text-muted cursor-pointer hover:text-text-primary">
                      Dados brutos da API ({Object.keys(v).length} campos)
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-subtle p-2 text-[11px] leading-snug text-text-secondary">
                      {JSON.stringify(v, null, 2)}
                    </pre>
                  </details>

                  {!temFaturacao && !v.company_name && (
                    <p className="text-xs text-text-muted cursor-help"
                      title="Os dados existem na base de dados do Laravel; o VendorController ainda não os devolve na API de admin. Já implementado na branch feat/admin-payment-refund-cancel, por publicar.">
                      Empresa, IBAN e morada fiscal existem no Laravel mas ainda não vêm na API — falta publicar a versão do backend que os expõe.
                    </p>
                  )}

                  {/*
                    Apagar de vez.

                    Ao fundo, isolado por uma linha e em texto discreto: é a
                    única ação da ficha que não tem volta, e não devia estar ao
                    lado das que se carregam por engano. Quem o procura,
                    encontra; quem não o procura, não lhe tropeça.
                  */}
                  <div className="border-t border-surface-border pt-3">
                    <button
                      onClick={() => setVendorParaApagar(v)}
                      className="text-sm text-text-muted hover:text-danger transition-colors"
                    >
                      Apagar este técnico em definitivo
                    </button>
                  </div>

                  {/*
                    O que este técnico escreveu. Vive aqui porque é aqui que
                    pertence: antes, uma mensagem dele só podia existir agarrada
                    a uma lead, e por isso aparecia no CRM como um pedido de
                    serviço vindo de quem os executa.
                  */}
                  <div className="pt-1">
                    <WhatsappConversa
                      tecnicoId={String(v.id)}
                      temTelefone={Boolean(v.phone_number)}
                      waNumero={(v.phone_number || "").replace(/\D/g, "").length === 9
                        ? `351${(v.phone_number || "").replace(/\D/g, "")}`
                        : (v.phone_number || "").replace(/\D/g, "")}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Pré-visualização do documento — rever sem descarregar. */}
      <Modal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        size="xl"
        title={previewDoc?.document_type ?? "Documento"}
        subtitle={previewDoc ? `${previewDoc.vendor_name ?? "Técnico"}${previewDoc.created_at ? ` · enviado ${formatDateTime(previewDoc.created_at)}` : ""}` : undefined}
        footer={
          previewDoc?.status === "pending" ? (
            <>
              <button onClick={() => { const d = previewDoc; setPreviewDoc(null); if (d) openDecline(d); }} className="btn-secondary text-sm text-danger">Recusar</button>
              <button onClick={() => { const d = previewDoc; setPreviewDoc(null); if (d) openApprove(d); }} className="btn-primary text-sm">Aprovar</button>
            </>
          ) : (
            <button onClick={() => setPreviewDoc(null)} className="btn-secondary text-sm">Fechar</button>
          )
        }
      >
        {previewDoc?.file_url
          ? <DocumentPreview url={previewDoc.file_url} docId={previewDoc.id} />
          : <p className="text-sm text-text-muted py-8 text-center">Este documento não tem ficheiro associado.</p>}
      </Modal>

      <Modal
        open={!!selectedArea}
        onClose={() => setSelectedArea(null)}
        title={selectedArea?.label ?? ""}
        subtitle={selectedArea ? `${selectedArea.technicians.length} técnico${selectedArea.technicians.length === 1 ? "" : "s"}` : undefined}
        footer={<button onClick={() => setSelectedArea(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {selectedArea && (
          selectedArea.technicians.length === 0 ? (
            <p className="text-sm text-text-secondary">Ainda nenhum técnico marcou esta área.</p>
          ) : (
            <div className="space-y-2">
              {selectedArea.technicians.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-subtle text-sm">
                  <div>
                    <p className="font-medium">{t.name ?? "—"}</p>
                    <p className="text-text-secondary text-xs">{t.nif ?? "—"} · {t.phone_number ?? t.email ?? "—"}</p>
                  </div>
                  <StatusBadge status={t.status ?? "Offline"} />
                </div>
              ))}
            </div>
          )
        )}
      </Modal>

      {/* Criar conta de teste — já pronta a ficar Online (documentos
          aprovados, faturação/AT preenchidos). A password só aparece uma
          vez, aqui — não fica guardada em lado nenhum do backoffice. */}
      <Modal
        open={testAccountModalOpen}
        onClose={() => setTestAccountModalOpen(false)}
        title="Criar conta de teste"
        subtitle="Fica pronta a ficar Online na app-vendor de imediato — login é por email + password."
        footer={
          newTestVendor ? (
            <button onClick={() => setTestAccountModalOpen(false)} className="btn-primary text-sm">Fechar</button>
          ) : (
            <>
              <button onClick={() => setTestAccountModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={submitTestAccount} disabled={creatingTestAccount} className="btn-primary text-sm disabled:opacity-60">
                {creatingTestAccount ? "A criar…" : "Criar conta"}
              </button>
            </>
          )
        }
      >
        {newTestVendor ? (
          <div className="space-y-3">
            <div className="rounded-lg border-l-[3px] border-l-warning bg-warning-light/40 p-3">
              <p className="text-sm font-semibold text-text-primary">Guarda já esta password — só aparece agora.</p>
              <p className="text-xs text-text-secondary mt-0.5">Não fica recuperável depois de fechares esta janela.</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2">
                <span className="text-text-secondary">Email</span>
                <span className="font-mono font-medium">{newTestVendor.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2">
                <span className="text-text-secondary">Password</span>
                <span className="font-mono font-medium">{newTestVendor.password}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2">
                <span className="text-text-secondary">Telefone</span>
                <span className="font-mono font-medium">{newTestVendor.phone_number}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Entra na app do técnico com este email e password, liga o &ldquo;Online&rdquo; e o pin aparece no mapa
              (com &ldquo;Mostrar contas de teste&rdquo; ligado) em poucos segundos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <input className="input-field" value={testAccountForm.first_name}
                  onChange={(e) => setTestAccountForm((f) => ({ ...f, first_name: e.target.value }))} />
              </Field>
              <Field label="Apelido">
                <input className="input-field" value={testAccountForm.last_name}
                  onChange={(e) => setTestAccountForm((f) => ({ ...f, last_name: e.target.value }))} />
              </Field>
            </div>
            <Field label="Telefone" hint="Não precisa de ser um número real de telemóvel.">
              <input className="input-field" value={testAccountForm.phone_number}
                onChange={(e) => setTestAccountForm((f) => ({ ...f, phone_number: e.target.value }))} placeholder="+351910000000" />
            </Field>
            <Field label="Email (opcional)" hint="Se deixares vazio, é gerado um automaticamente.">
              <input className="input-field" type="email" value={testAccountForm.email}
                onChange={(e) => setTestAccountForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      {/*
        A confirmação diz o que vai acontecer, com nomes e números, em vez de
        "tem a certeza?". O que se perde aqui não se recupera, e a pessoa que
        carrega merece ver a lista antes, não um aviso genérico.
      */}
      <ConfirmDialog
        open={vendorParaApagar !== null}
        onClose={() => setVendorParaApagar(null)}
        onConfirm={async () => { if (vendorParaApagar) await apagarDeVez(vendorParaApagar); }}
        title="Apagar o técnico em definitivo"
        tone="danger"
        confirmLabel="Apagar para sempre"
        loading={aApagar}
        description={
          <div className="space-y-2 text-sm">
            <p>
              <b className="text-text-primary">{vendorParaApagar?.name ?? "Este técnico"}</b> e a conta dele
              desaparecem. <b className="text-text-primary">Não há como desfazer.</b>
            </p>
            <p className="text-text-secondary">
              Vão com ele: avaliações, documentos, candidaturas a pedidos, zonas, cidades,
              tickets de suporte e agenda.
            </p>
            <p className="text-text-secondary">
              <b className="text-text-primary">Os serviços que ele executou ficam</b>, mas sem técnico
              associado. O total faturado não muda; o que ele faturou deixa de lhe ser atribuído, e
              as faturas já emitidas passam a apontar para alguém que não existe.
            </p>
            <p className="text-text-muted">
              Se a pessoa só saiu, <b className="text-text-primary">Suspender</b> faz o mesmo efeito na
              prática e tem volta.
            </p>
          </div>
        }
      />
    </RouteGuard>
  );
}
