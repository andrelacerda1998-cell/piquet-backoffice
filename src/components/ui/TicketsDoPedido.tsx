"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, toast } from "@/stores";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/formatters";
import { Modal, Field } from "@/components/ui/Modal";
import { statusMeta, type TicketStatus } from "@/services/supportInboxService";
import { getTicketsDoPedido, abrirTicketDoPedido, type TicketDoPedido } from "@/services/dashboardService";
import { CATEGORIAS_DO_TICKET, PRIORIDADES_DO_TICKET } from "@/lib/tickets";

/**
 * Os tickets de Suporte ligados a este pedido, e o botão para abrir um.
 *
 * Uma reclamação é um ticket ligado ao pedido: vê-se aqui e em Suporte, no
 * mesmo sítio para quem responde. Quando o cliente liga a queixar-se, quem
 * atende abre o ticket daqui e fica registado com o pedido certo.
 */
export function TicketsDoPedido({ servicoId, temReclamacao }: { servicoId: string; temReclamacao: boolean }) {
  const role = useAuthStore((s) => s.user?.role);
  const veSuporte = !!role && hasPermission(role, "view_support");
  const [tickets, setTickets] = useState<TicketDoPedido[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aAbrir, setAAbrir] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!veSuporte) return;
    let vivo = true;
    getTicketsDoPedido(servicoId)
      .then((t) => vivo && setTickets(t))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível ler os tickets."));
    return () => { vivo = false; };
  }, [servicoId, veSuporte, versao]);

  if (!veSuporte) {
    return temReclamacao
      ? <p className="text-sm text-text-secondary">Há uma reclamação deste pedido. Está em Suporte, com quem trata dos tickets.</p>
      : <p className="text-sm text-text-muted">Sem reclamações.</p>;
  }

  return (
    <div className="space-y-2">
      {erro ? <p className="text-sm text-danger">{erro}</p>
        : tickets === null ? <p className="text-sm text-text-muted">A carregar…</p>
        : tickets.length === 0 ? (
          <p className="text-sm text-text-muted">
            {temReclamacao ? "O pedido tem uma reclamação, mas nenhum ticket com o número dele." : "Nenhum ticket sobre este pedido."}
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {tickets.map((t) => {
              const meta = statusMeta(t.estado as TicketStatus);
              return (
                <li key={t.id} className="py-2">
                  <Link href={`/suporte?ticket=${encodeURIComponent(t.id)}`} className="group flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-text-primary truncate group-hover:underline">{t.assunto}</span>
                      <span className="block text-[11px] text-text-muted">
                        {t.id}{t.categoria ? ` · ${t.categoria}` : ""} · aberto {formatDateTime(t.abertoEm)}
                      </span>
                    </span>
                    <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.tone)}>
                      {meta.label} <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      <button onClick={() => setAAbrir(true)} className="btn-secondary text-xs py-1.5">
        <Plus className="h-3.5 w-3.5" /> Abrir ticket deste pedido
      </button>
      <AbrirTicket
        open={aAbrir}
        servicoId={servicoId}
        onClose={() => setAAbrir(false)}
        onAberto={(t) => { setAAbrir(false); setVersao((v) => v + 1); toast(`Ticket ${t.id} aberto em Suporte.`); }}
      />
    </div>
  );
}

function AbrirTicket({ open, servicoId, onClose, onAberto }: {
  open: boolean; servicoId: string; onClose: () => void; onAberto: (t: TicketDoPedido) => void;
}) {
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_DO_TICKET[0]);
  const [prioridade, setPrioridade] = useState("media");
  const [mensagem, setMensagem] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const curta = mensagem.trim().length < 5;

  const abrir = async () => {
    if (curta) return;
    setAEnviar(true);
    try {
      const t = await abrirTicketDoPedido(servicoId, { categoria, prioridade, mensagem: mensagem.trim() });
      setMensagem("");
      onAberto(t);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível abrir o ticket.", "error");
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Abrir ticket do pedido #${servicoId}`}
      subtitle="Fica em Suporte, ligado a este pedido, com o cliente do pedido como requerente."
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={abrir} disabled={curta || aEnviar} className="btn-primary disabled:opacity-40">
            {aEnviar ? "A abrir…" : "Abrir ticket"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input-field">
              {CATEGORIAS_DO_TICKET.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Importância">
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="input-field">
              {PRIORIDADES_DO_TICKET.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="O que se passa" hint="O cliente não vê este ticket na app: fala com ele por telefone ou WhatsApp.">
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Ex.: o cliente ligou a dizer que a torneira continua a pingar depois da reparação"
            className="input-field resize-y"
          />
        </Field>
      </div>
    </Modal>
  );
}
