"use client";

import { useState, useMemo, useEffect } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { HardHat, Eye } from "lucide-react";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { useTabParam } from "@/hooks/useTabParam";
import { useAbrirPeloEndereco } from "@/hooks/useAbrirPeloEndereco";
import { getVendors, suspendVendor, restoreVendor, deleteVendorPermanently, getVendorMetrics, getTopVendors, getOnboardingTecnicos, setVendorAtValidation, createVendorInvoiceWorkspace, createTestVendor, type RealVendor, type TopVendor, type NewTestVendor, type ContagemWorkspaces, getTecnicosSemWorkspace, type TecnicoSemWorkspace, getResumoDocumentos, type TecnicoComDocumento, getVendor } from "@/services/vendorsService";

import { getVendorDocuments, getAllVendorDocuments, approveVendorDocument, declineVendorDocument, type VendorDocument, type VendorDocumentStatus } from "@/services/vendorDocumentsService";
import { Modal, Field } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HistoricoDaEquipa } from "@/components/ui/HistoricoDaEquipa";
import { getMotivos } from "@/services/acoesDaEquipaService";
import { MOTIVO_MINIMO } from "@/lib/motivo";
import { WhatsappConversa } from "@/components/ui/WhatsappConversa";
import { ETAPA_LABEL, ESPERA_POR_NOS, type Etapa } from "@/lib/onboardingTecnicos";
import { REQUIRED_DOCS, DOC_STATE_UI, indexDocsByVendor, missingCount, classifyDocument, atValidationState, AT_STATE_UI } from "@/lib/vendorDocs";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";



/**
 * Onde é que os técnicos estão travados, pela ordem em que os degraus se
 * atravessam.
 *
 * NÃO é ordenado por tamanho, de propósito: é um caminho, e ver os degraus
 * fora de ordem esconde que resolver o primeiro não liberta ninguém para o
 * fim -- só o empurra para o segundo.
 *
 * Um total diz onde se está; isto diz o que fazer a seguir.
 */
