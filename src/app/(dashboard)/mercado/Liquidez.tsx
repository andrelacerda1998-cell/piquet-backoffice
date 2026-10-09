"use client";

import Link from "next/link";
import { SectionHeader } from "@/components/ui/PageHeader";
import { useAsyncData } from "@/hooks/useDashboard";
import { getOperacao } from "@/services/dashboardService";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";

/**
 * Liquidez: se os pedidos estão a ser servidos -- funil, taxas de conclusão e
 * cancelamento, tempos medianos e onde se perdem. Era "Desempenho (SLA)" em
 * Operações; passou para Mercado (09/10/2026), ao lado da Cobertura.
 *
 * Funil, estados e tempos numa só leitura: as três saem da MESMA lista de
 * serviços, e a lista custa uma travessia paginada ao Laravel.
 */
export default function Liquidez() {
  const { data: op, error: opErro } = useAsyncData(() => getOperacao(), []);

  return (
          <div className="space-y-6">
            {opErro && (
              <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-4 py-3">
                <p className="text-sm font-semibold text-danger">Não foi possível medir a operação</p>
                <p className="text-xs text-text-secondary mt-0.5">{opErro}</p>
              </div>
            )}

            {op && (
              <>
                {/*
                  Só os tempos que se conseguem MEDIR. O ecrã mostrava antes
                  28, 95, 180, 1440 e 120 minutos, mais "sem técnico 2,1%" e
                  "em atraso 12" — todos constantes escritas no código.

                  Medianas e não médias: um serviço esquecido em aberto durante
                  três semanas desloca uma média e não desloca a mediana.
                */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Pedidos</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">{op.total}</p>
                    <p className="text-[11px] text-text-muted">no histórico todo</p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Taxa de conclusão</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.taxaConclusao.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Taxa de cancelamento</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.taxaCancelamento.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Até encontrar técnico</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.tempoAteEncontrarTecnico == null ? "—" : `${op.tempoAteEncontrarTecnico} min`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {op.amostras.encontrar > 0 ? `mediana de ${op.amostras.encontrar} serviços` : "sem dados"}
                    </p>
                  </div>
                  <div className="card p-3">
                    <p className="text-xs text-text-secondary">Duração do serviço</p>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      {op.duracaoDoServico == null ? "—" : `${op.duracaoDoServico} min`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {op.amostras.duracao > 0 ? `mediana de ${op.amostras.duracao} serviços` : "sem dados"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4 space-y-3">
                    <SectionHeader title="Onde se perdem os pedidos" />
                    {op.funil.map((p, i) => (
                      <div key={p.nome}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium text-text-primary">{p.nome}</span>
                          <span className="tabular-nums text-text-secondary">
                            {p.quantos}
                            {i > 0 && p.perdaNoPasso > 0 && (
                              <span className="ml-2 text-danger">−{p.perdaNoPasso.toFixed(1).replace(".", ",")}%</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                          <div className="h-full rounded-full bg-piquet" style={{ width: `${p.percentagem}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="card p-4 space-y-3">
                    <SectionHeader title="Em que estado estão" />
                    {op.porEstado.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-muted">Sem serviços registados.</p>
                    ) : (
                      op.porEstado.map((e) => (
                        <div key={e.estado}>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium text-text-primary">
                              {SERVICE_STATUS_LABELS[e.estado] ?? e.estado}
                            </span>
                            <span className="tabular-nums text-text-secondary">
                              {e.quantos} ({op.total > 0 ? Math.round((e.quantos / op.total) * 100) : 0}%)
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                            <div
                              className="h-full rounded-full bg-piquet/70"
                              style={{ width: `${op.total > 0 ? (e.quantos / op.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <p className="card p-4 text-sm text-text-secondary">
                  Tudo aqui sai dos serviços reais. Onde não há como medir — o tempo até responder, por exemplo, se o
                  Laravel não o registar — aparece um traço em vez de um número. Para agir sobre os pedidos de agora, usa o
                  separador{" "}
                  <Link href="/servicos" className="font-medium text-piquet-700 hover:underline">Pedidos › Ao vivo</Link>.
                </p>
              </>
            )}
          </div>
        
  );
}
