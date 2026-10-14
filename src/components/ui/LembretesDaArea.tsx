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
    <section aria-label="Lembretes" className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-border">
        <BellRing className="h-4 w-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">Lembretes</h2>
        <span className="rounded-md bg-surface-subtle px-1.5 py-px text-xs font-semibold tabular-nums text-text-secondary">{lembretes.length}</span>
      </div>
      <ul className="divide-y divide-surface-border">
        {lembretes.map((a) => {
          const d = destinoDoAlerta(a);
          return (
            <li key={a.id} className="group px-4 py-3 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", a.priority === "critica" ? "bg-danger" : "bg-warning")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                <p className="text-[13px] text-text-muted truncate">{a.description}</p>
              </div>
              <div className="ml-5 sm:ml-0 flex items-center gap-1 shrink-0">
                <button onClick={() => adiar(a.id)} disabled={aAdiar === a.id} className="btn-ghost text-xs px-2 py-1 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100">
                  Adiar
                </button>
                <Link href={d.href} className="btn-secondary py-1 px-2.5 text-[13px]">
                  {d.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
