"use client";

import { useState } from "react";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getRoasReal, casarLeadsComClientes, getModeloAcompanhamento, definirModeloAcompanhamento,
  type RoasLinha,
} from "@/services/marketingService";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { RefreshCw, Link2, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * ROAS real: receita que os clientes pagaram, dividida pelo investimento.
 *
 * A diferença para o ROAS que a Meta e a Google mostram é a fonte da receita.
 * Elas contam as conversões que conseguem ver e atribuir; isto conta o
 * dinheiro que entrou no Payshop, vindo de pessoas cujas leads trouxeram uma
 * campanha identificada. É mais baixo e mais verdadeiro.
 *
 * Também é mais lento a encher: uma lead de hoje pode virar receita daqui a
 * semanas. Números de campanhas recentes leem-se com essa reserva.
 */

function Tabela({ linhas, rotulo }: { linhas: RoasLinha[]; rotulo: string }) {
  if (linhas.length === 0) {
    return <p className="text-sm text-text-secondary">Ainda sem dados por {rotulo.toLowerCase()}.</p>;
  }
  return (
    <div className="rounded-xl border border-surface-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle/60 text-text-muted">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">{rotulo}</th>
            <th className="px-3 py-2 font-medium text-right">Leads</th>
            <th className="px-3 py-2 font-medium text-right">Clientes</th>
            <th className="px-3 py-2 font-medium text-right">Receita Piquet</th>
            <th className="px-3 py-2 font-medium text-right">Investido</th>
            <th className="px-3 py-2 font-medium text-right">CAC</th>
            <th className="px-3 py-2 font-medium text-right">ROAS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/60">
          {linhas.map((l) => (
            <tr key={l.nome} className="hover:bg-surface-muted/40">
              <td className="px-3 py-2 text-text-primary">{l.nome}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.leads}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.clientes}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(l.receita)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                {l.investimento ? formatCurrency(l.investimento) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                {l.cac != null ? formatCurrency(l.cac) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {/* Traço quando o investimento é desconhecido: um "0,00×" diria
                    "gastámos e não rendeu", que é outra afirmação. */}
                {l.roas == null ? (
                  <span className="text-text-muted" title="Investimento desta campanha desconhecido">—</span>
                ) : (
                  <span className={cn("font-semibold", l.roas >= 1 ? "text-success" : "text-warning")}>
                    {l.roas.toFixed(2)}×
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Modelo de acompanhamento do Google Ads.
 *
 * Está aqui, e não nas definições, porque é a condição de que este painel
 * depende: sem ele nenhum clique do Google chega à landing com a campanha, e
 * o ROAS por campanha fica permanentemente vazio. Ver o painel e não ver isto
 * seria olhar para tabelas vazias sem saber porquê.
 */
function ModeloGoogle() {
  const { data, loading, refetch } = useAsyncData(() => getModeloAcompanhamento(), []);
  const [aGravar, setAGravar] = useState(false);

  const definir = async () => {
    setAGravar(true);
    try {
      await definirModeloAcompanhamento();
      toast("Modelo de acompanhamento definido na conta Google Ads.");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao definir o modelo.", "error");
    } finally {
      setAGravar(false);
    }
  };

  if (!data || loading) return null;
  const certo = data.atual != null && data.atual.includes("utm_campaign={campaignname}");

  return (
    <div className={cn("rounded-xl border-l-[3px] px-4 py-3 space-y-2",
      certo ? "border-l-success bg-success-light/20" : "border-l-warning bg-warning-light/25")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary flex items-center gap-2">
            {certo ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
            Modelo de acompanhamento do Google Ads
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {certo
              ? "Cada clique do Google chega à landing com a campanha identificada."
              : "Sem isto, os cliques do Google chegam sem campanha e caem todos em “direto”."}
          </p>
          <code className="mt-1 block text-[11px] text-text-muted break-all">
            {data.atual || "(não definido)"}
          </code>
        </div>
        {!certo && (
          <button onClick={definir} disabled={aGravar} className="btn-primary text-sm shrink-0 disabled:opacity-50">
            {aGravar ? "A definir…" : "Definir agora"}
          </button>
        )}
      </div>
      {data.error && <p className="text-xs text-danger">{data.error}</p>}
    </div>
  );
}

export function RoasReal() {
  const { data, loading, refetch } = useAsyncData(() => getRoasReal(), []);
  const [aCasar, setACasar] = useState(false);

  const casar = async () => {
    setACasar(true);
    try {
      const r = await casarLeadsComClientes();
      toast(
        `${r.casadas} lead(s) ligadas a clientes` +
        (r.ambiguas ? ` · ${r.ambiguas} com telefone repetido, por atribuir` : ""),
      );
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao casar leads.", "error");
    } finally {
      setACasar(false);
    }
  };

  const t = data?.totais;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">ROAS e CAC</h3>
          <p className="text-xs text-text-secondary">
            {t
              ? <>{t.leads} leads · {t.clientes} clientes · {formatCurrency(t.receita)} de receita atribuída</>
              : "Receita que os clientes pagaram, não as conversões reportadas."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={casar} disabled={aCasar} className="btn-secondary text-sm disabled:opacity-50"
            title="Procura, pelo telefone, que leads já são clientes">
            <Link2 className="h-4 w-4" /> {aCasar ? "A ligar…" : "Ligar leads a clientes"}
          </button>
          <button onClick={refetch} className="btn-secondary text-sm">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <ModeloGoogle />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Por canal</p>
          <Tabela linhas={data?.porCanal ?? []} rotulo="Canal" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Por campanha</p>
          <Tabela linhas={data?.porCampanha ?? []} rotulo="Campanha" />
        </div>
      </div>

      {/* Uma linha, com o resto no tooltip: o painel explicava-se em quatro
          linhas de texto que competiam com os números que devia servir. */}
      <p className="text-[11px] text-text-muted cursor-help"
        title={"Primeiro toque: conta a campanha que trouxe a pessoa pela primeira vez, mesmo que tenha voltado depois por outro caminho.\n\n"
          + "\"Direto\" são leads sem origem — boca-a-boca e quem escreveu o endereço à mão. É informação, não uma falha.\n\n"
          + "Uma lead de hoje pode virar receita daqui a semanas, por isso campanhas recentes aparecem sempre subestimadas."}>
        Primeiro toque · receita cobrada no Payshop · campanhas recentes aparecem subestimadas
      </p>
    </div>
  );
}
