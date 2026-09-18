"use client";

import { useEffect, useRef, useState } from "react";
import { getLeadMessages, getTechnicianMessages, type Conversa } from "@/services/extrasService";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, AlertCircle, MessageCircle } from "lucide-react";

/**
 * Conversa de WhatsApp de um pedido — histórico, e o salto para o telemóvel.
 *
 * O backoffice já não envia nada. O 926 866 108 vive na app WhatsApp Business
 * e é de lá que se responde: aqui compõe-se o texto, carrega-se em "Abrir no
 * WhatsApp" e a conversa abre com a mensagem já escrita.
 *
 * O histórico que se vê é do tempo em que o backoffice enviava, mais o que o
 * webhook recebeu. Fica: são conversas reais com clientes.
 */

/** Ícone de estado das NOSSAS mensagens — o mesmo vocabulário do WhatsApp. */
function EstadoMsg({ status }: { status: string }) {
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-danger" aria-label="Falhou" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-info" aria-label="Lida" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-text-muted" aria-label="Entregue" />;
  return <Check className="h-3 w-3 text-text-muted" aria-label="Enviada" />;
}

export function WhatsappConversa({ leadId, tecnicoId, temTelefone, modelo, waNumero, onEntradas }: {
  /** Conversa com o cliente desta lead. Exclusivo com `tecnicoId`. */
  leadId?: string;
  /**
   * Conversa com um técnico. Existe porque as mensagens da rede deixaram de
   * ter de se agarrar a uma lead para existir -- era isso que as punha no CRM
   * como se fossem pedidos de serviço.
   */
  tecnicoId?: string;
  temTelefone: boolean;
  /*
    Quantas mensagens o cliente escreveu. Quem abre a lead precisa de saber
    isto para não repetir ao lado a mensagem que já está aqui no histórico —
    e para a mostrar quando aqui não há nada. É reportado sempre, mesmo sem
    telefone (aí este painel não chega a aparecer).
  */
  onEntradas?: (n: number) => void;
  /** Mensagem-modelo pré-preenchida (nome/serviço/localização) para inserir. */
  modelo?: string;
  /** Número (só dígitos, com indicativo) para o link wa.me de recurso. */
  waNumero?: string;
}) {
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const alvo = leadId ?? tecnicoId ?? "";
  const eTecnico = !leadId && Boolean(tecnicoId);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    (eTecnico ? getTechnicianMessages(alvo) : getLeadMessages(alvo))
      .then((c) => { if (vivo) setConversa(c); })
      .catch(() => { if (vivo) setConversa({ messages: [], migrated: false }); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [alvo, eTecnico]);

  const reportar = useRef(onEntradas);
  reportar.current = onEntradas;
  useEffect(() => {
    if (carregando) return;
    reportar.current?.((conversa?.messages ?? []).filter((m) => m.direction === "in").length);
  }, [conversa, carregando]);

  // Rola para a última mensagem sempre que a conversa muda.
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "nearest" }); }, [conversa?.messages.length]);

  if (!temTelefone) return null;

  const msgs = conversa?.messages ?? [];

  return (
    <div className="rounded-xl border border-surface-border overflow-hidden flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border bg-surface-muted/50 shrink-0">
        <MessageCircle className="h-4 w-4 text-success" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Conversa de WhatsApp</span>
      </div>

      {/* Histórico — cresce para ocupar a altura disponível. */}
      <div className="flex-1 min-h-[200px] overflow-y-auto px-3 py-3 space-y-2 bg-surface">
        {carregando ? (
          <p className="text-sm text-text-muted text-center py-4">A carregar conversa…</p>
        ) : msgs.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">
            Sem histórico de WhatsApp neste contacto.
          </p>
        ) : (
          msgs.map((m) => {
            const nosso = m.direction === "out";
            return (
              <div key={m.id} className={cn("flex", nosso ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2",
                  nosso ? "bg-piquet/15 rounded-br-sm" : "bg-surface-subtle rounded-bl-sm",
                )}>
                  <p className="whitespace-pre-wrap text-sm text-text-primary break-words">{m.body}</p>
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-text-muted">
                    <span>{formatDateTime(m.createdAt)}</span>
                    {nosso && <EstadoMsg status={m.status} />}
                  </div>
                  {nosso && m.status === "failed" && m.error && (
                    <p className="text-[11px] text-danger mt-0.5">{m.error}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {/* Compor a resposta. Não se envia daqui: o botão leva o texto para o
          WhatsApp do telemóvel, que é de onde a Piquet responde. */}
      <div className="border-t border-surface-border p-2 bg-surface-muted/30 space-y-2 shrink-0">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Escreve aqui e abre no WhatsApp…"
          className="input-field resize-y text-sm w-full"
        />
        <div className="flex flex-wrap items-center gap-2">
          {modelo && (
            <button onClick={() => setTexto(modelo)} className="btn-secondary text-xs py-1.5">Inserir modelo</button>
          )}
          {waNumero && (
            <a
              href={`https://wa.me/${waNumero}${texto.trim() ? `?text=${encodeURIComponent(texto)}` : ""}`}
              target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-xs py-1.5 inline-flex items-center gap-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Abrir no WhatsApp
            </a>
          )}
        </div>
        <p className="text-[11px] text-text-muted">Responde pelo WhatsApp do telemóvel — o texto vai já escrito.</p>
      </div>
    </div>
  );
}
