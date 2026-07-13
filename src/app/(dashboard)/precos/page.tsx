"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getCatalog, getPromotions, type ServiceType, type Promotion } from "@/services/extrasService";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Plus, Tag } from "lucide-react";

const PROMO_TONE: Record<Promotion["status"], string> = {
  ativa: "bg-success-light text-success",
  agendada: "bg-info-light text-info",
  expirada: "bg-surface-subtle text-text-secondary",
};

function PrecosContent() {
  const catalog = useAsyncData(() => getCatalog(), []);
  const promosData = useAsyncData(() => getPromotions(), []);
  const [tab, setTab] = useState("promocoes");
  const [promos, setPromos] = usePersistentList<Promotion>("promocoes", promosData.data);
  // Partilha o domínio "service-types" com o Catálogo — editar preço aqui reflete-se lá.
  const [types, setTypes] = usePersistentList<ServiceType>("service-types", catalog.data?.serviceTypes);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discount: "", validUntil: "2026-12-31" });
  const [editing, setEditing] = useState<ServiceType | null>(null);

  const saveEdit = () => {
    if (!editing) return;
    setTypes((prev) => prev.map((t) => t.id === editing.id ? editing : t));
    toast(`Preço de "${editing.name}" atualizado: ${formatCurrency(editing.basePrice)} · ${editing.commission}% comissão.`);
    setEditing(null);
  };

  if (catalog.loading && !catalog.data) return <LoadingState />;
  if (catalog.error) return <ErrorState message={catalog.error} onRetry={catalog.refetch} />;

  const createPromo = () => {
    if (!form.code.trim() || !form.discount.trim()) { toast("Indica o código e o desconto.", "error"); return; }
    const p: Promotion = {
      id: `p_${Date.now()}`,
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || "Sem descrição",
      discount: form.discount.trim(),
      status: "ativa",
      uses: 0,
      validUntil: form.validUntil,
    };
    setPromos((prev) => [p, ...prev]);
    setOpen(false);
    setForm({ code: "", description: "", discount: "", validUntil: "2026-12-31" });
    toast(`Promoção "${p.code}" criada e ativa.`);
  };

  const TABS: TabDef[] = [
    { id: "promocoes", label: "Promoções", count: promos.length },
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
            <h1 className="text-2xl font-bold">Preços e promoções</h1>
            <p className="text-text-secondary mt-1">Tabela de preços por serviço e campanhas promocionais</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova promoção</button>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "promocoes" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {promos.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-piquet/15 text-piquet-700 px-2.5 py-1 text-sm font-bold tracking-wide">
                    <Tag className="h-3.5 w-3.5" />{p.code}
                  </span>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", PROMO_TONE[p.status])}>
                    {p.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-text-secondary">{p.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
                  <span className="text-lg font-bold text-text-primary">{p.discount}</span>
                  <span>{p.uses} usos · até {p.validUntil}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "precos" && (
          <DataTable columns={priceColumns} data={types} keyField="id" />
        )}
      </div>

      {/* Modal — editar preço/comissão */}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova promoção"
        subtitle="Cria um código promocional para clientes"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={createPromo} className="btn-primary text-sm">Criar promoção</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VERAO25" className="input-field uppercase" />
            </Field>
            <Field label="Desconto" hint="Ex.: -10% ou -25€">
              <input value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="-10%" className="input-field" />
            </Field>
          </div>
          <Field label="Descrição">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="10% na primeira marcação" className="input-field" />
          </Field>
          <Field label="Válida até">
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="input-field" />
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
