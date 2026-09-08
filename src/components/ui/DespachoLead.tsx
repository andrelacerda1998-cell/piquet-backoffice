"use client";

import { useEffect, useState } from "react";
import { getVendors, type RealVendor } from "@/services/vendorsService";
import { getLeadDispatches, dispatchLead, assignLead } from "@/services/extrasService";
import { resumirDifusoes, type Difusao } from "@/lib/despacho";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Radio, Check, X, AlertCircle, Clock, UserCheck } from "lucide-react";

/**
 * Levar um pedido à comunidade de técnicos e escolher quem vai.
 *
 * O ciclo é: perguntar a vários ao mesmo tempo → esperar quem pode → escolher.
 * A escolha é de quem despacha, não do relógio: numa rede pequena, o primeiro a
 * responder é quem tinha o telemóvel na mão, não necessariamente quem está mais
 * perto ou trabalha melhor.
 */

const ESTADOS: Record<Difusao["status"], { rotulo: string; classe: string; Icone: typeof Check }> = {
  enviado: { rotulo: "À espera", classe: "text-text-muted", Icone: Clock },
  aceite: { rotulo: "Aceitou", classe: "text-success", Icone: Check },
  recusado: { rotulo: "Recusou", classe: "text-text-muted", Icone: X },
  falhou: { rotulo: "Não chegou", classe: "text-danger", Icone: AlertCircle },
};

