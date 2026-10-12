"use client";

import { useEffect, useState } from "react";
import { Modal, Field } from "./Modal";
import { formatCurrency } from "@/lib/formatters";
import { MOTIVO_MINIMO } from "@/lib/motivo";
import { refundAppPayment } from "@/services/financeService";
import { toast } from "@/stores";

/**
 * Reembolsar um pagamento: o mesmo diálogo na ficha do pedido e no Financeiro.
 *
 * Diz a quem e quanto, deixa devolver só uma parte (o Payshop aceita), e pede
 * o motivo, que fica com o nome de quem reembolsou. Por omissão devolve tudo
 * o que ainda está cobrado.
 */
export function ReembolsoDialog({ open, onClose, onFeito, uuid, cliente, cobradoCents, jaDevolvidoCents = 0, servicoId }: {
  open: boolean;
  onClose: () => void;
  onFeito?: () => void;
  uuid: string;
  cliente: string;
  cobradoCents: number;
  jaDevolvidoCents?: number;
  servicoId?: string | null;
}) {
  const disponivel = Math.max(0, cobradoCents - jaDevolvidoCents);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    if (open) { setValor((disponivel / 100).toFixed(2).replace(".", ",")); setMotivo(""); }
  }, [open, disponivel]);

  const cents = Math.round(Number(valor.replace(/\s/g, "").replace(",", ".")) * 100);
  const valorValido = Number.isFinite(cents) && cents > 0 && cents <= disponivel;
  const motivoCurto = motivo.trim().length < MOTIVO_MINIMO;
  const parcial = valorValido && cents < disponivel;

  const confirmar = async () => {
    if (!valorValido || motivoCurto) return;
    setAEnviar(true);
    try {
      await refundAppPayment(uuid, motivo.trim(), {
        // Sem valor, o Payshop devolve tudo; com valor, só essa parte (em cêntimos).
        ...(parcial ? { amountCents: cents } : {}),
        ...(servicoId ? { servicoId } : {}),
      });
      toast(`Reembolso de ${formatCurrency(cents / 100)} enviado ao Payshop.`);
      onFeito?.();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao reembolsar.", "error");
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reembolsar"
      subtitle={`A ${cliente || "este cliente"}, pelo mesmo meio de pagamento. Não se desfaz.`}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={confirmar} disabled={!valorValido || motivoCurto || aEnviar} className="btn-primary bg-danger hover:bg-danger/90 disabled:opacity-40">
            {aEnviar ? "A enviar…" : `Reembolsar ${valorValido ? formatCurrency(cents / 100) : ""}`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Cobrado: <b className="text-text-primary">{formatCurrency(cobradoCents / 100)}</b>
          {jaDevolvidoCents > 0 && <> · já devolvido: <b className="text-text-primary">{formatCurrency(jaDevolvidoCents / 100)}</b></>}
          . O dinheiro sai da conta da Piquet. Se o pedido ainda estiver a decorrer, o Payshop não deixa: primeiro tem de ser cancelado na app.
        </p>
        <Field label="Valor a devolver (€)" hint={`Até ${formatCurrency(disponivel / 100)}. Para devolver só uma parte, escreve o valor.`}>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="input-field" aria-invalid={!valorValido} />
        </Field>
        <Field label="Porque é que estás a reembolsar?" hint="Fica registado com o teu nome.">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex.: cobrança em duplicado; serviço não realizado por falta do técnico"
            className="input-field resize-y"
          />
        </Field>
      </div>
    </Modal>
  );
}
