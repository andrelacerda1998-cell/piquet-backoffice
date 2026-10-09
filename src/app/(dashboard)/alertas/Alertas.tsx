"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bell, ArrowRight, CheckCircle2, RefreshCw, Clock, Undo2 } from "lucide-react";
import { PriorityBadge, AlertTypeBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAlerts, adiarAlerta, reporAlerta, type AlertaAdiado } from "@/services/supportService";
import { formatDateTime, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AlertPriority } from "@/types";
import { destinoDoAlerta as destino } from "@/lib/alertLinks";

/**
 * Alertas DERIVADOS do estado real do negócio.
 *
 * O ecrã anterior tinha estados ("Analisar", "Resolver") que não gravavam
 * nada: a lista vinha de `mockData.alerts` em memória e voltava ao início a
 * cada recarregamento. Dava a sensação de haver vigilância a acontecer.
 *
 * Um alerta destes não se "resolve" aqui — resolve-se resolvendo a causa. Por
 * isso a única ação é ir ao ecrã onde isso se faz, e o alerta desaparece
 * sozinho quando o motivo deixar de existir.
 */

/**
 * Os títulos dizem o que fazer, não o "nível" do alerta. A regra por trás é
 * quem tem a bola: o que se resolve do nosso lado pode ser urgente; o que
 * depende de terceiros (um cliente que ainda não decidiu) é acompanhamento,
 * por muito tempo que leve.
 */
const GRUPOS: Array<{ p: AlertPriority; titulo: string; nota: string }> = [
  { p: "critica", titulo: "Resolver hoje", nota: "Parado há demasiado tempo, ou com prazo legal ultrapassado" },
  { p: "alta", titulo: "Tratar esta semana", nota: "Está à nossa espera" },
  { p: "media", titulo: "A acompanhar", nota: "Depende de terceiros ou não bloqueia nada" },
  { p: "baixa", titulo: "Informativo", nota: "" },
];

/**
 * Prazos de adiamento. Poucos e concretos: um seletor de data para cada alerta
 * seria mais flexível e muito mais lento de usar — o que se quer aqui é tirar
 * a linha da frente em um clique.
 */
const PRAZOS: Array<{ label: string; dias: number }> = [
  { label: "Amanhã", dias: 1 },
  { label: "3 dias", dias: 3 },
  { label: "1 semana", dias: 7 },
  { label: "1 mês", dias: 30 },
];

/**
 * `embutido`: dentro do separador da Visão Geral, sem o cabeçalho de página
 * (a Visão Geral já tem o dela) -- fica só a frase e o "Verificar agora".
 * `onTotal` diz à Visão Geral quantos há, para o número no separador.
 */