export function DespachoLead({ leadId, cidade }: { leadId: string; cidade?: string }) {
  const [difusoes, setDifusoes] = useState<Difusao[]>([]);
  const [tecnicos, setTecnicos] = useState<RealVendor[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [aEnviar, setAEnviar] = useState(false);
  const [aAtribuir, setAAtribuir] = useState("");
  const [aAbrir, setAAbrir] = useState(false);

  const carregar = () => { getLeadDispatches(leadId).then((r) => setDifusoes(r.dispatches)).catch(() => {}); };
  useEffect(carregar, [leadId]);

  /*
    A lista só é lida quando se abre o selector. São 500 técnicos vindos do
    Laravel -- carregá-los ao abrir cada lead era pagar esse pedido em todas as
    leads, incluindo as que ninguém vai despachar.
  */
  const abrirSelector = async () => {
    setAAbrir(true);
    if (tecnicos.length === 0) {
      try {
        const r = await getVendors(1, 500);
        setTecnicos(r.data);
      } catch {
        toast("Não foi possível ler a lista de técnicos.", "error");
        setAAbrir(false);
      }
    }
  };

  const jaPerguntados = new Set(difusoes.map((d) => d.technicianId));

  /*
    Quem pode receber o pedido: sem suspensão, com telefone e apto a aceitar
    serviço. Perguntar a quem não pode aceitar gasta a paciência do técnico e
    uma mensagem paga.
  */
  const candidatos = tecnicos
    .filter((t) => t.can_accept_service && !t.suspended_at && (t.phone_number || "").trim())
    .filter((t) => !jaPerguntados.has(String(t.id)))
    .sort((a, b) => {
      // Os da cidade do pedido primeiro — é o sinal de proximidade que a lista
      // do Laravel dá hoje (as zonas de operação são texto livre).
      const c = (cidade || "").toLowerCase().trim();
      const perto = (t: RealVendor) =>
        c && t.operation_areas.some((z) => z.toLowerCase().includes(c)) ? 0 : 1;
      return perto(a) - perto(b) || (a.name || "").localeCompare(b.name || "");
    });

  const alternar = (id: string) => {
    setEscolhidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const enviar = async () => {
    setAEnviar(true);
    try {
      const r = await dispatchLead(leadId, [...escolhidos]);
      const partes = [`${r.enviadas} técnico(s) contactado(s)`];
      if (r.falhadas) partes.push(`${r.falhadas} não recebeu`);
      if (r.semTelefone.length) partes.push(`${r.semTelefone.length} sem telefone`);
      toast(partes.join(" · "));
      setEscolhidos(new Set());
      setAAbrir(false);
      carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível enviar o pedido.", "error");
    } finally {
      setAEnviar(false);
    }
  };

  const atribuir = async (d: Difusao) => {
    setAAtribuir(d.technicianId);
    try {
      const r = await assignLead(leadId, d.technicianId);
      toast(`Serviço atribuído a ${r.technicianName}.` +
        (r.avisos.length ? ` ${r.avisos.length} aviso(s) por WhatsApp falharam.` : ""));
      carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível atribuir.", "error");
    } finally {
      setAAtribuir("");
    }
  };

  const r = resumirDifusoes(difusoes);

  return (
    <div className="rounded-xl border border-surface-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-surface-border bg-surface-muted/50">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted inline-flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-piquet" /> Técnicos
        </span>
        {difusoes.length > 0 && (
          <span className="text-[11px] text-text-muted tabular-nums">
            {r.aceites} aceitaram · {r.porResponder} por responder
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {difusoes.length === 0 && !aAbrir && (
          <p className="text-sm text-text-secondary">
            Ninguém foi perguntado sobre este pedido.
          </p>
        )}

        {/* Quem já foi perguntado. Os que aceitaram primeiro: são a decisão. */}
        {difusoes.length > 0 && (
          <ul className="space-y-1.5">
            {[...difusoes]
              .sort((a, b) => (a.status === "aceite" ? 0 : 1) - (b.status === "aceite" ? 0 : 1))
              .map((d) => {
                const e = ESTADOS[d.status];
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex items-center gap-2">
                      <e.Icone className={cn("h-3.5 w-3.5 shrink-0", e.classe)} />
                      <span className="truncate text-text-primary">{d.technicianName || d.technicianId}</span>
                      <span className={cn("text-[11px] shrink-0", e.classe)}>{e.rotulo}</span>
                    </span>
                    {d.status === "aceite" && (
                      <button
                        onClick={() => atribuir(d)}
                        disabled={aAtribuir !== ""}
                        className="btn-primary text-[11px] py-1 px-2 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        <UserCheck className="h-3 w-3" />
                        {aAtribuir === d.technicianId ? "A atribuir…" : "É este"}
                      </button>
                    )}
                    {d.status === "falhou" && d.error && (
                      <span className="text-[11px] text-danger truncate max-w-[45%]" title={d.error}>{d.error}</span>
                    )}
                  </li>
                );
              })}
          </ul>
        )}

        {!aAbrir ? (
          <button onClick={abrirSelector} className="btn-secondary text-xs py-1.5">
            {difusoes.length === 0 ? "Enviar a técnicos" : "Enviar a mais técnicos"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="max-h-48 overflow-y-auto rounded-lg border border-surface-border divide-y divide-surface-border/60">
              {candidatos.length === 0 ? (
                <p className="text-sm text-text-muted p-3">
                  Não há técnicos disponíveis por perguntar. Só aparecem os que podem aceitar
                  serviço, não estão suspensos e têm telefone registado.
                </p>
              ) : candidatos.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-muted/40">
                  <input
                    type="checkbox"
                    checked={escolhidos.has(String(t.id))}
                    onChange={() => alternar(String(t.id))}
                    className="accent-piquet"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">{t.name || `#${t.id}`}</span>
                    {t.operation_areas.length > 0 && (
                      <span className="block truncate text-[11px] text-text-muted">
                        {t.operation_areas.join(" · ")}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={enviar}
                disabled={aEnviar || escolhidos.size === 0}
                className="btn-primary text-xs py-1.5 disabled:opacity-50"
              >
                {aEnviar ? "A enviar…" : `Enviar a ${escolhidos.size || ""} ${escolhidos.size === 1 ? "técnico" : "técnicos"}`.trim()}
              </button>
              <button onClick={() => { setAAbrir(false); setEscolhidos(new Set()); }} className="btn-secondary text-xs py-1.5">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
