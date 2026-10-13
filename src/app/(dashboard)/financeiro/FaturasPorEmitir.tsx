"use client";

import { useMemo, useState } from "react";
import { FileClock } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { useAuthStore, toast } from "@/stores";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { porTecnico, SITUACAO } from "@/lib/faturasPorEmitir";
import { emitirFaturasAgora, getFaturasPorEmitir } from "@/services/vendorPaymentsService";

/**
 * Faturas que ficaram por emitir (backend#176).
 *
 * Desde 13/10/2026 só se paga um serviço depois de a fatura dele sair, por
 * isso esta lista é também a resposta a "porque é que este técnico ainda não
 * recebeu?". Cada linha diz o que falta à fatura e de quem é a vez. As que já
 * podem sair saem sozinhas às 06:20; o "Emitir agora" não espera por isso.
 *
 * Vazia, não aparece: não haver faturas em atraso é o normal.
 */
export function FaturasPorEmitir({ recarregarSaldos }: { recarregarSaldos: () => void }) {
  const user = useAuthStore((s) => s.user);
  const podeEmitir = !!user && hasPermission(user.role, "pay_technicians");
  const { data, refetch } = useAsyncData(() => getFaturasPorEmitir(), []);
  const grupos = useMemo(() => porTecnico(data?.items ?? []), [data]);
  const [ocupado, setOcupado] = useState<number | null>(null);

  if (!data || data.ativo === false || grupos.length === 0) return null;

  const emitir = async (vendorId: number, nome: string) => {
    setOcupado(vendorId);
    try {
      const r = await emitirFaturasAgora(vendorId);
      toast(`${r.por_emitir} ${r.por_emitir === 1 ? "fatura posta" : "faturas postas"} na fila para ${nome}. Saem uma a uma; atualiza daqui a um minuto.`);
      refetch();
      recarregarSaldos();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível.", "error");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Faturas por emitir · {data.total}</h2>
          <p className="text-xs text-text-secondary">
            O dinheiro destes serviços só se paga depois de a fatura sair. As que já podem sair saem sozinhas às 06:20.
          </p>
        </div>
        <button className="btn-secondary text-xs py-1" onClick={refetch}>Atualizar</button>
      </div>

      <div className="card divide-y divide-surface-border">
        {grupos.map((g) => {
          const nome = g.vendor_name ?? `Técnico ${g.vendor_id}`;
          return (
            <div key={g.vendor_id} className="px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <FileClock className="h-4 w-4 text-warning shrink-0" />
                <span className="font-medium text-text-primary min-w-0 truncate">{nome}</span>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {g.itens.length} {g.itens.length === 1 ? "serviço" : "serviços"} · {formatCurrency(g.paraOTecnico)} para o técnico
                </span>
                {podeEmitir && g.podeEmitir && (
                  <button className="btn-primary text-xs py-1 ml-auto" disabled={ocupado === g.vendor_id}
                    onClick={() => emitir(g.vendor_id, nome)}>
                    {ocupado === g.vendor_id ? "A pôr na fila…" : "Emitir agora"}
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-xs">
                {g.itens.map((i) => (
                  <li key={i.service_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="text-text-secondary">#{i.service_id} · {i.service_type ?? "Serviço"}</span>
                    <span className="tabular-nums text-text-primary">{formatCurrency(i.amount)}</span>
                    <span className={cn("whitespace-nowrap", i.dias_em_atraso > 5 ? "text-danger" : "text-text-muted")}>
                      há {i.dias_em_atraso} {i.dias_em_atraso === 1 ? "dia" : "dias"}
                    </span>
                    <span className={cn("sm:ml-auto", SITUACAO[i.situacao]?.deQuem === "tecnico" ? "text-text-muted" : "text-warning")}>
                      {SITUACAO[i.situacao]?.texto ?? i.situacao}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
