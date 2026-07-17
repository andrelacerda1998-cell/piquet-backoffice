"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import {
  SEED_FEES, SEED_ADMINS, ADMIN_ROLES, getActivityLog,
  type FeeConfig, type Admin, type ActivityEntry,
} from "@/services/backofficeService";
import { toast } from "@/stores";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Plus, ShieldCheck, FileCheck2 } from "lucide-react";
import CatalogPage from "./_tabs/catalogo";
import PricingPage from "./_tabs/precos";
import ZonesPage from "./_tabs/zonas";
import { DemoBadge } from "@/components/ui/DemoBadge";

const TABS: TabDef[] = [
  { id: "catalogo", label: "Catálogo" },
  { id: "precos", label: "Preços" },
  { id: "zonas", label: "Zonas" },
  { id: "taxas", label: "Taxas e comissões" },
  { id: "documentos", label: "Documentos" },
  { id: "admins", label: "Administradores" },
  { id: "atividade", label: "Atividade" },
];

/** Hub de configuração — oferta, taxas, documentos, admins e auditoria. */
export default function ConfiguracaoPage() {
  const [tab, setTab] = useState("catalogo");
  return (
    <RouteGuard route="/configuracao">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações <DemoBadge endpoint="/settings" /></h1>
          <p className="text-text-secondary mt-1">Catálogo, preços, zonas, taxas, documentos e administradores</p>
        </div>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === "catalogo" && <CatalogPage />}
        {tab === "precos" && <PricingPage />}
        {tab === "zonas" && <ZonesPage />}
        {tab === "taxas" && <TaxasTab />}
        {tab === "documentos" && <DocumentosTab />}
        {tab === "admins" && <AdminsTab />}
        {tab === "atividade" && <AtividadeTab />}
      </div>
    </RouteGuard>
  );
}

/* ---------------------------- Taxas e comissões ---------------------------- */

