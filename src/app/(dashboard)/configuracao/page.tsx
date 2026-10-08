"use client";

import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import { getEquipa, type PessoaDaEquipa } from "@/services/equipaService";
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
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Plus, FileCheck2, Settings, Pencil } from "lucide-react";
import { Notificacoes } from "@/components/layout/Notificacoes";
import { PageHeader } from "@/components/ui/PageHeader";
import CatalogPage from "./_tabs/catalogo";
import PricingPage from "./_tabs/precos";
import ZonesPage from "./_tabs/zonas";
import { DemoBadge } from "@/components/ui/DemoBadge";

// Consolidado (2026-07-19): 7 → 2 grupos. Oferta/preços de um lado,
// administração do outro.
const TABS: TabDef[] = [
  { id: "servicos", label: "Serviços e preços" },
  { id: "administracao", label: "Administração" },
];

/** Hub de configuração — oferta, taxas, documentos, admins e auditoria. */
export default function ConfiguracaoPage() {
  const [tab, setTab] = useState("servicos");
  return (
    <RouteGuard route="/configuracao">
      <div className="space-y-6">
        <PageHeader
          icon={Settings}
          eyebrow="Sistema"
          title={<>Configurações <DemoBadge endpoint="/settings" /></>}
          subtitle="Catálogo, preços, zonas, taxas, documentos e equipa"
        />
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "servicos" && (
          <SubTabs tabs={[
            { id: "catalogo", label: "Catálogo" },
            { id: "precos", label: "Preços" },
            { id: "zonas", label: "Zonas" },
            { id: "taxas", label: "Taxas e comissões" },
          ]}>
            {(sub) => (
              <>
                {sub === "catalogo" && <CatalogPage />}
                {sub === "precos" && <PricingPage />}
                {sub === "zonas" && <ZonesPage />}
                {sub === "taxas" && <TaxasTab />}
              </>
            )}
          </SubTabs>
        )}

        {tab === "administracao" && (
          <SubTabs tabs={[
            { id: "documentos", label: "Documentos" },
            { id: "admins", label: "Equipa e acessos" },
            { id: "atividade", label: "Atividade" },
            { id: "este-dispositivo", label: "Avisos neste dispositivo" },
            { id: "notificacoes", label: "Notificações enviadas" },
          ]}>
            {(sub) => (
              <>
                {sub === "documentos" && <DocumentosTab />}
                {sub === "admins" && <AdminsTab />}
                {sub === "atividade" && <AtividadeTab />}
                {sub === "este-dispositivo" && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-text-primary">Avisos neste dispositivo</h3>
                      <p className="text-sm text-text-secondary mt-0.5">
                        O backoffice não tinha como te tocar no ombro: só se sabia de um pedido urgente ou de um
                        ticket se alguém estivesse a olhar para o ecrã.
                      </p>
                    </div>
                    <Notificacoes />
                  </div>
                )}
                {sub === "notificacoes" && <NotificacoesTab />}
              </>
            )}
          </SubTabs>
        )}
      </div>
    </RouteGuard>
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Taxas e comissões</h3>
        <DemoBadge endpoint="/fee-settings" />
      </div>
      <p className="text-sm text-text-secondary">
        Multiplicadores da tarifa base por período do dia, preço por km e comissão retida pela Piquet — aplicados ao cálculo de todos os serviços.
      </p>

      <div>
        <h3 className="font-semibold mb-3">Taxas horárias</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TIME_PERIODS.map(({ key, label }) => (
            <div key={key} className="card p-4">
              <p className="text-xs text-text-secondary mb-2">{label}</p>
              <div className="flex items-center gap-2">
                <input type="number" min={0} step={1} value={draft[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                  className="input-field text-sm py-1.5" />
                <span className="text-sm text-text-muted shrink-0">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Configurações de taxas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div className="card p-4">
            <p className="text-xs text-text-secondary mb-2">Preço por km (deslocação)</p>
            <div className="flex items-center gap-2">
              <input type="number" min={0} step={0.01} value={draft.kilometer_price}
                onChange={(e) => set("kilometer_price", Number(e.target.value))}
                className="input-field text-sm py-1.5" />
              <span className="text-sm text-text-muted shrink-0">€</span>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs text-text-secondary mb-2">Comissão do sistema</p>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} step={1} value={draft.system_commission}
                onChange={(e) => set("system_commission", Number(e.target.value))}
                className="input-field text-sm py-1.5" />
              <span className="text-sm text-text-muted shrink-0">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!dirty || saving} className="btn-primary text-sm">
          {saving ? "A gravar…" : "Guardar alterações"}
        </button>
        {dirty && !saving && (
          <button onClick={() => setDraft(data ?? null)} className="btn-secondary text-sm">Cancelar</button>
        )}
      </div>
    </div>
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Documentos</h3>
              <DemoBadge endpoint="/documents" />
            </div>
            <p className="text-sm text-text-secondary mt-1">Documentos pedidos aos técnicos no registo — o fluxo de aprovação (KYC) valida-os na aba Técnicos.</p>
          </div>
          <button onClick={openNew} className="btn-primary text-sm shrink-0"><Plus className="h-4 w-4" /> Novo documento</button>
        </div>
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="card px-4 py-3 flex items-center gap-3">
              <FileCheck2 className={cn("h-5 w-5 shrink-0", d.required ? "text-success" : "text-text-muted")} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">{d.name}</p>
                {d.description && <p className="text-xs text-text-secondary">{d.description}</p>}
              </div>
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                d.required ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
                {d.required ? "Obrigatório" : "Opcional"}
              </span>
              <button onClick={() => openEdit(d)} className="inline-flex items-center gap-1 text-xs text-piquet-600 hover:underline shrink-0">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-text-secondary">Ainda sem documentos.</p>}
        </div>
      </div>

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
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Quem consegue entrar no backoffice e com que perfil. Para dar ou tirar acesso, fala com o CTO: hoje faz-se no Supabase.
      </p>
      <DataTable columns={columns} data={data ?? []} keyField="id" emptyMessage="Ninguém com acesso registado" />
    </div>
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
 * ficam com autor identificado. Isto resolve-se quando o backoffice tiver
 * autenticação multi-utilizador própria (ver nota na aba Administradores).
 */
function AtividadeTab() {
  const { data, loading, error, refetch } = useAsyncData(() => getAudits(), []);
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Atividade</h3>
        <DemoBadge endpoint="/audits" />
      </div>
      <p className="text-sm text-text-secondary">Registo de atividade da equipa — quem fez o quê, quando, e o que mudou. Algumas ações ainda aparecem sem autor identificado.</p>
      <DataTable columns={columns} data={log} keyField="id" emptyMessage="Sem atividade registada" />
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
          <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium",
            r.recipient_type === "vendor" ? "bg-warning-light text-warning" : "bg-success-light text-success")}>
            {r.recipient_type === "vendor" ? "Técnico" : "Cliente"}
          </span>
        )}
      </div>
    ) },
    { key: "type", label: "Notificação", render: (r) => <span className="font-mono text-xs">{r.type}</span> },
    { key: "title", label: "Título", render: (r) => <span className="line-clamp-1 max-w-[240px] block">{r.title}</span> },
    { key: "read", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.read ? "bg-surface-subtle text-text-secondary" : "bg-success-light text-success")}>
        {r.read ? "Lida" : "Não lida"}
      </span>
    ) },
    { key: "created_at", label: "Enviada", render: (r) => (r.created_at ? formatDateTime(r.created_at) : "—") },
  ];

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Notificações enviadas</h3>
        <DemoBadge endpoint="/sent-notifications" />
      </div>
      <p className="text-sm text-text-secondary">Histórico do que já foi mesmo enviado a clientes e técnicos — clica numa linha para ver a mensagem completa.</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="max-w-sm" placeholder="Pesquisar destinatário..." />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input-field text-sm max-w-[220px]">
          <option value="">Todos os tipos</option>
          {(types ?? []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={read} onChange={(e) => { setRead(e.target.value as typeof read); setPage(1); }} className="input-field text-sm max-w-[160px]">
          <option value="">Todos os estados</option>
          <option value="unread">Não lidas</option>
          <option value="read">Lidas</option>
        </select>
        <select value={recipientType} onChange={(e) => { setRecipientType(e.target.value as typeof recipientType); setPage(1); }} className="input-field text-sm max-w-[160px]">
          <option value="">Todos os destinatários</option>
          <option value="customer">Clientes</option>
          <option value="vendor">Técnicos</option>
        </select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} keyField="id" onRowClick={setSelected} emptyMessage="Sem notificações enviadas" />
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
    </div>
  );
}

/*
  Aqui esteve "Códigos SMS": a lista dos códigos de verificação e de LOGIN
  emitidos e ainda por validar. Um código por validar é exatamente o que
  falta para entrar na conta de outra pessoa -- quem visse este separador
  entrava como qualquer cliente ou técnico. Saiu (08/10/2026), com a rota
  /api/sms-codes. Para "não recebi o SMS", o suporte pede para reenviar.
*/
