"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, toast } from "@/stores";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/formatters";
import { getEstadoDaConversa, lerConversa } from "@/services/dashboardService";
import {
  MOTIVO_MINIMO_DA_CONVERSA, type EstadoDaConversa, type MensagemDaConversa,
} from "@/lib/conversaEmDisputa";

const QUEM: Record<MensagemDaConversa["de"], string> = { cliente: "Cliente", tecnico: "Técnico", outro: "Outra pessoa" };

/**
 * A conversa entre o cliente e o técnico deste pedido, só para resolver uma
 * reclamação ou uma disputa (ver src/lib/conversaEmDisputa.ts).
 *
 * Não se abre sozinha: escolhe-se o caso que a justifica e escreve-se o
 * motivo, que fica no histórico do pedido em nome de quem leu. As mensagens
 * vivem só neste painel, enquanto está aberto: não se guardam em lado nenhum
 * do browser.
 */
export function ConversaDoPedido({ servicoId, tecnico }: { servicoId: string; tecnico: string | null }) {
  const role = useAuthStore((s) => s.user?.role);
  const pode = !!role && hasPermission(role, "view_support") && hasPermission(role, "view_personal_data");
  const [estado, setEstado] = useState<EstadoDaConversa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [caso, setCaso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aLer, setALer] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemDaConversa[] | null>(null);
  const [lidaPara, setLidaPara] = useState("");

  useEffect(() => {
    if (!pode || !tecnico) return;
    let vivo = true;
    setErro(null);
    getEstadoDaConversa(servicoId)
      .then((e) => {
        if (!vivo) return;
        setEstado(e);
        setCaso((c) => (e.casos.some((x) => x.id === c) ? c : e.casos[0]?.id ?? ""));
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível ver os casos deste pedido."));
    return () => { vivo = false; };
  }, [servicoId, pode, tecnico, versao]);

  if (!tecnico) {
    return <p className="text-sm text-text-secondary">Só existe depois de haver técnico atribuído: sem segunda pessoa não há conversa. Este pedido ainda não tem técnico.</p>;
  }

  if (!pode) {
    return (
      <p className="text-sm text-text-secondary">
        A conversa é entre o cliente e <strong className="text-text-primary">{tecnico}</strong>, nas apps. Só o Suporte e as Operações a
        podem ler, e só para resolver uma reclamação ou disputa deste pedido.
      </p>
    );
  }

  if (erro) return <p className="text-sm text-danger">{erro}</p>;
  if (!estado) return <p className="text-sm text-text-muted">A carregar…</p>;

  const motivoCurto = motivo.trim().replace(/\s+/g, " ").length < MOTIVO_MINIMO_DA_CONVERSA;

  const ler = async () => {
    if (!caso || motivoCurto) return;
    setALer(true);
    try {
      setMensagens(await lerConversa(servicoId, caso, motivo.trim()));
      setLidaPara(estado.casos.find((c) => c.id === caso)?.rotulo ?? caso);
      setMotivo("");
      setVersao((v) => v + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível ler a conversa.", "error");
    } finally {
      setALer(false);
    }
  };

  return (
    <div className="space-y-3">
      {mensagens ? (
        <Mensagens mensagens={mensagens} caso={lidaPara} onFechar={() => setMensagens(null)} />
      ) : !estado.ligado ? (
        <div className="rounded-xl bg-surface-subtle px-4 py-3">
          <p className="text-sm font-medium text-text-primary inline-flex items-center gap-2">
            <Lock className="h-4 w-4 text-text-muted" /> Leitura preparada, ainda desligada
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            As Políticas de Privacidade ainda não dizem que a equipa pode ler estas conversas. Liga-se quando as versões novas
            estiverem em vigor.{estado.mensagens > 0 && <> Este pedido tem {estado.mensagens} mensage{estado.mensagens === 1 ? "m" : "ns"}.</>}
          </p>
        </div>
      ) : estado.mensagens === 0 ? (
        <p className="text-sm text-text-secondary">O cliente e {tecnico} não trocaram mensagens neste pedido.</p>
      ) : estado.casos.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">
            Só se lê para resolver uma reclamação ou disputa deste pedido: um ticket por resolver, um problema reportado na app ou
            uma falta do técnico. Este pedido não tem nenhum.
          </p>
          <p className="text-xs text-text-muted">Se o cliente reclamou por telefone, abre primeiro um ticket ligado ao pedido.</p>
          <button onClick={() => setVersao((v) => v + 1)} className="btn-secondary text-xs py-1.5">Verificar outra vez</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            {estado.mensagens} mensage{estado.mensagens === 1 ? "m" : "ns"} entre o cliente e <strong className="text-text-primary">{tecnico}</strong>.
            Lê-se só para resolver o caso, e fica registado com o teu nome.
          </p>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-text-secondary mb-1">Para que caso</legend>
            {estado.casos.map((c) => (
              <label key={c.id} className="flex items-start gap-2 text-sm text-text-primary">
                <input type="radio" name={`caso-${servicoId}`} value={c.id} checked={caso === c.id} onChange={() => setCaso(c.id)} className="mt-1" />
                <span className="min-w-0 break-words">{c.rotulo}</span>
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Porque precisas de a ler</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ex.: o cliente diz que o técnico combinou 60 € no chat e cobrou 90 €."
              className="input-field mt-1 w-full"
            />
          </label>
          <button onClick={ler} disabled={!caso || motivoCurto || aLer} className="btn-primary text-sm disabled:opacity-40">
            {aLer ? "A ler…" : "Ler a conversa"}
          </button>
        </div>
      )}

      {estado.leituras.length > 0 && (
        <div className="border-t border-surface-border pt-2">
          <p className="text-xs font-medium text-text-secondary">Já lida</p>
          <ul className="mt-1 space-y-1">
            {estado.leituras.map((l) => (
              <li key={`${l.em}-${l.por}`} className="text-xs text-text-muted break-words">
                {formatDateTime(l.em)} · {l.por ?? "—"}{l.motivo ? ` · ${l.motivo}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Mensagens({ mensagens, caso, onFechar }: { mensagens: MensagemDaConversa[]; caso: string; onFechar: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted min-w-0 break-words">Lida para: {caso}. Ficou registado com o teu nome.</p>
        <button onClick={onFechar} className="btn-secondary text-xs py-1 shrink-0">Fechar</button>
      </div>
      {mensagens.length === 0 ? (
        <p className="text-sm text-text-muted">Sem mensagens.</p>
      ) : (
        <ol className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {mensagens.map((m) => (
            <li key={m.id} className={cn("flex", m.de === "tecnico" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-xl px-3 py-2",
                m.de === "tecnico" ? "bg-piquet/15" : "bg-surface-subtle",
              )}>
                <p className="text-[11px] text-text-muted">
                  {QUEM[m.de]}{m.enviada_em ? ` · ${formatDateTime(m.enviada_em)}` : ""}
                </p>
                {m.texto === null
                  ? <p className="text-sm italic text-text-muted">Esta mensagem não se conseguiu decifrar.</p>
                  : <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{m.texto}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
