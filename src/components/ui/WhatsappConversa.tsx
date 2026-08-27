"use client";

import { useEffect, useRef, useState } from "react";
import { getLeadMessages, sendLeadMessage, type WaMensagem, type Conversa } from "@/services/extrasService";
import { formatDateTime } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Send, Check, CheckCheck, AlertCircle, MessageCircle } from "lucide-react";

/**
 * Conversa de WhatsApp de uma lead — ler o histórico e responder.
 *
 * Vive dentro do detalhe do pedido: abre-se a lead, vê-se tudo o que o cliente
 * escreveu e responde-se dali. As mensagens de entrada vêm do webhook; o envio
 * só funciona quando as chaves da Meta estiverem na Vercel — até lá, o campo de
 * resposta fica desativado e diz porquê, em vez de deixar escrever para o nada.
 */

/** Ícone de estado das NOSSAS mensagens — o mesmo vocabulário do WhatsApp. */
function EstadoMsg({ status }: { status: string }) {
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-danger" aria-label="Falhou" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-info" aria-label="Lida" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-text-muted" aria-label="Entregue" />;
  return <Check className="h-3 w-3 text-text-muted" aria-label="Enviada" />;
}

export function WhatsappConversa({ leadId, temTelefone, modelo, waNumero }: {
  leadId: string;
  temTelefone: boolean;
  /** Mensagem-modelo pré-preenchida (nome/serviço/localização) para inserir. */
  modelo?: string;
  /** Número (só dígitos, com indicativo) para o link wa.me de recurso. */
  waNumero?: string;
}) {
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    getLeadMessages(leadId)
      .then((c) => { if (vivo) setConversa(c); })
      .catch(() => { if (vivo) setConversa({ messages: [], configured: false, windowOpen: false, migrated: false }); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [leadId]);

  // Rola para a última mensagem sempre que a conversa muda.
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "nearest" }); }, [conversa?.messages.length]);

  const enviar = async () => {
    const corpo = texto.trim();
    if (!corpo || aEnviar) return;
    setAEnviar(true);
    try {
      const nova: WaMensagem = await sendLeadMessage(leadId, corpo);
      setConversa((c) => c ? { ...c, messages: [...c.messages, nova] } : c);
      setTexto("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível enviar.", "error");
    } finally {
      setAEnviar(false);
    }
  };

  if (!temTelefone) return null;

  const msgs = conversa?.messages ?? [];
  const podeEnviar = Boolean(conversa?.configured && conversa?.windowOpen);

  // A nota por baixo do campo, conforme o que impede (ou não) o envio.
  const nota =
    !conversa?.configured
      ? "O WhatsApp ainda não está ligado — assim que as chaves da Meta estiverem na Vercel, respondes daqui."
      : !conversa?.windowOpen
        ? "Passaram mais de 24h desde a última mensagem do cliente. O WhatsApp só permite reabrir com uma mensagem-modelo aprovada pela Meta."
        : "";

  return (
    <div className="rounded-xl border border-surface-border overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border bg-surface-muted/50">
        <MessageCircle className="h-4 w-4 text-success" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Conversa de WhatsApp</span>
      </div>

      {/* Histórico */}
      <div className="max-h-72 overflow-y-auto px-3 py-3 space-y-2 bg-surface">
        {carregando ? (
          <p className="text-sm text-text-muted text-center py-4">A carregar conversa…</p>
        ) : msgs.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">
            {conversa?.migrated
              ? "Sem mensagens de WhatsApp neste contacto."
              : "A conversa aparece aqui assim que o WhatsApp estiver ligado."}
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

      {/* Composer — um único sítio para responder. O campo está sempre
          editável (para compor/copiar mesmo com a janela fechada); o envio
          pela app só quando dá, e há sempre o "Abrir no WhatsApp" como
          alternativa. */}
      <div className="border-t border-surface-border p-2 bg-surface-muted/30 space-y-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && podeEnviar) { e.preventDefault(); enviar(); } }}
          rows={3}
          placeholder="Escreve a resposta…"
          className="input-field resize-y text-sm w-full"
        />
        <div className="flex flex-wrap items-center gap-2">
          {modelo && (
            <button onClick={() => setTexto(modelo)} className="btn-secondary text-xs py-1.5">Inserir modelo</button>
          )}
          {podeEnviar && (
            <button
              onClick={enviar}
              disabled={aEnviar || !texto.trim()}
              className="btn-primary text-xs py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Enviar pelo WhatsApp (⌘/Ctrl + Enter)"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </button>
          )}
          {waNumero && (
            <a
              href={`https://wa.me/${waNumero}${texto.trim() ? `?text=${encodeURIComponent(texto)}` : ""}`}
              target="_blank" rel="noopener noreferrer"
              className={cn("text-xs py-1.5 inline-flex items-center gap-1.5", podeEnviar ? "btn-secondary" : "btn-primary")}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Abrir no WhatsApp
            </a>
          )}
        </div>
        {nota && <p className="text-[11px] text-text-muted">{nota}</p>}
      </div>
    </div>
  );
}
