"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts, adiarAlerta, amanhaAsNove } from "@/services/supportService";
import { destinoDoAlerta } from "@/lib/alertLinks";
import { rotaDoAlerta } from "@/lib/navBadges";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";

/**
 * Os lembretes de gestão de uma área: faturas vencidas e impostos no
 * Financeiro, anúncios parados no Marketing.
 *
 * Saíram da fila "Precisa de ti" (auditoria de 08/10/2026): a fila é para o
 * que alguém tem de fazer hoje na operação; uma fatura de fornecedor em atraso
 * resolve-se quando se abre o Financeiro, e é aí que aparece.
 */
export function LembretesDaArea({ rota }: { rota: "/financeiro" | "/crescimento" }) {
  const { data, refetch } = useAsyncData(() => getAlerts(1, 200).catch(() => null), []);
  const [aAdiar, setAAdiar] = useState<string | null>(null);
  const lembretes = (data?.lembretes ?? []).filter((a) => rotaDoAlerta(a) === rota);
  if (lembretes.length === 0) return null;

  const adiar = async (id: string) => {
    setAAdiar(id);
    try { await adiarAlerta(id, amanhaAsNove()); toast("Adiado para amanhã às 9:00."); refetch(); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível adiar.", "error"); }
    finally { setAAdiar(null); }
  };

  return (
    <section aria-label="Lembretes" className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted inline-flex items-center gap-1.5">
        <BellRing className="h-3.5 w-3.5" /> Lembretes
      </p>
      <ul className="space-y-2">
        {lembretes.map((a) => {
          const d = destinoDoAlerta(a);
          return (
            <li key={a.id} className={cn("card border-l-[3px] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2",
              a.priority === "critica" ? "border-l-danger" : "border-l-warning")}>
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-medium text-text-primary">{a.title}</p>
                <p className="text-sm text-text-secondary truncate">{a.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => adiar(a.id)} disabled={aAdiar === a.id} className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50">
                  Adiar
                </button>
                <Link href={d.href} className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1">
                  {d.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
