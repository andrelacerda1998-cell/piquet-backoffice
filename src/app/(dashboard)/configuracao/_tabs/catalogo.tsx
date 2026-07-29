"use client";

import { useMemo, useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  createOperationArea,
  createServiceType,
  getOperationAreas,
  getServiceTypes,
  updateOperationArea,
  updateServiceType,
  type OperationArea,
  type ServiceType,
} from "@/services/catalogService";
import { toast } from "@/stores";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Plus, Wrench, Pencil } from "lucide-react";

/**
 * Catálogo (tipos de serviço) + Categorias — migrado do Filament
 * (ServicesTypeResource/OperationAreaResource) para o Laravel. Ver
 * src/services/catalogService.ts.
 *
 * Fatia "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29).
 * Sem Zonas/AllowedZone (geografia, não categoria) -- a aba "Zonas" ao lado
 * continua fictícia e fica para uma fatia futura. Sem upload de imagem nem
 * gestão de certificações (documents) por simplicidade.
 *
 * "Inclui"/"Não inclui" e o nome são traduzíveis no Filament (campos EN +
 * PT-PT lado a lado); aqui usam-se campos únicos, gravados nas duas línguas
 * pelo backend (ver notas em ServicesTypeController).
 */

async function loadCatalog() {
  const [areas, types] = await Promise.all([getOperationAreas(), getServiceTypes()]);
  return { areas: areas.items, types: types.items };
}

