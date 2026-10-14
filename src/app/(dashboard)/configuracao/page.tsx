"use client";

import { useEffect, useState, Suspense } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { PainelDeIntegracoes } from "@/components/sistema/PainelDeIntegracoes";
import { getServiceTypes, type ServiceType } from "@/services/catalogService";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { getEquipa, type PessoaDaEquipa } from "@/services/equipaService";
import { getUltimasAcoes } from "@/services/acoesDaEquipaService";
import { ListaDoHistorico } from "@/components/ui/HistoricoDaEquipa";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { getFeeSettings, updateFeeSettings, type FeeSettings } from "@/services/feeSettingsService";
import {
  getDocuments, createDocument, updateDocument, type RequiredDocument,
} from "@/services/documentsService";
import { getAudits, type AuditEntry } from "@/services/auditsService";
import {
  getSentNotifications, getSentNotificationTypes, type SentNotification,
} from "@/services/sentNotificationsService";
import { toast } from "@/stores";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Plus, FileCheck2, Pencil } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { Etiqueta } from "@/components/ui/Ficha";
import { DemoBadge } from "@/components/ui/DemoBadge";
import CatalogPage from "./_tabs/catalogo";
import ZonesPage from "./_tabs/zonas";

/*
  Um nível só, e cada separador com endereço (?tab=). Eram dois grupos com
  sub-separadores sem endereço: um alerta não conseguia apontar para as
  Integrações, nem se podia mandar a alguém a ligação para a Equipa.

  Saíram: os Códigos SMS (08/10), os Avisos neste dispositivo (estão no menu
  do utilizador), as Promoções (estão no Marketing) e a "Tabela de preços",
  que lia um catálogo de demonstração e em produção estava vazia -- os preços
  de referência vêm agora do catálogo do Laravel.
*/
const TABS: TabDef[] = [
  { id: "catalogo", label: "Catálogo" },
  { id: "zonas", label: "Zonas" },
  { id: "precos", label: "Preços e comissões" },
  { id: "documentos", label: "Documentos exigidos" },
  { id: "equipa", label: "Equipa e acessos" },
  { id: "historico", label: "Histórico" },
  { id: "sistema", label: "Sistema" },
];

/** Os sub-separadores de antes, para as ligações antigas não se perderem. */
const ANTIGOS: Record<string, string> = {
  servicos: "catalogo", administracao: "documentos", taxas: "precos",
  admins: "equipa", atividade: "historico", notificacoes: "sistema", integracoes: "sistema",
};

