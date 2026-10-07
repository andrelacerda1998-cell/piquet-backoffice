"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio, RefreshCw, AlertTriangle, Clock, Users } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getOperacoesAoVivo } from "@/services/dashboardService";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { SectionHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import { cn } from "@/lib/utils";
import {
  DESFECHOS, MODOS, MOTIVOS, duracao, haQuanto, ordenarPorUrgencia, pct, restanteAgora,
  type Alerta, type Desfecho, type Liquidez, type PedidoAProcura, type PedidoEmCurso,
} from "@/lib/aoVivo";

/**
 * Operações ao vivo.
 *
 * A pergunta que decide o negócio — "este pedido vai ser servido?" — não
 * tinha ecrã. A 06/10 nenhum dos 4 pedidos reais do mês foi servido e só se
 * soube por um diagnóstico corrido à mão. Aqui está tudo o que esse
 * diagnóstico lia, a atualizar-se sozinho:
 *
 *  - a fila do que está à procura de técnico, ordenada pelo que está a
 *    morrer, com o prazo a contar para baixo;
 *  - o que está em curso e precisa de alguém;
 *  - a oferta: quantos técnicos estão mesmo prontos, e não só "Online";
 *  - a liquidez: quantos pedidos tiveram um "sim", quantos foram servidos e
 *    onde se perderam os outros.
 */

const ATUALIZAR_A_CADA_MS = 30_000;

const COR_ALERTA: Record<Alerta["nivel"], string> = {
  critico: "border-l-danger bg-danger-light/40",
  atencao: "border-l-warning bg-warning-light/40",
  info: "border-l-piquet bg-piquet/5",
};

const TEXTO_ALERTA: Record<Alerta["nivel"], string> = {
  critico: "text-danger",
  atencao: "text-warning",
  info: "text-piquet-700",
};