export default function AlertasPage({ embutido = false, onTotal }: { embutido?: boolean; onTotal?: (n: number) => void } = {}) {
  const { data, loading, refetch } = useAsyncData(() => getAlerts(1, 200), []);
  const alertas = useMemo(() => data?.data ?? [], [data]);
  useEffect(() => { if (data) onTotal?.(alertas.length); }, [data, alertas.length, onTotal]);
  const adiados = (data as unknown as { adiados?: AlertaAdiado[] })?.adiados ?? [];
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [verAdiados, setVerAdiados] = useState(false);
  const [aGravar, setAGravar] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const adiar = async (id: string, dias: number) => {
    setAGravar(id); setErro(""); setMenuAberto(null);
    const until = new Date(Date.now() + dias * 86_400_000).toISOString();
    try { await adiarAlerta(id, until); await refetch(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível adiar."); }
    finally { setAGravar(null); }
  };

  const repor = async (id: string) => {
    setAGravar(id); setErro("");
    try { await reporAlerta(id); await refetch(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível repor."); }
    finally { setAGravar(null); }
  };
  const fontesEmFalta = (data as unknown as { fontesIndisponiveis?: string[] })?.fontesIndisponiveis ?? [];

  const porGrupo = useMemo(
    () => GRUPOS.map((g) => ({ ...g, itens: alertas.filter((a) => a.priority === g.p) }))
      .filter((g) => g.itens.length > 0),
    [alertas],
  );

  return (
    <RouteGuard route="/alertas">
      <div className="space-y-6">
        {embutido ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              Tudo o que precisa de ação, apurado a partir dos dados reais do negócio. A fila do Resumo mostra os seis mais urgentes.
            </p>
            <button onClick={refetch} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Verificar agora
            </button>
          </div>
        ) : (
          <PageHeader
            icon={Bell}
            eyebrow="Operação"
            title="Alertas"
            subtitle="O que precisa de ação, apurado a partir dos dados reais do negócio"
            actions={
              <button onClick={refetch} className="btn-secondary inline-flex items-center gap-2">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Verificar agora
              </button>
            }
          />
        )}

        {fontesEmFalta.length > 0 && (
          <div className="rounded-xl border-l-[3px] border-l-warning bg-warning-light/40 px-4 py-3 text-sm">
            <p className="font-medium text-text-primary">Verificação incompleta</p>
            <p className="text-text-secondary">
              Não foi possível consultar: {fontesEmFalta.join(", ")}. Podem existir alertas por mostrar.
            </p>
          </div>
        )}

        {loading && alertas.length === 0 && (
          <p className="text-sm text-text-muted py-10 text-center">A verificar…</p>
        )}

        {!loading && alertas.length === 0 && (
          <div className="card p-10 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-3" />
            <p className="font-semibold text-text-primary">Nada a assinalar</p>
            <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
              Sem leads por responder, integrações paradas, tickets sem resposta ou fila de
              documentos acumulada. Esta página só mostra alguma coisa quando há mesmo.
            </p>
          </div>
        )}

        {porGrupo.map((g) => (
          <section key={g.p} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-semibold text-text-primary">{g.titulo}</h2>
              <span className="text-xs text-text-muted">
                {g.itens.length} {g.itens.length === 1 ? "alerta" : "alertas"}
                {g.nota && ` · ${g.nota}`}
              </span>
            </div>
            <div className="space-y-2">
              {g.itens.map((a) => {
                const d = destino(a);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "card p-4 flex flex-col sm:flex-row sm:items-center gap-3 relative",
                      a.priority === "critica" && "border-l-[3px] border-l-danger",
                      a.priority === "alta" && "border-l-[3px] border-l-warning",
                      aGravar === a.id && "opacity-60",
                    )}
                  >
                    {/*
                      O link cobre o texto todo — clicar no alerta era o gesto
                      natural e antes não fazia nada. Os botões ficam fora dele:
                      adiar dentro de um link navegava em vez de adiar.
                    */}
                    <Link href={d.href} className="min-w-0 flex-1 group">
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={a.priority} />
                        <AlertTypeBadge type={a.type} />
                        <span className="text-[11px] text-text-muted">{formatDateTime(a.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 font-medium text-text-primary group-hover:text-piquet-700 transition-colors">{a.title}</p>
                      <p className="text-sm text-text-secondary">{a.description}</p>
                      <p className="text-xs text-text-muted mt-1">→ {a.recommendedAction}</p>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <div className="relative">
                        <button
                          onClick={() => setMenuAberto(menuAberto === a.id ? null : a.id)}
                          disabled={aGravar === a.id}
                          className="btn-secondary inline-flex items-center gap-1.5"
                          title="Voltar a mostrar mais tarde"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Adiar
                        </button>
                        {menuAberto === a.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-44 card p-1 shadow-elevated">
                            {PRAZOS.map((p) => (
                              <button
                                key={p.dias}
                                onClick={() => adiar(a.id, p.dias)}
                                className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-surface-muted"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Link href={d.href} className="btn-secondary inline-flex items-center gap-1.5">
                        {d.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {adiados.length > 0 && (
          <section className="space-y-2">
            <button
              onClick={() => setVerAdiados(!verAdiados)}
              className="text-sm text-text-secondary hover:text-text-primary inline-flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {adiados.length} {adiados.length === 1 ? "alerta adiado" : "alertas adiados"}
              <span className="text-xs text-text-muted">{verAdiados ? "· esconder" : "· ver"}</span>
            </button>
            {verAdiados && (
              <div className="space-y-2">
                {adiados.map((a) => (
                  <div key={a.id} className="card p-3 flex items-center gap-3 opacity-80">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                      <p className="text-xs text-text-muted">Volta a aparecer a {formatDate(a.snoozeUntil)}</p>
                    </div>
                    <button
                      onClick={() => repor(a.id)}
                      disabled={aGravar === a.id}
                      className="btn-secondary inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Mostrar já
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {erro && (
          <p className="text-sm text-danger">{erro}</p>
        )}

        {alertas.length > 0 && (
          <p className="text-xs text-text-muted">
            Os alertas são recalculados a cada visita e desaparecem sozinhos quando o motivo
            deixa de existir — não há nada para marcar como resolvido. Adiar só os tira da
            frente até à data escolhida; se a causa ainda lá estiver, voltam.
          </p>
        )}
      </div>
    </RouteGuard>
  );
}
