"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { usePersistentList } from "@/hooks/usePersistentList";
import { getCatalog, type ServiceType } from "@/services/extrasService";
import { formatCurrency } from "@/lib/formatters";
import { DEFAULT_SETTINGS } from "@/config/dashboard";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import {
  Plus, Siren, Droplet, Zap, Wind, KeyRound, Hammer, Sparkles, Sofa, Wrench,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Siren, Droplet, Zap, Wind, KeyRound, Hammer, Sparkles, Sofa, Wrench,
};

function CatalogoContent() {
  const { data, loading, error, refetch } = useAsyncData(() => getCatalog(), []);
  const [types, setTypes] = usePersistentList<ServiceType>("service-types", data?.serviceTypes);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", categoryName: DEFAULT_SETTINGS.categories[0].name, basePrice: 50, commission: 25 });

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const toggleActive = (id: string) => {
    setTypes((prev) => prev.map((t) => t.id === id ? { ...t, active: !t.active } : t));
    const t = types.find((x) => x.id === id);
    toast(`"${t?.name}" ${t?.active ? "desativado" : "ativado"}.`, t?.active ? "info" : "success");
  };

  const createType = () => {
    if (!form.name.trim()) { toast("Indica o nome do tipo de serviço.", "error"); return; }
    const newType: ServiceType = {
      id: `st_${Date.now()}`,
      name: form.name.trim(),
      categoryName: form.categoryName,
      basePrice: Number(form.basePrice),
      commission: Number(form.commission),
      active: true,
    };
    setTypes((prev) => [newType, ...prev]);
    setOpen(false);
    setForm({ name: "", categoryName: DEFAULT_SETTINGS.categories[0].name, basePrice: 50, commission: 25 });
    toast(`Tipo de serviço "${newType.name}" criado.`);
  };

  const columns: Column<ServiceType>[] = [
    { key: "name", label: "Tipo de serviço", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "categoryName", label: "Categoria" },
    { key: "basePrice", label: "Preço base", sortable: true, render: (r) => formatCurrency(r.basePrice) },
    { key: "commission", label: "Comissão", render: (r) => `${r.commission}%` },
    {
      key: "active", label: "Estado",
      render: (r) => (
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", r.active ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", r.active ? "bg-success" : "bg-text-muted")} />
          {r.active ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (r) => (
        <button onClick={() => toggleActive(r.id)} className="text-xs text-piquet-600 hover:underline">
          {r.active ? "Desativar" : "Ativar"}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Catálogo</h1>
            <p className="text-text-secondary mt-1">{types.length} tipos de serviço em {data?.categories.length ?? 0} categorias</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo tipo</button>
        </div>

        {/* Categorias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.categories.map((c) => {
            const Icon = iconMap[c.icon] ?? Wrench;
            return (
              <div key={c.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{c.name}</p>
                    <p className="text-xs text-text-secondary">{c.typeCount} tipos</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
                  <span>Comissão <b className="text-text-primary">{c.commission}%</b></span>
                  <span>{c.zones} zonas</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tipos de serviço */}
        <div>
          <h3 className="font-semibold mb-3">Tipos de serviço</h3>
          <DataTable columns={columns} data={types} keyField="id" />
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo tipo de serviço"
        subtitle="Adiciona um serviço ao catálogo da Piquet"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={createType} className="btn-primary text-sm">Criar tipo</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome do serviço">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Instalação de esquentador" className="input-field" />
          </Field>
          <Field label="Categoria">
            <select value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} className="input-field">
              {DEFAULT_SETTINGS.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Preço base (€)">
              <input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} className="input-field" />
            </Field>
            <Field label="Comissão Piquet (%)" hint="% que a Piquet retém">
              <input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: Number(e.target.value) })} className="input-field" />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function CatalogPage() {
  return (
    <RouteGuard route="/catalogo">
      <CatalogoContent />
    </RouteGuard>
  );
}
