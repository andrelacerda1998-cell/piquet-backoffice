"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Share, Loader2 } from "lucide-react";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import {
  estadoAtual, registarWorker, ligarNotificacoes, desligarNotificacoes,
  ehIOS, type EstadoPush,
} from "@/lib/pushCliente";

/**
 * Ligar e desligar as notificações neste dispositivo.
 *
 * "Neste dispositivo" é literal: cada telemóvel ou computador tem a sua
 * subscrição, e ligar no portátil não liga no telemóvel. É por isso que o
 * texto diz sempre "neste dispositivo" em vez de "a tua conta".
 */
export function Notificacoes() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [aTrabalhar, setATrabalhar] = useState(false);
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    registarWorker().then(() => estadoAtual().then(setEstado));
  }, []);

  if (estado === null) return null;

  if (!chave) {
    return (
      <Caixa tom="aviso" titulo="As notificações ainda não estão configuradas">
        Falta a chave pública VAPID (<code className="text-[11px]">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>) nas variáveis
        de ambiente da Vercel.
      </Caixa>
    );
  }

  /*
    No iOS o Web Push só existe com a página instalada no ecrã inicial. No
    Safari normal a API nem aparece — e dizer "o teu browser não suporta"
    seria falso: suporta, falta é instalar. As instruções são as do iOS
    porque é onde isto tropeça.
  */
  if (estado === "precisa_instalar") {
    return (
      <Caixa tom="info" titulo="Instala primeiro no ecrã inicial">
        No iPhone, as notificações só funcionam com a Piquet instalada. No Safari, toca em{" "}
        <Share className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Partilhar</strong> e depois em{" "}
        <strong>Adicionar ao ecrã principal</strong>. Depois abre a Piquet por esse ícone e volta aqui.
      </Caixa>
    );
  }

  if (estado === "indisponivel") {
    return (
      <Caixa tom="info" titulo="Este dispositivo não recebe notificações">
        O browser não tem suporte para notificações push. Num telemóvel {ehIOS() ? "com iOS 16.4 ou mais recente" : "Android com Chrome"} funciona.
      </Caixa>
    );
  }

  if (estado === "recusado") {
    return (
      <Caixa tom="aviso" titulo="As notificações estão bloqueadas">
        Foram recusadas neste dispositivo, e o site não as pode voltar a pedir. Reativa-as nas definições do browser
        para a Piquet e recarrega a página.
      </Caixa>
    );
  }

  const ligado = estado === "ligado";

  const alternar = async () => {
    setATrabalhar(true);
    try {
      const novo = ligado ? await desligarNotificacoes() : await ligarNotificacoes(chave);
      setEstado(novo);
      if (novo === "ligado") toast("Notificações ligadas neste dispositivo.", "success");
      else if (ligado) toast("Notificações desligadas neste dispositivo.", "info");
      else if (novo === "recusado") toast("Autorização recusada.", "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível mudar as notificações.", "error");
    } finally {
      setATrabalhar(false);
    }
  };

  const testar = async () => {
    setATrabalhar(true);
    try {
      const { currentToken } = await import("@/services/api");
      const token = await currentToken();
      const r = await fetch("/api/push/test", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error ?? "O envio falhou.");
      toast(
        j?.data?.enviados > 0
          ? `Enviado para ${j.data.enviados} dispositivo(s). Se não aparecer, a culpa é do sistema e não do ecrã.`
          : "Nenhum dispositivo registado ainda.",
        j?.data?.enviados > 0 ? "success" : "info",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "O envio falhou.", "error");
    } finally {
      setATrabalhar(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={alternar} disabled={aTrabalhar} className={cn("btn-secondary text-sm inline-flex items-center gap-2 disabled:opacity-60")}>
        {aTrabalhar ? <Loader2 className="h-4 w-4 animate-spin" /> : ligado ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        {ligado ? "Desligar notificações" : "Ligar notificações"}
      </button>

      {ligado && (
        <button onClick={testar} disabled={aTrabalhar} className="text-sm text-piquet-700 hover:underline disabled:opacity-60">
          Enviar um teste
        </button>
      )}

      <p className="text-xs text-text-secondary w-full">
        {ligado
          ? "Este dispositivo recebe avisos de pedidos urgentes, faltas de técnicos e tickets novos."
          : "Ligadas, avisam-te quando alguém fica à espera — sem teres de abrir o backoffice."}{" "}
        A escolha é por dispositivo: ligar no telemóvel não liga no computador.
      </p>
    </div>
  );
}

function Caixa({ tom, titulo, children }: { tom: "info" | "aviso"; titulo: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border-l-[3px] px-3 py-2", tom === "aviso" ? "border-l-warning bg-warning-light/30" : "border-l-piquet bg-surface-subtle")}>
      <p className={cn("text-sm font-semibold", tom === "aviso" ? "text-warning" : "text-text-primary")}>{titulo}</p>
      <p className="text-xs text-text-secondary mt-0.5">{children}</p>
    </div>
  );
}