/** Configurações: as regras do negócio (catálogo, zonas, preços) e quem tem acesso. */
function ConfiguracaoPageInner() {
  const [tab, setTab] = useTabParam("catalogo");
  useEffect(() => { if (ANTIGOS[tab]) setTab(ANTIGOS[tab]); }, [tab, setTab]);
  return (
    <RouteGuard route="/configuracao">
      <div className="space-y-6">
        <PageHeader
          title="Configurações"
          subtitle="Catálogo, zonas, preços, documentos, equipa e o estado das integrações"
        />
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "catalogo" && <CatalogPage />}
        {tab === "zonas" && <ZonesPage />}
        {tab === "precos" && (
          <div className="space-y-10">
            <TaxasTab />
            <PrecosDeReferencia onEditar={() => setTab("catalogo")} />
          </div>
        )}
        {tab === "documentos" && <DocumentosTab />}
        {tab === "equipa" && <AdminsTab />}
        {tab === "historico" && <AtividadeTab />}
        {tab === "sistema" && (
          <div className="space-y-10">
            <PainelDeIntegracoes />
            <NotificacoesTab />
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

/* ------------------------- Preços de referência ------------------------- */

/**
 * O "a partir de" de cada serviço, como está no catálogo do Laravel (é o que
 * a app mostra). Só leitura: muda-se no Catálogo, onde está o resto do serviço.
 */
function PrecosDeReferencia({ onEditar }: { onEditar: () => void }) {
  const { data, loading, error, refetch } = useAsyncData(() => getServiceTypes(), []);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const tipos = [...(data?.items ?? [])].sort((a, b) =>
    (a.operation_area_name ?? "").localeCompare(b.operation_area_name ?? "") || a.name.localeCompare(b.name));
  return (
    <section>
      <SectionHeader
        title="Preços de referência"
        description={<>O &quot;a partir de&quot; que a app mostra em cada serviço. O preço final depende do técnico (valor/hora) e da hora do dia (taxas acima).</>}
        aside={<button onClick={onEditar} className="btn-secondary text-sm"><Pencil className="h-4 w-4" /> Mudar no Catálogo</button>}
      />
      <DataTable
        columns={[
          { key: "operation_area_name", label: "Categoria", render: (r: ServiceType) => <span className="text-text-secondary">{r.operation_area_name ?? "—"}</span> },
          { key: "name", label: "Serviço", render: (r: ServiceType) => <span className="font-medium">{r.name}</span> },
          { key: "starts_from", label: "A partir de", className: "text-right", render: (r: ServiceType) => r.starts_from != null ? <span className="tabular-nums">{formatCurrency(r.starts_from)}</span> : <span className="text-text-muted">—</span> },
          { key: "time", label: "Duração", className: "text-right", render: (r: ServiceType) => r.time ? <span className="tabular-nums">{r.time} min</span> : "—" },
          { key: "vendors_count", label: "Técnicos", className: "text-right", render: (r: ServiceType) => <span className="tabular-nums">{r.vendors_count}</span> },
        ]}
        data={tipos}
        keyField="id"
        emptyMessage="Sem serviços no catálogo."
      />
    </section>
  );
}

/* ---------------------------- Taxas e comissões ---------------------------- */

// Espelha o formulário do Filament (Pages\FeeSettings, sobre App\Settings\RateSettings):
// os períodos do dia são rotulados pela faixa horária, não pelo nome do campo.
const TIME_PERIODS: { key: keyof Omit<FeeSettings, "kilometer_price" | "system_commission">; label: string }[] = [
  { key: "daytime", label: "08:00 – 17:59" },
  { key: "evening", label: "18:00 – 20:59" },
  { key: "night", label: "21:00 – 23:59" },
  { key: "late_night", label: "00:00 – 02:59" },
  { key: "midnight", label: "03:00 – 07:59" },
];

function TaxasTab() {
  const { data, loading, error, refetch } = useAsyncData(() => getFeeSettings(), []);
  const [draft, setDraft] = useState<FeeSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setDraft(data); }, [data]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!draft) return null;

  const dirty = data && JSON.stringify(data) !== JSON.stringify(draft);

  const set = (key: keyof FeeSettings, value: number) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (!draft) return;
    for (const { key, label } of TIME_PERIODS) {
      if (!Number.isInteger(draft[key]) || draft[key] < 0) {
        toast(`"${label}" tem de ser um número inteiro ≥ 0.`, "error");
        return;
      }
    }
    if (draft.kilometer_price < 0) { toast('"Preço por km" tem de ser ≥ 0.', "error"); return; }
    if (!Number.isInteger(draft.system_commission) || draft.system_commission < 0 || draft.system_commission > 100) {
      toast('"Comissão do sistema" tem de ser um número inteiro entre 0 e 100.', "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await updateFeeSettings(draft);
      setDraft(saved);
      toast("Definições de taxas atualizadas.");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível gravar as definições de taxas.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Taxas e comissões"
        description="Multiplicadores da tarifa base por período do dia, preço por km e comissão retida pela Piquet — aplicados ao cálculo de todos os serviços."
        aside={<DemoBadge endpoint="/fee-settings" />}
      />
      <div className="card">
        <div className="p-4 space-y-5">
          <div>
            <p className="text-[13px] font-medium text-text-primary mb-2">Taxas horárias</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {TIME_PERIODS.map(({ key, label }) => (
                <CampoComUnidade key={key} rotulo={label} unidade="%" valor={draft[key]} passo={1}
                  onChange={(v) => set(key, v)} />
              ))}
            </div>
          </div>
          <div className="border-t border-surface-border pt-5">
            <p className="text-[13px] font-medium text-text-primary mb-2">Deslocação e comissão</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <CampoComUnidade rotulo="Preço por km" unidade="€" valor={draft.kilometer_price} passo={0.01}
                onChange={(v) => set("kilometer_price", v)} />
              <CampoComUnidade rotulo="Comissão do sistema" unidade="%" valor={draft.system_commission} passo={1} max={100}
                onChange={(v) => set("system_commission", v)} />
            </div>
          </div>
        </div>
        {/* As ações só pedem atenção quando há alguma coisa por gravar. */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-border bg-surface-muted/50 rounded-b-card">
          {dirty && !saving && <span className="mr-auto text-xs text-warning">Alterações por gravar</span>}
          {dirty && !saving && (
            <button onClick={() => setDraft(data ?? null)} className="btn-ghost text-sm">Cancelar</button>
          )}
          <button onClick={save} disabled={!dirty || saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? "A gravar…" : "Guardar alterações"}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Um número com a unidade dentro da caixa (8 %, 0,35 €). */
function CampoComUnidade({ rotulo, unidade, valor, passo, max, onChange }: {
  rotulo: string; unidade: string; valor: number; passo: number; max?: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted mb-1 block">{rotulo}</span>
      <span className="relative block">
        <input type="number" min={0} max={max} step={passo} value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input-field py-1.5 pr-8 tabular-nums" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">{unidade}</span>
      </span>
    </label>
  );
}

/* ------------------------------- Documentos -------------------------------- */

/**
 * Documentos — migrado do Filament (DocumentResource) para o Laravel. Fatia
 * "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29).
 * "appliesTo" (a que categorias se aplica um documento opcional) não existe
 * no modelo real desta forma -- é o inverso, OperationArea.documents lista
 * os documentos exigidos por categoria -- por isso não foi replicado aqui.
 */
function DocumentosTab() {
  const { data, loading, error, refetch } = useAsyncData(() => getDocuments(), []);
  const docs = data?.items ?? [];

  const [modal, setModal] = useState<{ open: boolean; editing: RequiredDocument | null; name: string; description: string; required: boolean }>({
    open: false, editing: null, name: "", description: "", required: true,
  });
  const [saving, setSaving] = useState(false);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openNew = () => setModal({ open: true, editing: null, name: "", description: "", required: true });
  const openEdit = (d: RequiredDocument) => setModal({ open: true, editing: d, name: d.name, description: d.description ?? "", required: d.required });
  const close = () => setModal({ ...modal, open: false });

  const save = async () => {
    const name = modal.name.trim();
    if (!name) { toast("Indica o nome do documento.", "error"); return; }
    const input = { name, description: modal.description.trim() || null, required: modal.required };

    setSaving(true);
    try {
      if (modal.editing) {
        await updateDocument(modal.editing.id, input);
        toast(`Documento "${name}" atualizado.`);
      } else {
        await createDocument(input);
        toast(`Documento "${name}" criado.`);
      }
      close();
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar o documento.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section>
        <SectionHeader
          title="Documentos exigidos"
          description="Documentos pedidos aos técnicos no registo — o fluxo de aprovação (KYC) valida-os em Técnicos."
          aside={<><DemoBadge endpoint="/documents" /><button onClick={openNew} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> Novo documento</button></>}
        />
        {docs.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-text-muted">Ainda sem documentos.</p>
        ) : (
          <ul className="card divide-y divide-surface-border">
            {docs.map((d) => (
              <li key={d.id} className="group flex items-center gap-3 px-4 py-3">
                <FileCheck2 className={cn("h-4 w-4 shrink-0", d.required ? "text-success" : "text-text-muted")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{d.name}</p>
                  {d.description && <p className="text-xs text-text-muted">{d.description}</p>}
                </div>
                <Etiqueta tom={d.required ? "bom" : "neutro"}>{d.required ? "Obrigatório" : "Opcional"}</Etiqueta>
                <button onClick={() => openEdit(d)} className="btn-ghost text-xs px-2 py-1 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={modal.open}
        onClose={close}
        title={modal.editing ? "Editar documento" : "Novo documento"}
        subtitle="Documento pedido aos técnicos"
        footer={
          <>
            <button onClick={close} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">{modal.editing ? "Guardar" : "Criar documento"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome do documento">
            <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="Ex.: Certificado profissional" className="input-field" />
          </Field>
          <Field label="Descrição" hint="Opcional">
            <input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} className="input-field" />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={modal.required} onChange={(e) => setModal({ ...modal, required: e.target.checked })} />
            Obrigatório para todos os técnicos
          </label>
        </div>
      </Modal>
    </>
  );
}

/* ----------------------------- Administradores ----------------------------- */

/*
  Era uma lista guardada no browser, semeada com nomes de exemplo: "Novo
  administrador" e "Suspender" diziam que tinham feito alguma coisa e o
  acesso de ninguém mudava. Agora mostra a tabela `staff` do Supabase, que é
  o que o login consulta.
*/
function AdminsTab() {
  const { data, loading, error, refetch } = useAsyncData(() => getEquipa(), []);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const columns: Column<PessoaDaEquipa>[] = [
    { key: "name", label: "Pessoa", render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-text-muted">{r.email}</p></div> },
    { key: "role", label: "Perfil", render: (r) => ROLE_LABELS[r.role as UserRole] ?? r.role },
    { key: "last_sign_in_at", label: "Último acesso", render: (r) => r.last_sign_in_at ? formatDateTime(r.last_sign_in_at) : "Nunca entrou" },
    { key: "created_at", label: "Acesso desde", render: (r) => formatDateTime(r.created_at) },
  ];
  return (
    <section>
      <SectionHeader
        title="Equipa e acessos"
        description="Quem consegue entrar no backoffice e com que perfil. Para dar ou tirar acesso, fala com o CTO: hoje faz-se no Supabase."
      />
      <DataTable columns={columns} data={data ?? []} keyField="id" emptyMessage="Ninguém com acesso registado" />
    </section>
  );
}

/* -------------------------------- Atividade -------------------------------- */

/**
 * Atividade — feed real de auditoria (tabela `audits` do Laravel), filtrado a
 * ações de staff (admin/super-admin). Sem equivalente direto no Filament (lá
 * é por registo); este é um feed global, novo nesta fatia (2026-07-29).
 *
 * Limitação conhecida: pedidos feitos através desta API de admin (o
 * backoffice Next.js) usam um token partilhado, não uma sessão por pessoa —
 * por isso não têm um utilizador Laravel associado e não aparecem aqui com
 * "quem" fez o quê. Só ações feitas através do Filament (sessão por admin)
 * ficam com autor identificado.
 *
 * Desde 08/10/2026 o que a equipa faz NO BACKOFFICE fica, com autor, em
 * `acoes_da_equipa` (o withStaff grava cada escrita). Aparece primeiro; os
 * audits do Laravel ficam por baixo, para o que se faz no Filament.
 */
function AtividadeTab() {
  const { data, loading, error, refetch } = useAsyncData(() => getAudits(), []);
  const { data: daEquipa } = useAsyncData(() => getUltimasAcoes(), []);
  const log = data?.items ?? [];

  const columns: Column<AuditEntry>[] = [
    { key: "at", label: "Quando", render: (r) => (r.at ? formatDateTime(r.at) : "—") },
    { key: "who", label: "Quem", render: (r) => <span className="font-medium">{r.who}</span> },
    { key: "action", label: "Ação" },
    { key: "entity", label: "Entidade", render: (r) => <span className="font-mono text-xs">{r.entity}</span> },
    { key: "change", label: "Alteração", render: (r) => r.old_value || r.new_value
      ? <span className="text-xs"><span className="text-text-muted line-through">{r.old_value ?? "—"}</span> → <span className="font-medium">{r.new_value ?? "—"}</span></span>
      : <span className="text-text-muted text-xs">—</span> },
  ];

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="No backoffice" description="Cada alteração feita aqui, com o nome de quem a fez e o motivo quando há." />
        <div className="card px-4 py-1">
          {!daEquipa ? <p className="py-3 text-sm text-text-muted">A carregar…</p>
            : !daEquipa.ativo ? <p className="py-3 text-sm text-text-muted">Ainda não ligado: falta a tabela acoes_da_equipa no Supabase.</p>
            : daEquipa.registos.length === 0 ? <p className="py-3 text-sm text-text-muted">Ainda sem ações registadas.</p>
            : <ListaDoHistorico registos={daEquipa.registos} comRegisto />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="No Laravel (Filament e apps)"
          description="O que se faz pelo backoffice chega ao Laravel sem autor; o que se faz no Filament fica com ele."
          aside={<DemoBadge endpoint="/audits" />}
        />
        <DataTable columns={columns} data={log} keyField="id" emptyMessage="Sem atividade registada" />
      </section>
    </div>
  );
}

/* -------------------------- Notificações enviadas -------------------------- */

/**
 * Notificações enviadas — migrado do Filament (SentNotificationResource).
 * Só leitura: histórico do que já foi mesmo enviado a clientes/técnicos
 * (tabela `notifications`), distinto do tab "Push" em Marketing (que serve
 * para CRIAR campanhas, não para consultar o que já saiu).
 */
function NotificacoesTab() {
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);
  const [type, setType] = useState("");
  const [read, setRead] = useState<"" | "read" | "unread">("");
  const [recipientType, setRecipientType] = useState<"" | "customer" | "vendor">("");
  const [selected, setSelected] = useState<SentNotification | null>(null);

  const { data: types } = useAsyncData(() => getSentNotificationTypes(), []);
  const { data, loading, error, refetch } = useAsyncData(
    () => getSentNotifications(page, pageSize, {
      search: debouncedSearch || undefined,
      type: type || undefined,
      read: read || undefined,
      recipientType: recipientType || undefined,
    }),
    [page, pageSize, debouncedSearch, type, read, recipientType]
  );

  const columns: Column<SentNotification>[] = [
    { key: "recipient", label: "Destinatário", render: (r) => (
      <div>
        <p className="font-medium">{r.recipient?.name ?? "—"}</p>
        {r.recipient_type && (
          <span className="text-xs text-text-muted">{r.recipient_type === "vendor" ? "Técnico" : "Cliente"}</span>
        )}
      </div>
    ) },
    { key: "type", label: "Notificação", render: (r) => <span className="font-mono text-xs">{r.type}</span> },
    { key: "title", label: "Título", render: (r) => <span className="line-clamp-1 max-w-[240px] block">{r.title}</span> },
    { key: "read", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center gap-1.5 text-xs", r.read ? "text-text-muted" : "font-medium text-text-primary")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", r.read ? "bg-surface-strong" : "bg-piquet")} />
        {r.read ? "Lida" : "Não lida"}
      </span>
    ) },
    { key: "created_at", label: "Enviada", render: (r) => (r.created_at ? formatDateTime(r.created_at) : "—") },
  ];

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <section>
      <SectionHeader
        title="Notificações enviadas"
        description="Histórico do que já foi mesmo enviado a clientes e técnicos — clica numa linha para ver a mensagem completa."
        aside={<DemoBadge endpoint="/sent-notifications" />}
      />
      <DataTable columns={columns} data={data?.data ?? []} keyField="id" onRowClick={setSelected} emptyMessage="Sem notificações enviadas"
        toolbar={
          <>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="w-full sm:w-56" placeholder="Pesquisar destinatário..." />
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input-field w-auto py-1.5 max-w-[220px]" aria-label="Tipo de notificação">
              <option value="">Todos os tipos</option>
              {(types ?? []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={read} onChange={(e) => { setRead(e.target.value as typeof read); setPage(1); }} className="input-field w-auto py-1.5" aria-label="Lida ou não">
              <option value="">Lidas e não lidas</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
            </select>
            <select value={recipientType} onChange={(e) => { setRecipientType(e.target.value as typeof recipientType); setPage(1); }} className="input-field w-auto py-1.5" aria-label="Destinatário">
              <option value="">Clientes e técnicos</option>
              <option value="customer">Clientes</option>
              <option value="vendor">Técnicos</option>
            </select>
          </>
        } />
      {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        subtitle={selected ? `${selected.recipient?.name ?? "—"} · ${selected.type}` : undefined}
        footer={<button onClick={() => setSelected(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-text-secondary text-xs">Destinatário</p>
                <p className="font-medium">{selected.recipient?.name ?? "—"} {selected.recipient_type && `(${selected.recipient_type === "vendor" ? "Técnico" : "Cliente"})`}</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Enviada em</p>
                <p className="font-medium">{selected.created_at ? formatDateTime(selected.created_at) : "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-1">Mensagem completa</p>
              <p className="text-sm text-text-primary rounded-lg bg-surface-subtle px-3 py-2 whitespace-pre-wrap">
                {selected.body || "Sem corpo de mensagem."}
              </p>
            </div>
            <div className="text-xs text-text-secondary">
              {selected.read ? `Lida em ${selected.read_at ? formatDateTime(selected.read_at) : "—"}` : "Ainda não foi lida."}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

/*
  Aqui esteve "Códigos SMS": a lista dos códigos de verificação e de LOGIN
  emitidos e ainda por validar. Um código por validar é exatamente o que
  falta para entrar na conta de outra pessoa -- quem visse este separador
  entrava como qualquer cliente ou técnico. Saiu (08/10/2026), com a rota
  /api/sms-codes. Para "não recebi o SMS", o suporte pede para reenviar.
*/

/**
 * O separador vem do endereço (`useTabParam` → `useSearchParams`), e o Next
 * pede um limite de Suspense por cima para compilar a página estática.
 */
export default function ConfiguracaoPage() {
  return (
    <Suspense>
      <ConfiguracaoPageInner />
    </Suspense>
  );
}