export function OperacoesAoVivo({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [incluirTestes, setIncluirTestes] = useState(false);
  const [janela, setJanela] = useState<"7d" | "30d">("7d");
  const [agora, setAgora] = useState(() => Date.now());

  const { data, loading, error, refetch } = useAsyncData(() => getOperacoesAoVivo(incluirTestes), [incluirTestes]);

  // O relógio do ecrã (prazos e idades) e a nova leitura ao servidor.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const leitura = setInterval(() => { refetch(); }, ATUALIZAR_A_CADA_MS);
    return () => { clearInterval(relogio); clearInterval(leitura); };
  }, [refetch]);

  const fila = useMemo(() => ordenarPorUrgencia(data?.a_procura ?? []), [data]);
  const emCurso = useMemo(() => ordenarPorUrgencia(data?.em_curso ?? []), [data]);
  const criticos = fila.filter((p) => p.alerta?.nivel === "critico").length + emCurso.filter((p) => p.alerta?.nivel === "critico").length;

  if (!data && loading) return <LoadingState message="A ler o marketplace…" />;
  if (!data && error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const liq = data.liquidez[janela];

  return (
    <div className="space-y-6">
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-text-primary">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          Ao vivo
        </span>
        <span className="text-text-muted">lido há {haQuanto(data.gerado_em, agora)} · atualiza a cada 30 s</span>
        <button onClick={() => refetch()} className="btn-secondary text-xs py-1" disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
        </button>
        <label className="ml-auto inline-flex items-center gap-2 text-text-secondary">
          <input type="checkbox" checked={incluirTestes} onChange={(e) => setIncluirTestes(e.target.checked)} className="rounded border-surface-border" />
          Mostrar contas de teste
        </label>
      </div>
      {error && (
        <p className="rounded-lg bg-danger-light/50 px-3 py-2 text-xs text-danger">
          A última leitura falhou ({error}). Os números abaixo são da leitura anterior.
        </p>
      )}

      {/* Números do momento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Numero titulo="À procura de técnico" valor={String(fila.length)} nota={criticos > 0 ? `${criticos} a precisar de ti` : "nenhum em risco"} destaque={criticos > 0} />
        <Numero titulo="Técnicos prontos agora" valor={String(data.oferta.prontos)}
          nota={`${data.oferta.online} Online · posição há menos de ${data.oferta.janela_minutos} min`} destaque={data.oferta.prontos === 0} />
        <Numero titulo={`Pedidos (${liq.dias} dias)`} valor={String(liq.pedidos)} nota={`${liq.terminados} já terminaram`} />
        <Numero titulo="Com pelo menos um sim" valor={pct(liq.taxa_com_sim)} nota={`${liq.com_sim} de ${liq.terminados} terminados`} />
        <Numero titulo="Servidos" valor={pct(liq.taxa_servidos)} nota={`${liq.servidos} de ${liq.terminados} terminados`} destaque={liq.terminados > 0 && liq.servidos === 0} />
        <Numero titulo="Até ao primeiro sim" valor={liq.mediana_segundos_ate_primeiro_sim == null ? "—" : duracao(liq.mediana_segundos_ate_primeiro_sim)} nota="mediana" />
      </div>
      <div className="flex gap-1 -mt-3">
        {(["7d", "30d"] as const).map((j) => (
          <button key={j} onClick={() => setJanela(j)}
            className={cn("text-xs px-2 py-1 rounded", janela === j ? "bg-piquet text-ink" : "bg-surface-muted text-text-secondary")}>
            {j === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
          </button>
        ))}
      </div>

      {/* A fila */}
      <section>
        <SectionHeader title="À procura de técnico" icon={Radio} aside={<>{fila.length} {fila.length === 1 ? "pedido" : "pedidos"}</>} />
        {fila.length === 0 ? (
          <p className="card p-6 text-center text-sm text-text-muted">Nenhum pedido à procura de técnico neste momento.</p>
        ) : (
          <ul className="space-y-2">
            {fila.map((p) => <LinhaAProcura key={p.id} p={p} lidoEm={data.gerado_em} agora={agora} onAbrir={onAbrir} />)}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Em curso */}
        <section>
          <SectionHeader title="Em curso" icon={Clock} aside={<>{emCurso.length}</>} />
          {emCurso.length === 0 ? (
            <p className="card p-6 text-center text-sm text-text-muted">Nenhum serviço em curso.</p>
          ) : (
            <ul className="space-y-2">
              {emCurso.map((p) => <LinhaEmCurso key={p.id} p={p} agora={agora} onAbrir={onAbrir} />)}
            </ul>
          )}
        </section>

        {/* Oferta */}
        <section>
          <SectionHeader title="Oferta por categoria" icon={Users} aside={<>Online · prontos</>} />
          <div className="card p-4 space-y-3">
            {data.oferta.por_area.length === 0 ? (
              <p className="text-sm text-text-muted">Nenhum técnico Online.</p>
            ) : data.oferta.por_area.map((a) => (
              <div key={a.area_id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-text-primary">{a.area}</span>
                  <span className="tabular-nums text-text-secondary">{a.online} · <strong className={a.prontos === 0 ? "text-danger" : "text-success"}>{a.prontos}</strong></span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden flex">
                  <div className="h-full bg-success" style={{ width: `${a.online ? (a.prontos / a.online) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-text-secondary pt-1">
              «Pronto» é Online, com o perfil completo e a mandar a localização há menos de {data.oferta.janela_minutos} min — é quem a
              procura de um pedido para agora consegue encontrar.
            </p>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section>
          <SectionHeader title={`Como acabaram os pedidos (${liq.dias} dias)`} />
          <Desfechos liq={liq} />
        </section>
        <section>
          <SectionHeader title="Últimos pedidos perdidos" aside={<>30 dias</>} />
          {data.perdidos.length === 0 ? (
            <p className="card p-6 text-center text-sm text-text-muted">Nenhum pedido perdido nos últimos 30 dias.</p>
          ) : (
            <ul className="card divide-y divide-surface-border">
              {data.perdidos.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onAbrir(p.id)} className="w-full text-left px-4 py-2.5 hover:bg-surface-subtle">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-text-primary truncate">#{p.id} · {p.tipo ?? "Serviço"}{p.cidade ? ` · ${p.cidade}` : ""}</span>
                      <span className="text-xs text-danger whitespace-nowrap">{DESFECHOS[p.desfecho]}</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {MODOS[p.modo]} · {p.convidados} {p.convidados === 1 ? "convidado" : "convidados"} · durou {duracao(p.viveu_segundos)} · há {haQuanto(p.criado_em, agora)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Numero({ titulo, valor, nota, destaque }: { titulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={cn("card p-3", destaque && "border-danger/40")}>
      <p className="text-xs text-text-secondary">{titulo}</p>
      <p className={cn("text-xl font-bold tabular-nums", destaque ? "text-danger" : "text-text-primary")}>{valor}</p>
      {nota && <p className="text-[11px] text-text-muted">{nota}</p>}
    </div>
  );
}

function Cabecalho({ p, agora }: { p: PedidoAProcura | PedidoEmCurso; agora: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <span className="font-mono text-xs text-text-muted">#{p.id}</span>
      <span className="font-medium text-text-primary truncate">{p.tipo ?? "Serviço"}</span>
      <span className="text-xs text-text-secondary">{[p.cliente, p.cidade].filter(Boolean).join(" · ")}</span>
      <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-text-secondary">{MODOS[p.modo]}</span>
      <StatusBadge status={p.estadoBackoffice} label={SERVICE_STATUS_LABELS[p.estadoBackoffice]} />
      <span className="text-[11px] text-text-muted">há {haQuanto(p.criado_em, agora)}</span>
      {p.marcado_para && <span className="text-[11px] text-text-muted">· marcado para {p.marcado_para}</span>}
    </div>
  );
}

function AvisoDoAlerta({ alerta }: { alerta: Alerta }) {
  return (
    <p className={cn("mt-1 text-xs font-medium inline-flex items-center gap-1", TEXTO_ALERTA[alerta.nivel])}>
      {alerta.nivel !== "info" && <AlertTriangle className="h-3.5 w-3.5" />}
      {MOTIVOS[alerta.motivo] ?? alerta.motivo}
    </p>
  );
}

function LinhaAProcura({ p, lidoEm, agora, onAbrir }: { p: PedidoAProcura; lidoEm: string; agora: number; onAbrir: (id: string) => void }) {
  const restante = restanteAgora(p.segundos_restantes, lidoEm, agora);
  return (
    <li>
      <button onClick={() => onAbrir(p.id)}
        className={cn("w-full text-left card border-l-[3px] px-4 py-3 hover:shadow-elevated transition-shadow", p.alerta ? COR_ALERTA[p.alerta.nivel] : "border-l-surface-border")}>
        {/* Grelha e não flex com quebra: o prazo fica sempre na coluna da
            direita, mesmo quando o cabeçalho ocupa duas linhas. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <Cabecalho p={p} agora={agora} />
          {p.prazo && (
            <div className="text-right">
              <p className={cn("text-lg font-bold tabular-nums", restante !== null && restante <= 60 ? "text-danger" : "text-text-primary")}>{duracao(restante)}</p>
              <p className="text-[11px] text-text-muted">{p.prazo_de === "cliente" ? "para o cliente escolher" : "para os técnicos aceitarem"}{p.assincrono ? " · agendado com tempo" : ""}</p>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-text-secondary tabular-nums">
          {p.convidados === 0
            ? "Ninguém convidado"
            : <>{p.aceitaram} de {p.convidados} aceitaram · {p.por_responder} por responder · {p.recusaram} recusaram · {p.expiraram} não responderam · onda {p.onda}</>}
        </p>
        {p.alerta && <AvisoDoAlerta alerta={p.alerta} />}
      </button>
    </li>
  );
}

function LinhaEmCurso({ p, agora, onAbrir }: { p: PedidoEmCurso; agora: number; onAbrir: (id: string) => void }) {
  return (
    <li>
      <button onClick={() => onAbrir(p.id)}
        className={cn("w-full text-left card border-l-[3px] px-4 py-3 hover:shadow-elevated transition-shadow", p.alerta ? COR_ALERTA[p.alerta.nivel] : "border-l-surface-border")}>
        <Cabecalho p={p} agora={agora} />
        <p className="mt-1 text-xs text-text-secondary">
          {p.tecnico ?? "Sem técnico"}
          {p.chegou_em ? ` · no local há ${haQuanto(p.chegou_em, agora)}` : p.a_caminho_em ? ` · a caminho há ${haQuanto(p.a_caminho_em, agora)}` : ""}
        </p>
        {p.alerta && <AvisoDoAlerta alerta={p.alerta} />}
      </button>
    </li>
  );
}

const ORDEM_DESFECHOS: Desfecho[] = ["servido", "sem_oferta", "sem_resposta", "sem_escolha", "pagamento_falhou", "cancelado", "outro", "em_aberto"];

function Desfechos({ liq }: { liq: Liquidez }) {
  const total = liq.pedidos;
  if (total === 0) return <p className="card p-6 text-center text-sm text-text-muted">Sem pedidos neste período.</p>;
  return (
    <div className="card p-4 space-y-2.5">
      {ORDEM_DESFECHOS.filter((d) => (liq.por_desfecho[d] ?? 0) > 0).map((d) => {
        const n = liq.por_desfecho[d] ?? 0;
        return (
          <div key={d}>
            <div className="flex items-baseline justify-between text-sm">
              <span className={cn("font-medium", d === "servido" ? "text-success" : d === "em_aberto" ? "text-text-secondary" : "text-text-primary")}>{DESFECHOS[d]}</span>
              <span className="tabular-nums text-text-secondary">{n} ({Math.round((n / total) * 100)}%)</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
              <div className={cn("h-full rounded-full", d === "servido" ? "bg-success" : d === "em_aberto" ? "bg-surface-strong" : "bg-danger/70")} style={{ width: `${(n / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
      {Object.keys(liq.por_modo).length > 0 && (
        <p className="pt-2 text-xs text-text-secondary">
          {Object.entries(liq.por_modo).map(([modo, v]) => `${MODOS[modo as keyof typeof MODOS]}: ${v!.servidos} de ${v!.pedidos} servidos`).join(" · ")}
        </p>
      )}
    </div>
  );
}
