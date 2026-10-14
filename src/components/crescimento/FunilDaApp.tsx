"use client";

import { StatGroup, Stat } from "@/components/ui/Stats";
import { Painel } from "@/components/ui/Painel";
import type { AppFunnel } from "@/services/backofficeService";
import { passoDoFunil, avisosDoFunil, maiorQuebra, duracaoCurta } from "@/lib/funilDaApp";
import { formatDate, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const pct = (fracao: number) => `${(fracao * 100).toFixed(1).replace(".", ",")}%`;

/**
 * O funil da app do cliente, passo a passo e em português: o que a pessoa fez
 * em cada passo, quantas lá chegaram, quantas se perderam e quanto tempo
 * levaram. Por cima, o que na definição do funil faz perder gente que avançou
 * na app (os passos só de convidados, a ordem trocada) — sem isso, a maior
 * quebra lia-se como desistência quando é um defeito da medição.
 *
 * Os passos vêm do funil guardado no Mixpanel; os nomes e as explicações, do
 * `lib/funilDaApp`.
 */
export function FunilDaApp({ funnel }: { funnel: AppFunnel }) {
  const passos = funnel.steps;
  const topo = passos[0]?.count ?? 0;
  const fim = passos[passos.length - 1];
  const semNinguem = topo === 0;
  const avisos = avisosDoFunil(passos.map((s) => s.event));
  const quebra = maiorQuebra(passos.map((s) => s.count));
  // "Untitled" é o nome por omissão do Mixpanel: não diz nada a ninguém.
  const nomeNoMixpanel = funnel.name && funnel.name !== "Untitled" ? funnel.name : null;

  return (
    <div className="space-y-4">
      {semNinguem && (
        <div className="aviso aviso-atencao">
          <p className="font-medium">Ninguém chegou ao primeiro passo neste período.</p>
          <p className="text-text-secondary mt-0.5">
            Se houve pedidos na app nestas datas, os eventos não estão a chegar ao Mixpanel. Experimenta outro mês no seletor para ver desde quando.
          </p>
        </div>
      )}
      {avisos.map((a) => (
        <div key={a.texto} className={cn("aviso", a.tom === "atencao" ? "aviso-atencao" : "aviso-info")}>{a.texto}</div>
      ))}

      <StatGroup cols={3}>
        <Stat label="No primeiro passo" value={formatNumber(topo)} note={`pessoas · ${passoDoFunil(passos[0].event).nome}`} />
        <Stat label="Chegaram ao fim" value={semNinguem ? "—" : formatNumber(fim.count)} note={`pessoas · ${passoDoFunil(fim.event).nome}`} />
        <Stat label="Conversão" value={semNinguem ? "—" : pct(fim.overallConvRatio)} note="do primeiro passo ao último" />
      </StatGroup>

      {quebra && (
        <p className="text-[13px] text-text-secondary">
          Onde se perdem mais pessoas: entre <b className="font-medium text-text-primary">{passoDoFunil(passos[quebra.indice - 1].event).nome}</b>{" "}
          e <b className="font-medium text-text-primary">{passoDoFunil(passos[quebra.indice].event).nome}</b> — saíram{" "}
          {formatNumber(quebra.perdidos)} de {formatNumber(passos[quebra.indice - 1].count)} ({pct(quebra.fracao)}).
        </p>
      )}

      <Painel
        titulo="Passo a passo"
        descricao={`${formatDate(funnel.from)} → ${formatDate(funnel.to)} · cada pessoa conta uma vez por mês`}
        corpo="divide-y divide-surface-border"
      >
        {passos.map((s, i) => {
          const p = passoDoFunil(s.event);
          const anterior = i > 0 ? passos[i - 1].count : 0;
          const perdidos = anterior - s.count;
          return (
            <div key={i} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-medium text-text-primary min-w-0">
                  <span className="text-text-muted mr-1.5 tabular-nums">{i + 1}.</span>{p.nome}
                </p>
                <div className="flex items-baseline gap-3 shrink-0 tabular-nums">
                  <span className="text-[13px] font-semibold">{formatNumber(s.count)}</span>
                  <span className="text-xs text-text-muted w-12 text-right" title="Face ao primeiro passo">
                    {semNinguem ? "—" : pct(s.overallConvRatio)}
                  </span>
                  <span
                    title="Pessoas que se perderam face ao passo anterior"
                    className={cn("text-xs w-24 text-right",
                      i === 0 || anterior === 0 ? "text-text-muted"
                        : s.dropOff > 0.5 ? "font-medium text-danger"
                        : s.dropOff > 0.25 ? "font-medium text-warning"
                        : "text-text-muted")}
                  >
                    {i === 0 ? "início" : anterior === 0 ? "—" : perdidos > 0 ? `−${formatNumber(perdidos)} (${Math.round(s.dropOff * 100)}%)` : "sem perdas"}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                <div
                  className={cn("h-full rounded-full", i === passos.length - 1 ? "bg-success/80" : "bg-piquet")}
                  style={{ width: `${semNinguem ? 0 : (s.count / topo) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-text-secondary">{p.explicacao}</p>
              {p.foraDoFunil && (
                <p className="mt-0.5 text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">Fica de fora:</span> {p.foraDoFunil}
                </p>
              )}
              {/* O nome cru do evento fica à vista: sem ele não se sabe QUE
                  evento do Mixpanel alimenta cada passo. */}
              <p className="mt-0.5 text-[11px] text-text-muted">
                evento <code>{s.event}</code>
                {i > 0 && s.avgTime != null && <> · em média {duracaoCurta(s.avgTime)} depois do passo anterior</>}
              </p>
            </div>
          );
        })}
      </Painel>

      <p className="text-xs text-text-muted">
        Os passos e a ordem vêm do funil {nomeNoMixpanel ? <>«{nomeNoMixpanel}»</> : "guardado"} no Mixpanel
        {funnel.funnelId ? <> (n.º {funnel.funnelId})</> : null}: para os mudar, edita esse funil lá. Uma pessoa só conta num
        passo se tiver feito todos os anteriores, por esta ordem. A percentagem é sobre o primeiro passo; ao lado, quantas
        pessoas se perderam face ao passo anterior — a vermelho quando sai mais de metade.
      </p>
    </div>
  );
}