function Degraus({ contagem }: { contagem: ContagemWorkspaces }) {
  const d = contagem.degraus;
  const antigos = d.semContacto - d.semContactoRecentes;

  const passos = [
    {
      rotulo: "Contactos por verificar",
      n: d.semContacto,
      nota: antigos > 0
        ? formatNumber(antigos) + " há mais de 90 dias — registos abandonados"
        : "nem email nem telemóvel confirmados",
      // O que está parado há meses não é trabalho pendente, é ruído no
      // denominador -- e por isso não se pinta da cor de quem espera por nós.
      tom: "bg-text-muted",
      destaque: false,
    },
    /*
      NÃO é "documentos na fila de revisão" -- essa fila está noutro sítio
      (Aprovações) e pode estar a zero ao mesmo tempo que isto marca 158.

      `all_documents_verified` exige, para CADA documento obrigatório, um
      aprovado e não expirado. Falha para quem nunca submeteu, para quem foi
      recusado e para quem tem um documento expirado -- e nenhum desses está
      à espera de revisão. Chamar-lhe "por aprovar" mandava alguém procurar
      trabalho que não existe.
    */
    { rotulo: "Documentação incompleta", n: d.documentosPorAprovar,
      nota: "não submeteram, foram recusados ou expiraram — depende deles",
      tom: "bg-warning", destaque: false },
    { rotulo: "IBAN em falta", n: d.semIban, nota: "falta-lhes entregar", tom: "bg-warning", destaque: false },
    { rotulo: "Morada fiscal em falta", n: d.semMoradaFiscal, nota: "falta-lhes entregar", tom: "bg-warning", destaque: false },
    // O quinto degrau: fizeram 3 serviços e a AT passou a ser exigida.
    { rotulo: "AT por entregar", n: d.semAT,
      nota: "já fizeram 3 serviços — a AT passou a ser obrigatória", tom: "bg-warning", destaque: false },
    { rotulo: "Nada em falta", n: d.nadaEmFalta, nota: "passaram todos os degraus", tom: "bg-success", destaque: false },
  ].concat(
    // Um código de bloqueio que este ecrã não conhece aparece à parte em vez
    // de se esconder dentro do "nada em falta" — foi assim que o
    // `at_user_missing` passou despercebido.
    d.desconhecido > 0
      ? [{ rotulo: "Motivo desconhecido", n: d.desconhecido,
           nota: "o backend devolveu um bloqueio que este ecrã não sabe ler",
           tom: "bg-danger", destaque: true }]
      : [],
  );

  // O que depende de NÓS vai à parte, e só aparece quando existe. Nenhum dos
  // degraus acima é trabalho nosso: todos dependem do técnico.
  const nossos = [
    // O mesmo nome que em Aprovações: "à espera de nós" queria dizer
    // documentos no ecrã de Onboarding e workspaces aqui.
    { rotulo: "Workspace por criar", n: contagem.aEspera,
      nota: "têm tudo — falta criarmos o workspace de faturação (em Aprovações)" },
  ];

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-semibold text-text-primary">Onde estão travados</p>
      <p className="text-xs text-text-secondary mt-0.5 mb-3">
        Cada técnico conta no primeiro degrau que falha. Resolver um não leva ninguém ao fim — passa-o ao seguinte.
      </p>
      <ul className="space-y-2.5">
        {passos.concat(nossos.filter((n) => n.n > 0).map((n) => ({ ...n, tom: "bg-piquet", destaque: true }))).map((passo) => (
          <li key={passo.rotulo}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn("text-sm", passo.destaque ? "font-semibold text-text-primary" : "text-text-secondary")}>
                {passo.rotulo}
              </span>
              <span className="text-sm font-semibold tabular-nums text-text-primary shrink-0">
                {formatNumber(passo.n)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-muted mt-1 overflow-hidden">
              <div className={cn("h-full rounded-full", passo.tom)}
                style={{ width: (contagem.total > 0 ? (passo.n / contagem.total) * 100 : 0) + "%" }} />
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">{passo.nota}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Um grupo de técnicos com o mesmo problema de documentação.
 *
 * Cada linha diz QUEM, QUE documento e PORQUÊ — os três sem abrir nada. Uma
 * lista que obriga a abrir cada perfil para saber o que falta não poupa
 * trabalho a ninguém.
 */
function GrupoDeDocumentos({ titulo, nota, tecnicos, detalhe, onAbrir }: {
  titulo: string;
  nota: string;
  tecnicos: TecnicoComDocumento[];
  detalhe: (d: TecnicoComDocumento["documentos"][number]) => string;
  /** Leva à Lista já filtrada por este técnico. */
  onAbrir: (nome: string) => void;
}) {
  return (
    <div className="border-b border-surface-border last:border-0">
      <div className="px-4 sm:px-5 py-2 bg-surface-subtle">
        <p className="text-xs font-semibold text-text-primary">
          {titulo} <span className="font-normal text-text-muted">· {nota}</span>
        </p>
      </div>
      <ul className="divide-y divide-surface-border">
        {tecnicos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{t.name ?? `Técnico ${t.id}`}</p>
              <p className="text-xs text-text-muted">
                {t.documentos.map((d) => `${d.nome} — ${detalhe(d)}`).join(" · ")}
              </p>
            </div>
            {/*
              Leva à Lista filtrada pelo nome, e não ao perfil directamente: o
              perfil abre com o objeto completo do técnico, que esta lista não
              tem -- só id e nome. Filtrar a lista chega lá em dois cliques em
              vez de um, e não obriga a ir buscar o técnico inteiro só para
              ter um botão.
            */}
            <button onClick={() => onAbrir(t.name ?? String(t.id))} className="btn-secondary text-xs shrink-0">
              Ver na lista
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * O que há para fazer em Aprovações: um número por trabalho, cada um a levar
 * à sua secção. Zero aparece apagado — não há nada a fazer ali.
 */
function ResumoDoKyc({ itens, nota }: { itens: Array<{ id: string; rotulo: string; n: number }>; nota?: string }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {itens.map((i) => (
          <button key={i.rotulo} type="button" disabled={i.n === 0}
            onClick={() => document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={cn("card p-3 text-left transition-shadow", i.n > 0 ? "hover:shadow-elevated border-piquet/40" : "opacity-60 cursor-default")}>
            <p className={cn("text-2xl font-bold tabular-nums", i.n > 0 ? "text-text-primary" : "text-text-muted")}>{formatNumber(i.n)}</p>
            <p className="text-xs text-text-secondary">{i.rotulo}</p>
          </button>
        ))}
      </div>
      {nota && <p className="text-xs text-text-muted">{nota}</p>}
    </div>
  );
}

export default function TecnicosView({ abrirId }: { abrirId?: string } = {}) {
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  // ?tab=aprovacoes — deep-link vindo dos avisos da Visão executiva.
  const [tab, setTab] = useTabParam("resumo");
  // A Cobertura passou para Mercado (09/10/2026); os links antigos levam lá.
  useEffect(() => {
    if (tab === "cobertura") window.location.replace("/mercado?tab=cobertura");
  }, [tab]);
  // Endereços antigos: ?tab=visao era o Resumo.
  useEffect(() => { if (tab === "visao") setTab("resumo"); }, [tab, setTab]);

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
  /*
    Quem entregou o acesso à AT e espera que lhe criem o workspace.

    Rota própria e não um filtro da lista: a lista é paginada, e filtrar a
    página aberta mostrava dois ou três dos oito. A condição é a mesma que
    dispara a notificação (lib/avisosOperacao.ts), importada e não copiada.
  */
  const { data: semWorkspace, refetch: refetchSemWorkspace } = useAsyncData(() => getTecnicosSemWorkspace(), []);

  /*
    Quem tem documentos expirados ou recusados. São os dois grupos em que uma
    pessoa resolve uma pessoa -- ao contrário dos 337 que nunca submeteram,
    que se resolvem no funil de inscrição e não aqui.
  */
  /*
    SÓ NA ABA QUE PRECISA. Este endpoint agrega os 460 técnicos e os seus
    documentos no Laravel -- é o pedido mais lento do ecrã. Corria em cada
    abertura da página, mesmo quem só queria ver a Visão geral, e era metade
    da demora de que o André se queixou.
  */
  // As inscrições paradas (o que era o ecrã Onboarding): só na aba Aprovações.
  const { data: inscricoes } = useAsyncData(
    () => (tab === "aprovacoes" ? getOnboardingTecnicos().catch(() => null) : Promise.resolve(null)),
    [tab],
  );
  const paradosPorEles = (inscricoes?.parados ?? []).filter((t) => !(t.etapa && ESPERA_POR_NOS[t.etapa as Etapa]));
  const { data: docs } = useAsyncData(
    () => (tab === "aprovacoes" ? getResumoDocumentos() : Promise.resolve(null)),
    [tab],
  );

  const { data: topVendors } = useAsyncData(() => getTopVendors(10), []);

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


  // KYC — fila real de documentos por rever (App\Filament\...\VendorDocumentTextEntry
  // migrado). Contagem do separador vem sempre de "pending", independente do
  // filtro escolhido dentro do separador.
  // `revisaoFeita` incrementa a cada documento aprovado/recusado: sem isso, o
  // badge do separador e o banner de avisos ficavam com os números de quando a
  // página abriu — a tabela esvaziava ("Sem documentos pendentes") mas o topo
  // continuava a dizer que havia N por validar até se recarregar à mão.
  const [revisaoFeita, setRevisaoFeita] = useState(0);
  const { data: pendingDocsMeta } = useAsyncData(() => getVendorDocuments("pending", 1, 1), [revisaoFeita]);
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
  const [atFilter, setAtFilter] = useState<"" | "validada" | "por_validar" | "sem_nif" | "suspensos">("");
  const { data: allVendors, loading: allVendorsLoading } = useAsyncData(
    () => (atFilter && atFilter !== "suspensos" ? getVendors(1, 500, debouncedSearch || undefined) : Promise.resolve(null)),
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

  /*
    A ficha tem endereço próprio (/tecnicos/94). Ao abrir por esse endereço lê-se
    o registo pelo id (backend #165), em vez de o procurar pelo nome; ao abrir
    ou fechar a ficha na lista, o endereço acompanha -- para se poder copiar e
    mandar a quem precisa.
  */
  const [urlPronta, setUrlPronta] = useState(!abrirId);
  useEffect(() => {
    if (!abrirId) return;
    let vivo = true;
    getVendor(abrirId)
      .then((r) => {
        if (!vivo) return;
        if (r) { setProfileVendor(r); setTab("lista"); }
        else toast("Não encontrei este registo.", "error");
      })
      .finally(() => { if (vivo) setUrlPronta(true); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);
  useEffect(() => {
    if (!urlPronta) return;
    const aqui = window.location.pathname;
    const alvo = profileVendor ? `/tecnicos/${profileVendor.id}` : null;
    if (alvo && aqui !== alvo) window.history.replaceState(null, "", alvo);
    else if (!alvo && /^\/tecnicos\/\d+$/.test(aqui)) window.history.replaceState(null, "", "/tecnicos?tab=lista");
  }, [profileVendor, urlPronta]);
  // Vindo da pesquisa global (⌘K): `?tecnico=7&q=Rui` abre o perfil.
  useAbrirPeloEndereco("tecnico", vendors?.data, (v) => v.id, setProfileVendor, setSearch);

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

  /*
    Criar o workspace a partir da LISTA, sem abrir o perfil.

    O botão já existia no perfil de cada técnico, mas para lá chegar era
    preciso saber quem procurar -- e era precisamente isso que faltava. Aqui
    já se sabe: são estes, todos, e por ordem de quem espera há mais tempo.
  */
  const [wsDaLista, setWsDaLista] = useState<number | null>(null);
  const criarWorkspaceDaLista = async (t: TecnicoSemWorkspace) => {
    setWsDaLista(t.id);
    try {
      await createVendorInvoiceWorkspace(t.id);
      toast(`Workspace de faturação criado para ${t.name ?? "o técnico"}.`);
      refetchSemWorkspace();
      refetchVendors();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar o workspace.", "error");
    } finally {
      setWsDaLista(null);
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
  // Suspender tira o técnico do matching: pede confirmação e um motivo, que
  // fica registado com o nome de quem suspendeu (ver acoes_da_equipa).
  const [paraSuspender, setParaSuspender] = useState<RealVendor | null>(null);
  const { data: motivosSuspensao, refetch: refetchMotivos } = useAsyncData(() => getMotivos("suspender_tecnico"), []);
  const handleSuspend = async (v: RealVendor, motivo: string) => {
    setActingId(v.id);
    try {
      await suspendVendor(v.id, motivo);
      toast(`Técnico ${v.name ?? v.id} suspenso.`, "error");
      setParaSuspender(null);
      refetchVendors();
      refetchSuspended();
      refetchMotivos();
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

  /*
    Quatro separadores, sem sub-separadores. Eram três com seis
    sub-separadores, mais um ecrã de Onboarding à parte que repetia o funil
    do Resumo com outros nomes e outros totais.
  */
  const TABS: TabDef[] = [
    { id: "resumo", label: "Resumo" },
    { id: "lista", label: "Lista" },
    { id: "aprovacoes", label: "Aprovações", count: pendingDocsMeta?.meta.total ?? 0 },
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
        <button disabled={actingId === r.id} onClick={(e) => { e.stopPropagation(); setParaSuspender(r); }} className="text-xs text-danger hover:underline disabled:opacity-50">Suspender</button>
      </div>
    ) },
  ];

  const suspendedColumns: Column<RealVendor>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name ?? "—"}</span> },
    { key: "nif", label: "NIF", render: (r) => r.nif ?? "—" },
    { key: "suspended_at", label: "Suspenso em", render: (r) => r.suspended_at ? formatDate(r.suspended_at) : "—" },
    { key: "motivo", label: "Motivo", render: (r) => {
      const m = motivosSuspensao?.get(String(r.id));
      if (!m) return <span className="text-text-muted">Sem registo</span>;
      return <span>{m.motivo}<span className="block text-xs text-text-muted">{m.staff_email ?? "—"}</span></span>;
    } },
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
          subtitle="Quem trabalha com a Piquet, quem está a meio da inscrição e onde há cobertura"
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "resumo" && (
          <div className="space-y-6">
            {/*
              Um número por pergunta, de uma só fonte. Havia quatro para
              "quantos estão prontos" (Podem aceitar serviço, Perfil completo,
              Nada em falta, Prontos a trabalhar no Onboarding), três para
              "quantos há" e duas percentagens. Ficam os do Laravel; o funil
              abaixo diz onde estão os outros.
            */}
            {metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard title="Inscritos" hideDelta
                          metric={buildMetricValue(metrics.registered, metrics.registered, false, undefined,
                            "Todas as contas de técnico, incluindo quem nunca completou a inscrição")} />
                        <MetricCard title="Prontos a trabalhar" hideDelta
                          metric={buildMetricValue(metrics.eligible, metrics.eligible, false, undefined,
                            "Documentos válidos, IBAN, workspace e contactos verificados — a AT só é exigida ao 4.º serviço")} />
                        <MetricCard title="Online" hideDelta
                          metric={buildMetricValue(metrics.online, metrics.online, false, undefined,
                            "Têm o estado Online ligado. Expira ao fim de 72 h sem localização. Quem está pronto para um pedido agora vê-se em Operações › Ao vivo")} />
                        <MetricCard title="Sem serviços" hideDelta
                          metric={buildMetricValue(metrics.noServices, metrics.noServices, false, undefined,
                            "Dos prontos a trabalhar, quantos ainda não fecharam nenhum serviço")} />
              </div>
            )}

            {semWorkspace && semWorkspace.contagem.total > 0 && (
              <Degraus contagem={semWorkspace.contagem} />
            )}

            <div>
              <h2 className="font-semibold mb-3">Top técnicos por receita gerada</h2>
              <DataTable columns={topColumns} data={topVendors ?? []} keyField="id" emptyMessage="Sem serviços concluídos ainda." />
            </div>
          </div>
        )}

        {tab === "aprovacoes" && (
          <div className="space-y-6">
            {/*
              Três trabalhos, por esta ordem, e um resumo em cima a dizer
              quanto há de cada:

                1. documentos por rever — o trabalho desta aba;
                2. workspaces de faturação por criar — depende só de nós, e
                   sem ele o técnico não pode ficar online;
                3. técnicos para contactar — documentos caducados ou recusados.

              Até 08/10/2026 as listas 2 e 3 estavam, por engano, DENTRO da
              célula "Aprovar / Recusar" da tabela de documentos (ficaram lá
              numa reordenação, no #53): repetiam-se em cada linha pendente.
              Era isso, mais do que a quantidade de coisas, que tornava a aba
              ilegível.
            */}
            <ResumoDoKyc
              itens={[
                { id: "kyc-documentos", rotulo: "Documentos por rever", n: pendingDocsMeta?.meta.total ?? 0 },
                { id: "kyc-workspace", rotulo: "Workspaces por criar", n: semWorkspace?.total ?? 0 },
                { id: "kyc-contactar", rotulo: "Com documentos caducados", n: docs?.com_expirado ?? 0 },
                { id: "kyc-contactar", rotulo: "Com documentos recusados", n: docs?.com_recusado ?? 0 },
              ]}
              nota={metrics ? `${formatNumber(metrics.docComplete)} técnicos têm a documentação toda aprovada.` : undefined}
            />

            {/* 1. Documentos por rever */}
            <section id="kyc-documentos" className="space-y-3 scroll-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-text-primary">Documentos</h2>
                  <p className="text-sm text-text-secondary">
                    Aprovar ou recusar avisa o técnico (email e notificação). <DemoBadge endpoint="/vendor-documents" />
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {([
                    { id: "pending", label: "Por rever" },
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
              {docsIncompletos > 0 && (
                <p className="rounded-lg border-l-[3px] border-l-warning bg-warning-light/40 px-3 py-2 text-xs text-text-secondary">
                  O servidor não devolveu cerca de <b className="text-text-primary">{docsIncompletos}</b> documentos. Um técnico
                  que pareça não ter entregado pode ter: confirma no perfil dele.
                </p>
              )}
              <DataTable
                columns={[
                  { key: "vendor_name", label: "Técnico", render: (r: VendorDocument) => <span className="font-medium">{r.vendor_name ?? "—"}</span> },
                  { key: "document_type", label: "Documento", render: (r: VendorDocument) => r.document_type ?? "—" },
                  { key: "created_at", label: "Enviado em", render: (r: VendorDocument) => r.created_at ? formatDateTime(r.created_at) : "—" },
                  { key: "file_url", label: "Ficheiro", render: (r: VendorDocument) => r.file_url
                    ? <button onClick={() => setPreviewDoc(r)} className="inline-flex items-center gap-1.5 text-xs font-medium text-piquet-600 hover:text-piquet-700">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </button>
                    : <span className="text-text-muted text-xs">—</span> },
                  { key: "acao", label: "", render: (r: VendorDocument) => r.status === "pending" ? (
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openApprove(r)} className="btn-primary text-xs py-1">Aprovar</button>
                      <button onClick={() => openDecline(r)} className="btn-secondary text-xs py-1 text-danger">Recusar</button>
                    </div>
                  ) : null },
                ]}
                data={docsData.data?.items ?? []}
                keyField="id"
                loading={docsData.loading}
                emptyMessage={docStatus === "pending" ? "Nenhum documento por rever 🎉" : "Sem documentos neste estado"}
              />
            </section>

            {/* 2. Workspaces por criar */}
            {((semWorkspace?.items.length ?? 0) > 0 || (semWorkspace?.contagem.bloqueados ?? 0) > 0) && (
              <section id="kyc-workspace" className="card overflow-hidden scroll-mt-20">
                <div className="px-4 sm:px-5 py-3.5 border-b border-surface-border">
                  <h2 className="font-semibold text-text-primary">Workspace de faturação por criar</h2>
                  {/*
                    Enquanto não houver workspace, o técnico NÃO pode ficar
                    online nem aceitar um serviço (Vendor::canAcceptService
                    exige-o). Ele fez a parte dele; falta a nossa.
                  */}
                  <p className="text-sm text-text-secondary mt-1">
                    Entregaram o acesso à AT e não têm nada em falta. Sem o workspace não podem ficar online nem aceitar
                    serviços. Os mais antigos primeiro.
                  </p>
                </div>
                {(semWorkspace?.items.length ?? 0) > 0 && (
                  <ul className="divide-y divide-surface-border">
                    {semWorkspace!.items.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{t.name ?? `Técnico ${t.id}`}</p>
                          <p className="text-xs text-text-muted">
                            AT: {t.at_user ?? "—"}
                            {t.created_at ? ` · inscrito ${formatDate(t.created_at)}` : ""}
                          </p>
                        </div>
                        <button onClick={() => criarWorkspaceDaLista(t)} disabled={wsDaLista === t.id}
                          className="btn-primary text-xs shrink-0 disabled:opacity-60">
                          {wsDaLista === t.id ? "A criar…" : "Criar workspace"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {(semWorkspace?.contagem.bloqueados ?? 0) > 0 && (
                  <p className="px-4 sm:px-5 py-3 text-xs text-text-secondary border-t border-surface-border bg-surface-subtle">
                    Mais <b className="text-text-primary">{semWorkspace!.contagem.bloqueados}</b> entregaram a AT mas ainda têm
                    um documento, o IBAN ou a morada fiscal por resolver: o workspace só se cria depois disso.
                  </p>
                )}
              </section>
            )}

            {/* 3. Para contactar */}
            {docs && (docs.expirados.length > 0 || docs.recusados.length > 0) && (
              <section id="kyc-contactar" className="card overflow-hidden scroll-mt-20">
                <div className="px-4 sm:px-5 py-3.5 border-b border-surface-border">
                  <h2 className="font-semibold text-text-primary">Para contactar</h2>
                  {/*
                    Só estes dois em lista: são os únicos em que uma pessoa
                    resolve uma pessoa. Os que nunca submeteram são centenas
                    — isso é um relatório, e resolve-se no funil de inscrição.
                  */}
                  <p className="text-sm text-text-secondary mt-1">
                    Técnicos a quem falta reenviar um documento. Os {formatNumber(docs.nunca_submeteram)} que nunca
                    submeteram nada estão no funil de inscrição, no Resumo.
                  </p>
                </div>
                {docs.expirados.length > 0 && (
                  <GrupoDeDocumentos
                    titulo="Documentos caducados"
                    // Já tiveram tudo aprovado: o grupo com melhor retorno.
                    nota="já tiveram tudo aprovado — basta reenviarem"
                    tecnicos={docs.expirados}
                    detalhe={(d) => (d.em ? `caducou ${formatDate(d.em)}` : "caducado")}
                    onAbrir={(nome) => { setSearch(nome); setPage(1); setTab("lista"); }}
                  />
                )}
                {docs.recusados.length > 0 && (
                  <GrupoDeDocumentos
                    titulo="Documentos recusados"
                    nota="submeteram e foi-lhes dito que não"
                    tecnicos={docs.recusados}
                    detalhe={(d) => d.motivo || "sem motivo registado"}
                    onAbrir={(nome) => { setSearch(nome); setPage(1); setTab("lista"); }}
                  />
                )}
              </section>
            )}

            {/* 4. Inscrições paradas — o que era o ecrã "Onboarding de técnicos". */}
            {/*
              Só quem está parado por algo que depende DELE. Quem espera por
              nós (documentos por rever, workspace) já está nas secções 1 e 2:
              aparecer aqui também era a mesma pessoa em dois sítios.
            */}
            {paradosPorEles.length > 0 && (
              <section id="kyc-inscricoes" className="card overflow-hidden scroll-mt-20">
                <div className="px-4 sm:px-5 py-3.5 border-b border-surface-border">
                  <h2 className="font-semibold text-text-primary">Inscrições paradas</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Inscreveram-se para trabalhar e ficaram a meio por algo que falta da parte deles. Os que esperam há
                    mais tempo primeiro; o passo é o primeiro que lhes falta. Quantos estão em cada passo vê-se no Resumo.
                  </p>
                </div>
                <ul className="divide-y divide-surface-border">
                  {paradosPorEles.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{t.nome}</p>
                        <p className="text-xs text-text-muted">
                          {t.categorias.length > 0 ? t.categorias.join(" · ") : "sem categoria"}
                          {t.criadoEm && ` · inscrito a ${formatDate(t.criadoEm)}`}
                        </p>
                      </div>
                      {t.telefone && (
                        <a href={`tel:${t.telefone}`} className="text-xs text-text-secondary hover:text-piquet-700">{t.telefone}</a>
                      )}
                      <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-text-secondary">
                        {t.etapa ? ETAPA_LABEL[t.etapa as Etapa] : "—"}
                      </span>
                      <span className="text-xs tabular-nums text-text-muted w-24 text-right">
                        {t.diasParado == null ? "sem data" : t.diasParado === 0 ? "hoje" : `há ${t.diasParado} dias`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "lista" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar técnicos..." />
                      <button onClick={openTestAccountModal} className="btn-secondary text-xs py-1 ml-auto order-last">Criar conta de teste</button>
                      <div className="chip-row">
                        {([
                          { id: "", label: "Todos" },
                          { id: "validada", label: "AT validada" },
                          { id: "por_validar", label: "AT por validar" },
                          // Sem NIF não há como faturar em nome do técnico —
                          // são registos que nunca poderão receber.
                          { id: "sem_nif", label: "Sem NIF" },
                          // Era um sub-separador à parte; é um filtro como os outros.
                          { id: "suspensos", label: "Suspensos" },
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
                                  : f.id === "suspensos" ? (suspendedVendors?.total ?? 0)
                                  : atCounts.sem_nif}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {atFilter === "suspensos" ? (
                      <>
                        <p className="text-sm text-text-secondary">Suspensos: sem acesso a novos serviços até serem reativados.</p>
                    <DataTable
                      columns={suspendedColumns}
                      data={suspendedVendors?.data ?? []}
                      keyField="id"
                      loading={suspendedLoading}
                      emptyMessage="Sem técnicos suspensos 🎉"
                    />
                      </>
                    ) : atFilter ? (
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
            {reviewDoc.file_url && <DocumentPreview url={reviewDoc.file_url} docId={reviewDoc.id} heightClass="h-[52vh] sm:h-[40vh]" />}
            <Field label="Data de expiração" hint="Opcional">
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="input-field" />
            </Field>
          </div>
        )}
        {reviewDoc && reviewAction === "decline" && (
          <div className="space-y-4">
            {reviewDoc.file_url && <DocumentPreview url={reviewDoc.file_url} docId={reviewDoc.id} heightClass="h-[52vh] sm:h-[40vh]" />}
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
                      title="Estes dados existem no sistema, mas ainda não chegam a este ecrã. Está a ser tratado.">
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
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Histórico da equipa</p>
                    <HistoricoDaEquipa entidade="tecnico" id={String(v.id)} />
                  </div>

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
          ? <DocumentPreview url={previewDoc.file_url} docId={previewDoc.id} heightClass="h-[68vh] sm:h-[62vh]" />
          : <p className="text-sm text-text-muted py-8 text-center">Este documento não tem ficheiro associado.</p>}
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
        open={paraSuspender !== null}
        onClose={() => setParaSuspender(null)}
        onConfirm={async (motivo) => { if (paraSuspender && motivo) await handleSuspend(paraSuspender, motivo); }}
        title={`Suspender ${paraSuspender?.name ?? "este técnico"}?`}
        description={
          <>
            Deixa de receber pedidos e de entrar na app. Os pedidos que já tem marcados não são reatribuídos
            sozinhos: confirma em Operações se tem algum agendado. Dá para desfazer em <strong>Suspensos › Reativar</strong>.
            O motivo fica registado com o teu nome.
          </>
        }
        requireReason
        minReason={MOTIVO_MINIMO}
        reasonLabel="Porque é que estás a suspender?"
        reasonPlaceholder="Ex.: duas faltas sem aviso esta semana; documentos expirados"
        confirmLabel="Suspender"
        tone="danger"
      />

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
