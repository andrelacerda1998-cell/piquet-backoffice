"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getCatalog, type ServiceType } from "@/services/extrasService";
import {
  getVouchers, createVoucher, updateVoucher, deleteVoucher,
  type Voucher, type VoucherServiceType, type VoucherInput,
} from "@/services/vouchersService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Plus, Tag, Trash2, Power } from "lucide-react";
import { DemoBadge } from "@/components/ui/DemoBadge";

const SERVICE_TYPE_LABEL: Record<VoucherServiceType, string> = {
  scheduled: "Agendado",
  immediate: "Imediato",
};

/** Estado derivado (o backend só guarda is_active + datas, ver Voucher::isValid()). */
type VoucherStatus = "ativo" | "agendado" | "expirado" | "inativo";

function voucherStatus(v: Voucher): VoucherStatus {
  if (!v.is_active) return "inativo";
  if (v.start_date && new Date(v.start_date) > new Date()) return "agendado";
  if (!v.is_valid) return "expirado";
  return "ativo";
}

const STATUS_TONE: Record<VoucherStatus, string> = {
  ativo: "bg-success-light text-success",
  agendado: "bg-info-light text-info",
  expirado: "bg-surface-subtle text-text-secondary",
  inativo: "bg-surface-subtle text-text-secondary",
};

const STATUS_LABEL: Record<VoucherStatus, string> = {
  ativo: "Ativo",
  agendado: "Agendado",
  expirado: "Expirado",
  inativo: "Inativo",
};

const EMPTY_FORM: VoucherInput = {
  name: "",
  discount_percentage: 10,
  valid_services: ["scheduled", "immediate"],
  max_uses: null,
  start_date: null,
  end_date: null,
  is_active: true,
};

