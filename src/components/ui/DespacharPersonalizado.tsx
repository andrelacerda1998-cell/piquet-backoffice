"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/ui/Modal";
import { useAsyncData } from "@/hooks/useDashboard";
import { getOperationAreas } from "@/services/catalogService";
import { acaoDoPedido } from "@/services/dashboardService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";

/**
 * Despachar um pedido personalizado: a equipa define quanto tempo o trabalho
 * leva e que categorias de técnicos o podem fazer, e saem os convites. É o
 * mesmo que o botão do Filament (backend #165), agora sem sair do backoffice.
 *
 * As categorias que o cliente escolheu vêm marcadas; a duração não, porque é
 * a Piquet que a decide.
 */
export function DespacharPersonalizado({ open, onClose, servicoId, descricao, categoriasDoCliente, onDespachado }: {
  open: boolean;
  onClose: () => void;
  servicoId: string;
  descricao: string | null;
  categoriasDoCliente: string[];
  onDespachado: () => void;
}) {
  const { data } = useAsyncData(() => (open ? getOperationAreas() : Promise.resolve(null)), [open]);
  const areas = data?.items ?? [];
  const [minutos, setMinutos] = useState(60);
  const [escolhidas, setEscolhidas] = useState<Set<number> | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  // Na primeira abertura, marca as que o cliente escolheu (pelo nome).
  const marcadas = escolhidas
    ?? new Set(areas.filter((a) => categoriasDoCliente.some((c) => c.toLowerCase() === a.name.toLowerCase())).map((a) => a.id));
  const alternar = (id: number) => {
    const n = new Set(marcadas);
    if (n.has(id)) n.delete(id); else n.add(id);
    setEscolhidas(n);
  };

  const despachar = async () => {
    setAEnviar(true);
    try {
      const r = await acaoDoPedido(servicoId, "despachar", { minutos, areas: [...marcadas] });
      toast(r.convidados
        ? `Despachado: ${r.convidados} ${r.convidados === 1 ? "técnico convidado" : "técnicos convidados"}.`
        : "Despachado, mas não havia técnicos elegíveis: o pedido falhou e o cliente foi avisado.",
      r.convidados ? "success" : "error");
      onDespachado();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível despachar.", "error");
    } finally {
      setAEnviar(false);
    }
  };

  const pronto = minutos >= 15 && marcadas.size > 0 && !aEnviar;
  return (
    <Modal
      open={open}
      onClose={() => { if (!aEnviar) onClose(); }}
      title={`Despachar o pedido #${servicoId}`}
      subtitle="Define a duração e as categorias; os convites saem logo a seguir."
      footer={<>
        <button onClick={onClose} disabled={aEnviar} className="btn-secondary text-sm">Cancelar</button>
        <button onClick={despachar} disabled={!pronto} className="btn-primary text-sm disabled:opacity-50">
          {aEnviar ? "A despachar…" : "Despachar"}
        </button>
      </>}
    >
      <div className="space-y-4">
        {descricao && <p className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-primary whitespace-pre-line">{descricao}</p>}
        <Field label="Quanto tempo leva (minutos)">
          <input type="number" min={15} step={15} value={minutos}
            onChange={(e) => setMinutos(Number(e.target.value))} className="input-field max-w-[160px]" />
        </Field>
        <div>
          <p className="text-sm font-medium text-text-secondary mb-2">Que técnicos o podem fazer</p>
          {areas.length === 0 ? <p className="text-sm text-text-muted">A carregar as categorias…</p> : (
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <button key={a.id} type="button" onClick={() => alternar(a.id)}
                  className={cn("rounded-full border px-3 py-1 text-sm",
                    marcadas.has(a.id) ? "border-piquet bg-piquet/15 text-text-primary" : "border-surface-border text-text-secondary hover:bg-surface-muted")}>
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-text-muted">Se não houver nenhum técnico elegível, o pedido falha já e o cliente é avisado.</p>
      </div>
    </Modal>
  );
}
