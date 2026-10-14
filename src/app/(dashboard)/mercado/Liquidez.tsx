"use client";

import Link from "next/link";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { Painel } from "@/components/ui/Painel";
import { Barra } from "@/components/ui/Barra";
import { useAsyncData } from "@/hooks/useDashboard";
import { getOperacao } from "@/services/dashboardService";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

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
        <div className="aviso aviso-perigo">
          <p className="font-medium">Não foi possível medir a operação</p>
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
          <StatGroup cols={5}>
            <Stat label="Pedidos" value={op.total} note="no histórico todo" />
            <Stat label="Taxa de conclusão" value={pct(op.taxaConclusao)} />
            <Stat label="Taxa de cancelamento" value={pct(op.taxaCancelamento)} />
            <Stat label="Até encontrar técnico"
              value={op.tempoAteEncontrarTecnico == null ? "—" : `${op.tempoAteEncontrarTecnico} min`}
              note={op.amostras.encontrar > 0 ? `mediana de ${op.amostras.encontrar} serviços` : "sem dados"} />
            <Stat label="Duração do serviço"
              value={op.duracaoDoServico == null ? "—" : `${op.duracaoDoServico} min`}
              note={op.amostras.duracao > 0 ? `mediana de ${op.amostras.duracao} serviços` : "sem dados"} />
          </StatGroup>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Painel titulo="Onde se perdem os pedidos" descricao="Cada passo do funil e quanto cai em relação ao anterior" corpo="p-4 space-y-3.5">
              {op.funil.map((p, i) => (
                <Barra key={p.nome} nome={p.nome} largura={p.percentagem}
                  valor={<>
                    {p.quantos}
                    {i > 0 && p.perdaNoPasso > 0 && <span className="ml-2 text-danger">−{pct(p.perdaNoPasso)}</span>}
                  </>} />
              ))}
            </Painel>

            <Painel titulo="Em que estado estão" descricao="Todos os pedidos, pelo estado em que estão hoje" corpo="p-4 space-y-3.5">
              {op.porEstado.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">Sem serviços registados.</p>
              ) : (
                op.porEstado.map((e) => (
                  <Barra key={e.estado} nome={SERVICE_STATUS_LABELS[e.estado] ?? e.estado} cor="bg-piquet/60"
                    largura={op.total > 0 ? (e.quantos / op.total) * 100 : 0}
                    valor={<>{e.quantos} <span className="text-text-muted">({op.total > 0 ? Math.round((e.quantos / op.total) * 100) : 0}%)</span></>} />
                ))
              )}
            </Painel>
          </div>

          <p className="text-[13px] text-text-muted">
            Tudo aqui sai dos serviços reais. Onde não há como medir — o tempo até responder, por exemplo, se o
            Laravel não o registar — aparece um traço em vez de um número. Para agir sobre os pedidos de agora, usa{" "}
            <Link href="/servicos" className="link">Pedidos › Ao vivo</Link>.
          </p>
        </>
      )}
    </div>
  );
}
