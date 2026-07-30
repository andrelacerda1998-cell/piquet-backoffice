"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { useAsyncData } from "@/hooks/useDashboard";
import { getLeads, updateLead, type Lead } from "@/services/extrasService";
import { toast } from "@/stores";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const LEAD_TONE: Record<Lead["stage"], string> = {
  novo: "bg-info-light text-info",
  contactado: "bg-warning-light text-warning",
  qualificado: "bg-piquet/15 text-piquet-700",
  convertido: "bg-success-light text-success",
  perdido: "bg-danger-light text-danger",
};

const STAGE_LABELS: Record<Lead["stage"], string> = {
  novo: "Novo", contactado: "Contactado", qualificado: "Qualificado", convertido: "Convertido", perdido: "Perdido",
};

export default function LeadsPage() {
  const { data: leads, refetch } = useAsyncData(() => getLeads(), []);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [form, setForm] = useState({ value: 0, stage: "novo" as Lead["stage"] });
  const [saving, setSaving] = useState(false);

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setForm({ value: lead.value, stage: lead.stage });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateLead(selected.id, { value: form.value, stage: form.stage });
      toast(`Lead "${selected.name}" atualizada.`);
      setSelected(null);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const leadColumns: Column<Lead>[] = [
    { key: "name", label: "Lead", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "email", label: "Contacto", render: (r) => (
      <span className="text-xs text-text-secondary">
        {r.email || "—"}{r.phone ? <><br />{r.phone}</> : null}
      </span>
    ) },
    { key: "source", label: "Origem" },
    { key: "city", label: "Cidade" },
    // Mensagem livre do formulário -- é onde costuma vir "que serviço"/"para
    // quando", já que o formulário público não tem campos próprios para
    // isso. Pré-visualização aqui; clicar na linha mostra o texto completo.
    { key: "message", label: "Mensagem", render: (r) => (
      <span className="text-xs text-text-secondary line-clamp-2 max-w-[220px] block">
        {r.message || "—"}
      </span>
    ) },
    { key: "value", label: "Valor estimado", render: (r) => (
      r.value > 0
        ? <span className="font-medium">{formatCurrency(r.value)}</span>
        : <span className="text-text-muted">— clicar para inserir</span>
    ) },
    { key: "stage", label: "Fase", render: (r) => <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", LEAD_TONE[r.stage])}>{r.stage}</span> },
    { key: "createdAt", label: "Entrada", sortable: true, render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <RouteGuard route="/leads">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">CRM &amp; Leads</h1>
          <p className="text-text-secondary mt-1">Contactos recebidos pelo formulário da landing page — clica numa linha para ver a mensagem completa e definir o valor estimado.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["novo", "contactado", "qualificado", "convertido", "perdido"] as Lead["stage"][]).map((st) => (
            <div key={st} className="card p-3">
              <p className="text-xs text-text-secondary capitalize">{st}</p>
              <p className="text-xl font-bold text-text-primary">{(leads ?? []).filter((l) => l.stage === st).length}</p>
            </div>
          ))}
        </div>

        <DataTable columns={leadColumns} data={leads ?? []} keyField="id" onRowClick={openLead} emptyMessage="Sem leads recebidas" />

        <Modal
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.name ?? ""}
          subtitle={selected ? `${selected.source} · ${selected.city} · ${formatDate(selected.createdAt)}` : undefined}
          footer={<>
            <button onClick={() => setSelected(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? "A guardar…" : "Guardar"}</button>
          </>}
        >
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-text-secondary text-xs">Email</p>
                  <p className="font-medium">{selected.email || "—"}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs">Telefone</p>
                  <p className="font-medium">{selected.phone || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-text-secondary text-xs mb-1">Mensagem</p>
                <p className="text-sm text-text-primary rounded-lg bg-surface-subtle px-3 py-2 whitespace-pre-wrap">
                  {selected.message || "Sem mensagem — o formulário não pergunta o que a pessoa procura nem para quando, só ficou o contacto."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor estimado (€)" hint="Para te organizares financeiramente — ninguém preenche isto sozinho.">
                  <input
                    type="number" min={0} step="0.01"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                    className="input-field"
                  />
                </Field>
                <Field label="Fase">
                  <select
                    value={form.stage}
                    onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as Lead["stage"] }))}
                    className="input-field"
                  >
                    {(Object.keys(STAGE_LABELS) as Lead["stage"][]).map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </RouteGuard>
  );
}