function CatalogoContent() {
  const { data, loading, error, refetch } = useAsyncData(loadCatalog, []);

  const [areaModal, setAreaModal] = useState<{ open: boolean; editing: OperationArea | null; name: string }>({
    open: false,
    editing: null,
    name: "",
  });
  const [typeModal, setTypeModal] = useState<{
    open: boolean;
    editing: ServiceType | null;
    name: string;
    operationAreaId: number | null;
    time: string;
    startsFrom: string;
    includes: string;
    excludes: string;
  }>({ open: false, editing: null, name: "", operationAreaId: null, time: "", startsFrom: "", includes: "", excludes: "" });
  const [saving, setSaving] = useState(false);

  const areas = useMemo(() => data?.areas ?? [], [data]);
  const types = useMemo(() => data?.types ?? [], [data]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openNewArea = () => setAreaModal({ open: true, editing: null, name: "" });
  const openEditArea = (a: OperationArea) => setAreaModal({ open: true, editing: a, name: a.name });

  const saveArea = async () => {
    const name = areaModal.name.trim();
    if (!name) { toast("Indica o nome da categoria.", "error"); return; }
    setSaving(true);
    try {
      if (areaModal.editing) {
        await updateOperationArea(areaModal.editing.id, { name });
        toast(`Categoria "${name}" atualizada.`);
      } else {
        await createOperationArea({ name });
        toast(`Categoria "${name}" criada.`);
      }
      setAreaModal({ open: false, editing: null, name: "" });
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar a categoria.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openNewType = () => setTypeModal({
    open: true, editing: null, name: "", operationAreaId: areas[0]?.id ?? null, time: "", startsFrom: "", includes: "", excludes: "",
  });
  const openEditType = (t: ServiceType) => setTypeModal({
    open: true,
    editing: t,
    name: t.name,
    operationAreaId: t.operation_area_id,
    time: String(t.time ?? ""),
    startsFrom: t.starts_from != null ? String(t.starts_from) : "",
    includes: t.includes.join("\n"),
    excludes: t.excludes.join("\n"),
  });

  const parseLines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

  const saveType = async () => {
    const name = typeModal.name.trim();
    if (!name) { toast("Indica o nome do tipo de serviço.", "error"); return; }
    if (!typeModal.operationAreaId) { toast("Escolhe uma categoria.", "error"); return; }
    const time = Number(typeModal.time);
    if (!typeModal.time || Number.isNaN(time) || time < 0) { toast("Indica a duração do serviço (minutos).", "error"); return; }

    const input = {
      name,
      operation_area_id: typeModal.operationAreaId,
      time,
      starts_from: typeModal.startsFrom.trim() ? Number(typeModal.startsFrom) : null,
      includes: parseLines(typeModal.includes),
      excludes: parseLines(typeModal.excludes),
    };

    setSaving(true);
    try {
      if (typeModal.editing) {
        await updateServiceType(typeModal.editing.id, input);
        toast(`Tipo de serviço "${name}" atualizado.`);
      } else {
        await createServiceType(input);
        toast(`Tipo de serviço "${name}" criado.`);
      }
      setTypeModal({ open: false, editing: null, name: "", operationAreaId: null, time: "", startsFrom: "", includes: "", excludes: "" });
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar o tipo de serviço.", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<ServiceType>[] = [
    { key: "name", label: "Tipo de serviço", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "operation_area_name", label: "Categoria", render: (r) => r.operation_area_name ?? "—" },
    { key: "time", label: "Duração", render: (r) => (r.time != null ? `${r.time} min` : "—") },
    { key: "starts_from", label: "A partir de", render: (r) => (r.starts_from != null ? `${r.starts_from} €` : "—") },
    { key: "vendors_count", label: "Técnicos", render: (r) => r.vendors_count },
    {
      key: "actions", label: "",
      render: (r) => (
        <button onClick={() => openEditType(r)} className="inline-flex items-center gap-1 text-xs text-piquet-600 hover:underline">
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
            <h1 className="text-2xl font-bold">Catálogo <DemoBadge endpoint="/services-types" /></h1>
            <p className="text-text-secondary mt-1">{types.length} tipos de serviço em {areas.length} categorias</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNewArea} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> Nova categoria</button>
            <button onClick={openNewType} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo tipo</button>
          </div>
        </div>

        {/* Categorias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {areas.map((a) => (
            <button key={a.id} onClick={() => openEditArea(a)} className="card p-4 text-left hover:border-piquet-300 transition-colors">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700">
                  <Wrench className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{a.name}</p>
                  <p className="text-xs text-text-secondary">{a.services_types_count} tipos</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-text-secondary">
                {a.vendors_count} técnico{a.vendors_count === 1 ? "" : "s"}
              </div>
            </button>
          ))}
          {areas.length === 0 && (
            <p className="text-sm text-text-secondary col-span-full">Ainda sem categorias.</p>
          )}
        </div>

        {/* Tipos de serviço */}
        <div>
          <h3 className="font-semibold mb-3">Tipos de serviço</h3>
          <DataTable columns={columns} data={types} keyField="id" emptyMessage="Ainda sem tipos de serviço." />
        </div>
      </div>

      {/* Categoria: criar/editar */}
      <Modal
        open={areaModal.open}
        onClose={() => setAreaModal({ open: false, editing: null, name: "" })}
        title={areaModal.editing ? "Editar categoria" : "Nova categoria"}
        subtitle="Categoria de serviços (ex.: Canalização, Eletricista)"
        footer={
          <>
            <button onClick={() => setAreaModal({ open: false, editing: null, name: "" })} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveArea} disabled={saving} className="btn-primary text-sm">{areaModal.editing ? "Guardar" : "Criar categoria"}</button>
          </>
        }
      >
        <Field label="Nome da categoria">
          <input
            value={areaModal.name}
            onChange={(e) => setAreaModal({ ...areaModal, name: e.target.value })}
            placeholder="Ex.: Canalização"
            className="input-field"
          />
        </Field>
      </Modal>

      {/* Tipo de serviço: criar/editar */}
      <Modal
        open={typeModal.open}
        onClose={() => setTypeModal({ ...typeModal, open: false })}
        title={typeModal.editing ? "Editar tipo de serviço" : "Novo tipo de serviço"}
        subtitle="Adiciona um serviço ao catálogo da Piquet"
        footer={
          <>
            <button onClick={() => setTypeModal({ ...typeModal, open: false })} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveType} disabled={saving} className="btn-primary text-sm">{typeModal.editing ? "Guardar" : "Criar tipo"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome do serviço">
            <input
              value={typeModal.name}
              onChange={(e) => setTypeModal({ ...typeModal, name: e.target.value })}
              placeholder="Ex.: Instalação de esquentador"
              className="input-field"
            />
          </Field>
          <Field label="Categoria">
            <select
              value={typeModal.operationAreaId ?? ""}
              onChange={(e) => setTypeModal({ ...typeModal, operationAreaId: Number(e.target.value) })}
              className="input-field"
            >
              {areas.length === 0 && <option value="">Cria uma categoria primeiro</option>}
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duração (min)">
              <input type="number" min={0} value={typeModal.time} onChange={(e) => setTypeModal({ ...typeModal, time: e.target.value })} className="input-field" />
            </Field>
            <Field label="A partir de (€)" hint="Opcional">
              <input type="number" min={0} value={typeModal.startsFrom} onChange={(e) => setTypeModal({ ...typeModal, startsFrom: e.target.value })} className="input-field" />
            </Field>
          </div>
          <Field label="Inclui" hint="Um item por linha">
            <textarea
              value={typeModal.includes}
              onChange={(e) => setTypeModal({ ...typeModal, includes: e.target.value })}
              rows={3}
              className="input-field"
            />
          </Field>
          <Field label="Não inclui" hint="Um item por linha">
            <textarea
              value={typeModal.excludes}
              onChange={(e) => setTypeModal({ ...typeModal, excludes: e.target.value })}
              rows={3}
              className="input-field"
            />
          </Field>
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
