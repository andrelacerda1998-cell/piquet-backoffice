"use client";

import { useEffect, useRef, useState } from "react";
import { getLeadMessages, sendLeadMessage, sendLeadTemplate, type WaMensagem, type Conversa } from "@/services/extrasService";
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

export function WhatsappConversa({ leadId, temTelefone, modelo, waNumero, onEntradas }: {
  leadId: string;
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
  const [aEnviar, setAEnviar] = useState(false);
  const [aConfirmar, setAConfirmar] = useState(false);
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

  const reportar = useRef(onEntradas);
  reportar.current = onEntradas;
  useEffect(() => {
    if (carregando) return;
    reportar.current?.((conversa?.messages ?? []).filter((m) => m.direction === "in").length);
  }, [conversa, carregando]);

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

  /*
    A confirmação por modelo -- o único envio que a Meta deixa passar fora das
    24h, e o que reabre a conversa. Existe aqui para o caso em que o envio
    automático não chegou ao cliente: sem isto, a única saída era escrever do
    telemóvel pessoal e o backoffice ficava sem registo nenhum disso.
  */
  const enviarConfirmacao = async () => {
    setAConfirmar(true);
    try {
      const nova = await sendLeadTemplate(leadId);
      setConversa((c) => c ? { ...c, messages: [...c.messages, nova], windowOpen: true } : c);
      toast("Confirmação enviada. A conversa fica aberta 24h para responderes em texto livre.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível enviar a confirmação.", "error");
    } finally {
      setAConfirmar(false);
    }
  };

  if (!temTelefone) return null;

  const msgs = conversa?.messages ?? [];
  const podeEnviar = Boolean(conversa?.configured && conversa?.windowOpen);

  // A nota por baixo do campo, conforme o que impede (ou não) o envio livre
  // pela app. Distingue "o cliente nunca escreveu" (janela nunca abriu) de
  // "já passaram 24h desde a última mensagem" — são situações diferentes.
  const temEntrada = msgs.some((m) => m.direction === "in");
  const nota =
    !conversa?.configured
      ? "O WhatsApp ainda não está ligado — assim que as chaves da Meta estiverem na Vercel, respondes daqui."
      : conversa?.windowOpen
        ? ""
        : temEntrada
          ? "Passaram mais de 24h desde a última mensagem do cliente. Manda a confirmação para reabrir a conversa."
          : "Este contacto ainda não escreveu pelo WhatsApp. Manda a confirmação para abrir a conversa — depois disso podes responder por aqui.";

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
      <div className="border-t border-surface-border p-2 bg-surface-muted/30 space-y-2 shrink-0">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && podeEnviar) { e.preventDefault(); enviar(); } }}
          rows={4}
          placeholder="Escreve a resposta…"
          className="input-field resize-y text-sm w-full"
        />
        <div className="flex flex-wrap items-center gap-2">
          {modelo && (
            <button onClick={() => setTexto(modelo)} className="btn-secondary text-xs py-1.5">Inserir modelo</button>
          )}
          {!podeEnviar && conversa?.configured && (
            <button
              onClick={enviarConfirmacao}
              disabled={aConfirmar}
              className="btn-primary text-xs py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Envia o modelo aprovado pela Meta — reabre a conversa por 24h"
            >
              <Send className="h-3.5 w-3.5" /> {aConfirmar ? "A enviar…" : "Enviar confirmação"}
            </button>
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
              className="btn-secondary text-xs py-1.5 inline-flex items-center gap-1.5"
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