function PrecosContent() {
  const catalog = useAsyncData(() => getCatalog(), []);
  const vouchersData = useAsyncData(() => getVouchers(), []);
  const [tab, setTab] = useState("promocoes");
  // Partilha o domínio "service-types" com o Catálogo — editar preço aqui reflete-se lá.
  const [types, setTypes] = usePersistentList<ServiceType>("service-types", catalog.data?.serviceTypes);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VoucherInput>(EMPTY_FORM);
  const [editing, setEditing] = useState<ServiceType | null>(null);

  const saveEdit = () => {
    if (!editing) return;
    setTypes((prev) => prev.map((t) => t.id === editing.id ? editing : t));
    toast(`Preço de "${editing.name}" atualizado: ${formatCurrency(editing.basePrice)} · ${editing.commission}% comissão.`);
    setEditing(null);
  };

  if (catalog.loading && !catalog.data) return <LoadingState />;
  if (catalog.error) return <ErrorState message={catalog.error} onRetry={catalog.refetch} />;

  const vouchers = vouchersData.data?.items ?? [];

  const createNewVoucher = async () => {
    if (!form.name.trim()) { toast("Indica o nome do voucher.", "error"); return; }
    if (form.name.trim().length > 30) { toast("O nome não pode ter mais de 30 caracteres.", "error"); return; }
    if (!form.discount_percentage || form.discount_percentage < 1 || form.discount_percentage > 100) {
      toast("Indica uma percentagem de desconto entre 1 e 100.", "error");
      return;
    }
    if (form.valid_services.length === 0) { toast("Escolhe pelo menos um tipo de serviço.", "error"); return; }

    setSaving(true);
    try {
      const created = await createVoucher({ ...form, name: form.name.trim() });
      setOpen(false);
      setForm(EMPTY_FORM);
      vouchersData.refetch();
      toast(`Voucher "${created.name}" criado.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível criar o voucher.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: Voucher) => {
    try {
      await updateVoucher(v.id, { is_active: !v.is_active });
      vouchersData.refetch();
      toast(v.is_active ? `Voucher "${v.name}" desativado.` : `Voucher "${v.name}" ativado.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível atualizar o voucher.", "error");
    }
  };

  const removeVoucher = async (v: Voucher) => {
    if (!confirm(`Apagar o voucher "${v.name}"? Esta ação não pode ser revertida.`)) return;
    try {
      await deleteVoucher(v.id);
      vouchersData.refetch();
      toast(`Voucher "${v.name}" removido.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível remover o voucher.", "error");
    }
  };

  const TABS: TabDef[] = [
    { id: "promocoes", label: "Vouchers", count: vouchers.length },
    { id: "precos", label: "Tabela de preços" },
  ];

  const priceColumns: Column<ServiceType>[] = [
    { key: "name", label: "Serviço", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "categoryName", label: "Categoria" },
    { key: "basePrice", label: "Preço base", sortable: true, render: (r) => formatCurrency(r.basePrice) },
    { key: "commission", label: "Comissão Piquet", render: (r) => `${r.commission}%` },
    { key: "net", label: "Líquido técnico", render: (r) => formatCurrency(r.basePrice * (1 - r.commission / 100)) },
    { key: "actions", label: "", render: (r) => <button onClick={() => setEditing(r)} className="text-xs text-piquet-600 hover:underline">Editar</button> },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Preços e vouchers <DemoBadge endpoint="/vouchers" /></h1>
            <p className="text-text-secondary mt-1">Tabela de preços por serviço e vouchers de desconto</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo voucher</button>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "promocoes" && (
          <>
            {vouchersData.loading && !vouchersData.data && <LoadingState />}
            {vouchersData.error && <ErrorState message={vouchersData.error} onRetry={vouchersData.refetch} />}
            {!vouchersData.loading && vouchers.length === 0 && (
              <div className="card p-8 text-center text-text-secondary text-sm">
                Ainda não há vouchers. Cria o primeiro com o botão acima.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vouchers.map((v) => {
                const status = voucherStatus(v);
                return (
                  <div key={v.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-piquet/15 text-piquet-700 px-2.5 py-1 text-sm font-bold tracking-wide">
                        <Tag className="h-3.5 w-3.5" />{v.name}
                      </span>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", STATUS_TONE[status])}>
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">
                      {v.valid_services.map((s) => SERVICE_TYPE_LABEL[s]).join(", ") || "—"}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
                      <span className="text-lg font-bold text-text-primary">-{v.discount_percentage}%</span>
                      <span>
                        {v.usages_count} {v.usages_count === 1 ? "utilização" : "utilizações"}
                        {v.max_uses ? ` / ${v.max_uses}` : ""} ·{" "}
                        {v.end_date ? `até ${formatDate(v.end_date)}` : "eterno"}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-end gap-3">
                      <button onClick={() => toggleActive(v)} className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
                        <Power className="h-3.5 w-3.5" /> {v.is_active ? "Desativar" : "Ativar"}
                      </button>
                      <button onClick={() => removeVoucher(v)} className="inline-flex items-center gap-1 text-xs text-danger hover:underline">
                        <Trash2 className="h-3.5 w-3.5" /> Apagar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "precos" && (
          <DataTable columns={priceColumns} data={types} keyField="id" />
        )}
      </div>

      {/* Modal — editar preço/comissão (Tabela de preços) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar preço"
        subtitle={editing?.name}
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveEdit} className="btn-primary text-sm">Guardar</button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Preço base (€)">
                <input type="number" value={editing.basePrice} onChange={(e) => setEditing({ ...editing, basePrice: Number(e.target.value) })} className="input-field" />
              </Field>
              <Field label="Comissão Piquet (%)">
                <input type="number" value={editing.commission} onChange={(e) => setEditing({ ...editing, commission: Number(e.target.value) })} className="input-field" />
              </Field>
            </div>
            <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">
              Líquido para o técnico: <b className="text-text-primary">{formatCurrency(editing.basePrice * (1 - editing.commission / 100))}</b>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal — novo voucher */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo voucher"
        subtitle="Só super-admins podem criar ou editar vouchers"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={createNewVoucher} disabled={saving} className="btn-primary text-sm">{saving ? "A criar…" : "Criar voucher"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome" hint="Máx. 30 caracteres">
            <input
              value={form.name}
              maxLength={30}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="BlackFriday25"
              className="input-field"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Desconto (%)">
              <input
                type="number"
                min={1}
                max={100}
                value={form.discount_percentage}
                onChange={(e) => setForm({ ...form, discount_percentage: Number(e.target.value) })}
                className="input-field"
              />
            </Field>
            <Field label="Nº máx. de utilizações" hint="Vazio = ilimitado">
              <input
                type="number"
                min={1}
                value={form.max_uses ?? ""}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })}
                placeholder="Ilimitado"
                className="input-field"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Início">
              <input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
                className="input-field"
              />
            </Field>
            <Field label="Fim" hint="Vazio = eterno">
              <input
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
                className="input-field"
              />
            </Field>
          </div>
          <Field label="Válido para">
            <div className="flex gap-4">
              {(Object.keys(SERVICE_TYPE_LABEL) as VoucherServiceType[]).map((key) => (
                <label key={key} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.valid_services.includes(key)}
                    onChange={(e) => setForm({
                      ...form,
                      valid_services: e.target.checked
                        ? [...form.valid_services, key]
                        : form.valid_services.filter((s) => s !== key),
                    })}
                  />
                  {SERVICE_TYPE_LABEL[key]}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </>
  );
}

export default function PricingPage() {
  return (
    <RouteGuard route="/precos">
      <PrecosContent />
    </RouteGuard>
  );
}