function TaxasTab() {
  const [fees, setFees] = usePersistentList<FeeConfig>("fees", SEED_FEES);
  const [draft, setDraft] = useState<Record<string, number>>({});

  const save = (id: string) => {
    const value = draft[id];
    if (value === undefined || Number.isNaN(value) || value < 0) { toast("Valor inválido.", "error"); return; }
    setFees((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)));
    setDraft((d) => { const n = { ...d }; delete n[id]; return n; });
    const fee = fees.find((f) => f.id === id);
    toast(`"${fee?.label}" atualizado para ${value}${fee?.unit}.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">Comissões, taxas fixas, acréscimos dinâmicos e penalizações de cancelamento — aplicadas ao cálculo dos serviços.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fees.map((f) => {
          const editing = draft[f.id] !== undefined;
          return (
            <div key={f.id} className="card p-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">{f.label}</p>
                <p className="text-xs text-text-secondary">{f.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <input type="number" min={0} step={0.1} value={draft[f.id]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.id]: Number(e.target.value) }))}
                      className="input-field w-24 text-sm py-1.5" autoFocus />
                    <span className="text-sm text-text-muted">{f.unit}</span>
                    <button onClick={() => save(f.id)} className="btn-primary text-xs py-1.5">Guardar</button>
                  </>
                ) : (
                  <>
                    <span className="text-xl font-bold text-text-primary">{f.value}{f.unit}</span>
                    <button onClick={() => setDraft((d) => ({ ...d, [f.id]: f.value }))} className="text-xs text-piquet-600 hover:underline">Editar</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- Documentos -------------------------------- */

interface RequiredDoc { id: string; name: string; required: boolean; appliesTo: string }

const SEED_DOCS: RequiredDoc[] = [
  { id: "doc_cc", name: "Cartão de Cidadão", required: true, appliesTo: "Todos os técnicos" },
  { id: "doc_rc", name: "Registo Criminal", required: true, appliesTo: "Todos os técnicos" },
  { id: "doc_dia", name: "Declaração de Início de Atividade", required: true, appliesTo: "Todos os técnicos" },
  { id: "doc_at", name: "Subutilizador na Autoridade Tributária", required: true, appliesTo: "Todos os técnicos" },
  { id: "doc_iban", name: "Comprovativo de IBAN", required: true, appliesTo: "Todos os técnicos" },
  { id: "doc_cert", name: "Certificados profissionais", required: false, appliesTo: "Eletricidade, AVAC, Canalização" },
  { id: "doc_seg", name: "Seguro de responsabilidade civil", required: false, appliesTo: "Categorias de risco" },
];

function DocumentosTab() {
  const [docs, setDocs] = usePersistentList<RequiredDoc>("required-docs", SEED_DOCS);
  const toggle = (id: string) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, required: !d.required } : d)));
    const d = docs.find((x) => x.id === id);
    toast(`"${d?.name}" agora é ${d?.required ? "opcional" : "obrigatório"}.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">Documentos pedidos aos técnicos no registo — o fluxo de aprovação (KYC) valida-os na aba Técnicos.</p>
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="card px-4 py-3 flex items-center gap-3">
            <FileCheck2 className={cn("h-5 w-5 shrink-0", d.required ? "text-success" : "text-text-muted")} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text-primary">{d.name}</p>
              <p className="text-xs text-text-secondary">{d.appliesTo}</p>
            </div>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
              d.required ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
              {d.required ? "Obrigatório" : "Opcional"}
            </span>
            <button onClick={() => toggle(d.id)} className="text-xs text-piquet-600 hover:underline shrink-0">
              Tornar {d.required ? "opcional" : "obrigatório"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Administradores ----------------------------- */

function AdminsTab() {
  const [admins, setAdmins] = usePersistentList<Admin>("admins", SEED_ADMINS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: ADMIN_ROLES[1] as Admin["role"] });

  const create = () => {
    if (!form.name.trim() || !form.email.trim()) { toast("Indica o nome e o email.", "error"); return; }
    setAdmins((prev) => [{ id: `adm_${Date.now()}`, name: form.name.trim(), email: form.email.trim(), role: form.role, status: "ativo", lastAccess: "—" }, ...prev]);
    setOpen(false);
    setForm({ name: "", email: "", role: ADMIN_ROLES[1] });
    toast(`Administrador ${form.name} adicionado com o perfil ${form.role}.`);
  };

  const toggle = (id: string) => {
    setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, status: a.status === "ativo" ? "suspenso" : "ativo" } : a)));
    const a = admins.find((x) => x.id === id);
    toast(`${a?.name} ${a?.status === "ativo" ? "suspenso" : "reativado"}.`, a?.status === "ativo" ? "error" : "success");
  };

  const columns: Column<Admin>[] = [
    { key: "name", label: "Administrador", render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-text-muted">{r.email}</p></div> },
    { key: "role", label: "Perfil", render: (r) => (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        r.role === "Super Admin" ? "bg-piquet/15 text-piquet-700" : "bg-surface-subtle text-text-secondary")}>
        {r.role === "Super Admin" && <ShieldCheck className="h-3 w-3" />}{r.role}
      </span>
    ) },
    { key: "lastAccess", label: "Último acesso", render: (r) => r.lastAccess === "—" ? "—" : formatDateTime(r.lastAccess) },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.status === "ativo" ? "bg-success-light text-success" : "bg-danger-light text-danger")}>
        {r.status === "ativo" ? "Ativo" : "Suspenso"}
      </span>
    ) },
    { key: "acao", label: "", render: (r) => (
      <button onClick={() => toggle(r.id)} className={cn("text-xs hover:underline", r.status === "ativo" ? "text-danger" : "text-success")}>
        {r.status === "ativo" ? "Suspender" : "Reativar"}
      </button>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Equipa com acesso ao backoffice e respetivos perfis de permissão.</p>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo administrador</button>
      </div>
      <div className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-secondary">
        Nota: o login está atualmente limitado à liderança (CEO/CTO). Esta gestão de perfis fica preparada para quando a autenticação multi-utilizador (Supabase) for ativada.
      </div>
      <DataTable columns={columns} data={admins} keyField="id" />

      <Modal open={open} onClose={() => setOpen(false)} title="Novo administrador" subtitle="Acesso ao backoffice"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm">Adicionar</button>
        </>}>
        <div className="space-y-3">
          <Field label="Nome"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="nome@piquet.pt" /></Field>
          <Field label="Perfil de permissões"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Admin["role"] })} className="input-field">
            {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></Field>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------- Atividade -------------------------------- */

function AtividadeTab() {
  const { data: log } = useAsyncData(() => getActivityLog(), []);

  const columns: Column<ActivityEntry>[] = [
    { key: "at", label: "Quando", render: (r) => formatDateTime(r.at) },
    { key: "who", label: "Quem", render: (r) => <span className="font-medium">{r.who}</span> },
    { key: "action", label: "Ação" },
    { key: "entity", label: "Entidade", render: (r) => <span className="font-mono text-xs">{r.entity}</span> },
    { key: "change", label: "Alteração", render: (r) => r.oldValue || r.newValue
      ? <span className="text-xs"><span className="text-text-muted line-through">{r.oldValue ?? "—"}</span> → <span className="font-medium">{r.newValue ?? "—"}</span></span>
      : <span className="text-text-muted text-xs">—</span> },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">Registo de auditoria — quem fez o quê, quando, e o que mudou.</p>
      <DataTable columns={columns} data={log ?? []} keyField="id" emptyMessage="Sem atividade registada" />
    </div>
  );
}
