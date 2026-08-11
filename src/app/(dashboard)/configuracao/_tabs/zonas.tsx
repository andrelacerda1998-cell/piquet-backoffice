"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { createZone, getZones, updateZone, type AllowedZone } from "@/services/zonesService";
import { toast } from "@/stores";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Plus, Pencil } from "lucide-react";

/**
 * Zonas — migrado do Filament (AllowedZoneResource) para o Laravel. Ver
 * src/services/zonesService.ts.
 *
 * Fatia "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29).
 * O ecrã anterior ("Zonas de operação") mostrava um dashboard de desempenho
 * inteiramente fictício -- clientes/técnicos/pedidos/cobertura/receita por
 * zona não existem no modelo real (AllowedZone é só cidade + distrito +
 * técnicos associados). Esses indicadores foram removidos, não substituídos:
 * mostrar zero em vez de ficção seria enganador na mesma forma, e mostrar
 * como "vazio" também não é verdade -- o Laravel simplesmente não modela
 * "desempenho por zona".
 */

function ZonasContent() {
  const { data, loading, error, refetch } = useAsyncData(() => getZones(), []);
  const zones = data?.items ?? [];

  const [modal, setModal] = useState<{ open: boolean; editing: AllowedZone | null; city: string; district: string }>({
    open: false, editing: null, city: "", district: "",
  });
  const [saving, setSaving] = useState(false);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openNew = () => setModal({ open: true, editing: null, city: "", district: "" });
  const openEdit = (z: AllowedZone) => setModal({ open: true, editing: z, city: z.city, district: z.district ?? "" });
  const close = () => setModal({ open: false, editing: null, city: "", district: "" });

  const save = async () => {
    const city = modal.city.trim();
    if (!city) { toast("Indica a cidade da zona.", "error"); return; }
    const district = modal.district.trim() || null;

    setSaving(true);
    try {
      if (modal.editing) {
        await updateZone(modal.editing.id, { city, district });
        toast(`Zona "${city}" atualizada.`);
      } else {
        await createZone({ city, district });
        toast(`Zona "${city}" criada.`);
      }
      close();
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar a zona.", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AllowedZone>[] = [
    { key: "city", label: "Cidade", sortable: true, render: (r) => <span className="font-medium">{r.city}</span> },
    { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
    { key: "vendors_count", label: "Técnicos", sortable: true, render: (r) => r.vendors_count },
    {
      key: "actions", label: "",
      render: (r) => (
        <button onClick={() => openEdit(r)} className="inline-flex items-center gap-1 text-xs text-piquet-600 hover:underline">
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Zonas <DemoBadge endpoint="/allowed-zones" /></h1>
            <p className="text-text-secondary mt-1">{zones.length} zonas onde a Piquet opera</p>
          </div>
          <button onClick={openNew} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova zona</button>
        </div>

        <DataTable columns={columns} data={zones} keyField="id" emptyMessage="Ainda sem zonas." />
      </div>

      <Modal
        open={modal.open}
        onClose={close}
        title={modal.editing ? "Editar zona" : "Nova zona"}
        subtitle="Cidade onde a Piquet aceita pedidos de serviço"
        footer={
          <>
            <button onClick={close} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">{modal.editing ? "Guardar" : "Criar zona"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Cidade">
            <input
              value={modal.city}
              onChange={(e) => setModal({ ...modal, city: e.target.value })}
              placeholder="Ex.: Cascais"
              className="input-field"
            />
          </Field>
          <Field label="Distrito" hint="Opcional">
            <input
              value={modal.district}
              onChange={(e) => setModal({ ...modal, district: e.target.value })}
              placeholder="Ex.: Lisboa"
              className="input-field"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export default function ZonesPage() {
  return (
    <RouteGuard route="/zonas">
      <ZonasContent />
    </RouteGuard>
  );
}
