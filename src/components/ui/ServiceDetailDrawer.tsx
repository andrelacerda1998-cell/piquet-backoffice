"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import type { ServiceRequest } from "@/types";
import { X, Star, Lock } from "lucide-react";
import { getFotosDoCliente, getDetalheDoServico, type FotoDoCliente } from "@/services/dashboardService";
import type { CandidatoLaravel } from "@/app/api/services/[id]/detalhe/route";

/*
  ——— O que saiu deste painel, e porquê ———

  As quatro ações do topo -- Avançar estado, Agendar, Cancelar, Reembolsar --
  não faziam NADA. Cada uma mostrava só uma mensagem:

      onClick={() => toast(`Serviço ${service.id} cancelado.`, "error")}

  Nenhuma chamada a lado nenhum. Quem carregasse em "Cancelar" lia "Serviço
  282 cancelado." e o serviço continuava de pé; "Reembolsar" diria que o
  reembolso tinha começado e nenhum cêntimo sairia, com um cliente à espera.

  E não é só que estavam por ligar: três das quatro não correspondem a
  operação nenhuma. No Filament só existem duas ações sobre um serviço --
  `retryCapture` e `abandonAndRefund` -- ambas só para super-admin e só
  quando o pagamento ficou por capturar. Cancelar e agendar em nome de
  alguém não existe em lado nenhum: quem cancela é o cliente ou o técnico,
  na app.

  Saiu também o separador "Chat", que eram três frases escritas no código,
  iguais em todos os serviços, com uma caixa de escrever que não enviava.

  "Fotos e vídeos" desenhava seis quadrados vazios, sempre seis. Agora lê as
  fotos verdadeiras -- e chama-se só "Fotos", porque vídeos não existem.
*/


export function ServiceDetailDrawer({ service, onClose }: { service: ServiceRequest; onClose: () => void }) {
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    /*
      `!mt-0` não é decoração: este painel é renderizado dentro de um
      contentor com `space-y-6`, e o Tailwind põe `margin-top: 1.5rem` em
      todos os filhos menos o primeiro. Com `inset-0` e `bottom: 0`, essa
      margem empurrava a sobreposição 24px para baixo E encurtava-a 24px --
      ficava uma faixa da aplicação visível por cima do ecrã inteiro. O
      seletor do `space-y` tem mais especificidade do que um `mt-0` simples,
      daí o `!`.
    */
    <div className="fixed inset-0 z-50 bg-black/40 !mt-0" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Serviço ${service.id}`} className="w-full bg-surface h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10">
          <div className="mx-auto max-w-[1400px] flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted">{service.id}</p>
              <h2 className="text-lg font-bold mt-0.5">{service.serviceName}</h2>
              <p className="text-sm text-text-secondary">{service.customerName} · {service.city}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-auto max-w-[1400px] mt-3 flex items-center gap-2">
            <StatusBadge status={service.status} label={SERVICE_STATUS_LABELS[service.status]} />
          </div>

          {/*
            Aqui estavam quatro botões que só mostravam mensagens. Não se
            substituem por outros: as ações que existem de facto sobre um
            serviço vivem no Filament e são duas, ambas para pagamentos que
            ficaram por capturar. Declarar falta de técnico faz-se em
            Qualidade › Faltas, que é real e cobra mesmo.
          */}
          </div>

        {/*
          Tudo à vista, em colunas, em vez de dez separadores.

          Isto era uma gaveta de 576px com dez abas: para ver o pagamento e a
          cronologia do mesmo serviço era preciso saltar entre elas e guardar
          uma na cabeça. Com o ecrã todo cabem lado a lado, e deixa de haver
          conteúdo escondido atrás de um clique — que era metade do problema
          deste painel.
        */}
        {/*
          Colunas CSS e não `grid`.

          Com `grid`, as células alinham por LINHA: o Resumo é alto, e os dois
          cartões ao lado ficavam com um buraco por baixo até ao fim da linha.
          Num serviço sem técnico e sem valores — onde metade dos cartões é
          uma frase — metade do ecrã era espaço vazio.

          `columns` empilha na vertical e só passa à coluna seguinte quando a
          anterior enche, como uma página de jornal: sem linhas, sem buracos.
          `break-inside-avoid` impede que um cartão seja cortado ao meio.
        */}
        <div className="mx-auto max-w-[1400px] px-6 pb-6 pt-5 columns-1 lg:columns-2 xl:columns-3 gap-5">
          <Seccao titulo="Resumo"><Resumo service={service} /></Seccao>
          <Seccao titulo="Técnicos convidados"><Matching service={service} /></Seccao>
          <Seccao titulo="Cronologia"><Cronologia service={service} /></Seccao>
          <Seccao titulo="Pagamento"><Pagamento service={service} /></Seccao>
          <Seccao titulo="Faturas"><Faturas service={service} /></Seccao>
          <Seccao titulo="Fotos do cliente"><Fotos service={service} /></Seccao>
          {/*
            Avaliação e reclamação num cartão só: são as duas o que o cliente
            achou no fim e, na esmagadora maioria dos serviços, são as duas
            uma frase a dizer que não há. Dois cartões para duas frases era o
            desperdício mais visível deste ecrã.
          */}
          <Seccao titulo="O que o cliente achou">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Avaliação</p>
                <Avaliacoes service={service} />
              </div>
              <div className="pt-3 border-t border-surface-border">
                <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Reclamação</p>
                <Reclamacao service={service} />
              </div>
            </div>
          </Seccao>
          <Seccao titulo="Histórico"><Historico service={service} /></Seccao>
          <Seccao titulo="Conversa"><Conversa service={service} /></Seccao>
        </div>
      </div>
    </div>
  );
}

/** Um bloco do ecrã, com título. Substitui um separador. */
function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 mb-5 break-inside-avoid">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">{titulo}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-surface-border text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-right text-text-primary">{value}</span>
    </div>
  );
}

function Resumo({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      <Row label="Cliente" value={service.customerName} />
      <Row label="Técnico" value={service.technicianName ?? "Não atribuído"} />
      <Row label="Categoria" value={service.categoryName} />
      <Row label="Serviço" value={service.serviceName} />
      <Row label="Localização" value={`${service.location}, ${service.city}`} />
      <Row label="Origem" value={service.source} />
      <Row label="Valor total" value={formatCurrency(service.totalCustomerValue)} />
      <Row label="Valor técnico" value={formatCurrency(service.technicianValue)} />
      <Row label="Receita Piquet" value={formatCurrency(service.piquetRevenue)} />
      {service.vatValue != null && <Row label="IVA" value={formatCurrency(service.vatValue)} />}
    </div>
  );
}

const ESTADO_DO_CANDIDATO: Record<string, { label: string; cor: string }> = {
  shortlisted: { label: "Na fila", cor: "text-text-muted" },
  notified: { label: "Por responder", cor: "text-warning" },
  accepted: { label: "Aceitou", cor: "text-success" },
  selected: { label: "Escolhido", cor: "text-success" },
  lost: { label: "Aceitou, outro foi escolhido", cor: "text-text-secondary" },
  declined: { label: "Recusou", cor: "text-danger" },
  expired: { label: "Não respondeu", cor: "text-danger" },
};

/** Minutos entre o convite e a resposta, ou nada se não respondeu. */
function tempoDeResposta(c: CandidatoLaravel): string | null {
  if (!c.notified_at || !c.responded_at) return null;
  const min = Math.round((Date.parse(c.responded_at) - Date.parse(c.notified_at)) / 60000);
  if (!Number.isFinite(min) || min < 0) return null;
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/**
 * A quem se perguntou e o que cada um respondeu.
 *
 * O Laravel guarda cada convite (onda, distância, preço cotado, resposta) e o
 * backoffice não o mostrava em lado nenhum. É o que se quer ver quando um
 * cliente diz "ninguém pegou no meu pedido": se ninguém foi convidado, falta
 * gente na zona; se foram doze e nenhum respondeu, o problema é outro.
 */
function Matching({ service }: { service: ServiceRequest }) {
  const [lista, setLista] = useState<CandidatoLaravel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setLista(null);
    setErro(null);
    getDetalheDoServico(service.id)
      .then((d) => vivo && setLista(d?.candidatos ?? []))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível ler os convites."));
    return () => { vivo = false; };
  }, [service.id]);

  if (erro) return <p className="text-sm text-danger">{erro}</p>;
  if (lista === null) return <p className="text-sm text-text-muted">A carregar…</p>;
  if (lista.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Nenhum técnico foi convidado para este pedido — não havia ninguém disponível para esta categoria por perto,
        ou o pedido não chegou a procurar.
      </p>
    );
  }

  const aceitaram = lista.filter((c) => ["accepted", "selected", "lost"].includes(c.status)).length;
  const ordenada = [...lista].sort((a, b) => (a.wave ?? 0) - (b.wave ?? 0) || (a.rank ?? 0) - (b.rank ?? 0));

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        {aceitaram} {aceitaram === 1 ? "aceitou" : "aceitaram"} de {lista.length} {lista.length === 1 ? "convidado" : "convidados"}.
      </p>
      <ul className="divide-y divide-surface-border">
        {ordenada.map((c) => {
          const estado = ESTADO_DO_CANDIDATO[c.status] ?? { label: c.status, cor: "text-text-secondary" };
          const tempo = tempoDeResposta(c);
          return (
            <li key={c.vendor_id} className="py-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-text-primary truncate">{c.vendor_name ?? `Técnico ${c.vendor_id}`}</span>
                <span className={cn("text-xs font-medium whitespace-nowrap", estado.cor)}>{estado.label}</span>
              </div>
              <p className="text-[11px] text-text-muted tabular-nums">
                {[
                  c.wave != null && `onda ${c.wave}`,
                  c.quoted_distance != null && `${c.quoted_distance.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} km`,
                  c.rating_average != null && `★ ${c.rating_average.toFixed(1).replace(".", ",")}`,
                  c.quoted_amount != null && formatCurrency(c.quoted_amount),
                  tempo && `respondeu em ${tempo}`,
                ].filter(Boolean).join(" · ")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function step(label: string, at?: string) {
  return { label, at };
}

function Cronologia({ service }: { service: ServiceRequest }) {
  const steps = [
    step("Pedido recebido", service.requestedAt),
    step("Técnico atribuído", service.technicianName ? service.requestedAt : undefined),
    step("Agendado", service.scheduledAt),
    step("Serviço iniciado", service.startedAt),
    step("Serviço concluído", service.completedAt),
  ].filter((s) => s.at);

  return (
    <ol className="relative border-l border-surface-border ml-2 space-y-6">
      {steps.map((s, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-piquet border-2 border-surface" />
          <p className="text-sm font-medium text-text-primary">{s.label}</p>
          <p className="text-xs text-text-muted">{s.at ? formatDateTime(s.at) : "—"}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * As fotografias que o CLIENTE anexou ao pedido.
 *
 * Aqui estavam seis quadrados vazios desenhados por
 * `Array.from({ length: 6 })` — sempre seis, em qualquer serviço, sem ler
 * nada. As fotos existem: o cliente junta-as no checkout, até cinco, para o
 * técnico perceber o trabalho antes de chegar.
 *
 * Os URL são temporários (60 minutos, assinados pelo Laravel). Se o painel
 * ficar aberto muito tempo, deixam de abrir — daí o aviso.
 */
function Fotos({ service }: { service: ServiceRequest }) {
  const [fotos, setFotos] = useState<FotoDoCliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getFotosDoCliente(service.id)
      .then((f) => vivo && setFotos(f))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível ler as fotografias."));
    return () => { vivo = false; };
  }, [service.id]);

  if (erro) return <p className="text-sm text-danger">{erro}</p>;
  if (fotos === null) return <p className="text-sm text-text-muted">A carregar…</p>;
  if (fotos.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-muted">Este pedido não tem fotografias.</p>
        <p className="text-xs text-text-secondary">
          O cliente anexa-as no checkout, e nem sempre anexa. Serviços registados à mão no backoffice nunca as têm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">
        {fotos.length} {fotos.length === 1 ? "fotografia anexada" : "fotografias anexadas"} pelo cliente, para o
        técnico saber o que o espera. Não são o antes/depois do técnico — essas ficam do lado dele.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((f) => (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="aspect-square rounded-lg overflow-hidden bg-surface-subtle block hover:opacity-90 transition-opacity"
            title="Abrir em tamanho real"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="Fotografia do cliente" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
      <p className="text-[11px] text-text-muted">
        As ligações expiram ao fim de uma hora. Se alguma deixar de abrir, fecha e volta a abrir o painel.
      </p>
    </div>
  );
}

/**
 * Onde está a conversa — e porque é que não está aqui.
 *
 * Aqui estavam três frases escritas no código ("Boa tarde, o problema é
 * urgente. Conseguem hoje?"), iguais em todos os serviços, com uma caixa de
 * escrever que não enviava para lado nenhum.
 *
 * A conversa existe mesmo, mas é entre o cliente e o técnico ATRIBUÍDO, nas
 * apps, cifrada com a chave do próprio serviço. Não há hoje forma de a ler
 * daqui: a API de admin não expõe mensagens. Dizer isto é mais útil do que
 * um separador que finge.
 */
function Conversa({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-surface-subtle px-4 py-3">
        <p className="text-sm font-medium text-text-primary inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-text-muted" />
          A conversa deste serviço não passa por aqui
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {service.technicianName
            ? <>É entre o cliente e <strong className="text-text-primary">{service.technicianName}</strong>, dentro das apps, cifrada com a chave deste serviço.</>
            : <>Só existe depois de haver técnico atribuído — sem segunda pessoa não há conversa. Este pedido ainda não tem técnico.</>}
        </p>
      </div>
      <p className="text-xs text-text-secondary">
        O backoffice não tem forma de a ler: a API de admin não expõe as mensagens. Se precisares delas para resolver
        uma disputa, é preciso criar esse acesso de propósito — e decidir antes se o staff deve poder ler conversas
        privadas entre duas pessoas.
      </p>
    </div>
  );
}

function Pagamento({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      <Row label="Estado do pagamento" value={<StatusBadge status={service.paymentStatus} />} />
      <Row label="Valor cobrado" value={formatCurrency(service.totalCustomerValue)} />
      {service.vatValue != null && <Row label="IVA" value={formatCurrency(service.vatValue)} />}
      <Row label="Receita Piquet" value={formatCurrency(service.piquetRevenue)} />
      <Row label="A pagar ao técnico" value={formatCurrency(service.technicianValue)} />
    </div>
  );
}

function Faturas({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      {/* O Laravel ainda não envia o estado da fatura: sem ele não há linha, em
          vez de um "Não emitida" que ninguém afirmou. */}
      {service.invoiceStatus && <Row label="Estado da fatura" value={<StatusBadge status={service.invoiceStatus} />} />}
      <Row label="Data do pedido" value={formatDate(service.requestedAt)} />
      <Row label="Total" value={formatCurrency(service.totalCustomerValue)} />
      {/*
        Saiu o "Nº fatura", que era inventado: `FT 2026/0282`, montado a
        partir do ano e dos dígitos do id. O número verdadeiro é atribuído
        pelo InvoiceXpress e não chega à API de admin. Saiu também o botão
        "Descarregar fatura", que não descarregava nada.
      */}
      <p className="pt-3 text-xs text-text-secondary">
        O número e o PDF da fatura são do InvoiceXpress e não chegam ao backoffice. Aqui fica o estado, que é o que
        permite saber se já foi emitida.
      </p>
    </div>
  );
}

function Avaliacoes({ service }: { service: ServiceRequest }) {
  if (!service.rating) return <p className="text-sm text-text-muted">Ainda sem avaliação.</p>;
  return (
    <div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("h-5 w-5", i < Math.round(service.rating ?? 0) ? "text-piquet fill-piquet" : "text-surface-strong")} />
        ))}
        <span className="ml-2 font-bold text-text-primary">{service.rating?.toFixed(1)}</span>
      </div>
      {/*
        Aqui estava uma opinião escrita pelo código: "excelente, técnico muito
        profissional" acima de 4 estrelas, "razoável, houve algum atraso"
        abaixo. Punha aspas à volta de palavras que o cliente nunca disse. A
        nota é real; o comentário não existe na API de admin.
      */}
      <p className="mt-3 text-xs text-text-secondary">
        A nota é a que o cliente deu no fim do serviço. Comentários escritos não chegam ao backoffice.
      </p>
    </div>
  );
}

function Reclamacao({ service }: { service: ServiceRequest }) {
  if (!service.hasComplaint) return <p className="text-sm text-text-muted">Sem reclamações associadas a este serviço.</p>;
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-light p-4">
      <p className="text-sm font-medium text-danger">Reclamação aberta</p>
      {/*
        O texto que estava aqui -- "Cliente reportou insatisfação com o
        resultado. Em análise pela equipa de suporte." -- era fixo, igual em
        todas. O que existe de facto é a marca de que há reclamação; o teor
        não vem na API.
      */}
      <p className="mt-1 text-sm text-text-secondary">
        Este serviço está marcado como tendo reclamação. O que o cliente disse chega como ticket em Suporte, com o
        número do serviço no assunto.
      </p>
    </div>
  );
}

function Historico({ service }: { service: ServiceRequest }) {
  const events = [
    { at: service.requestedAt, text: "Pedido criado no sistema" },
    { at: service.scheduledAt, text: "Marcação agendada" },
    { at: service.completedAt, text: "Serviço fechado" },
  ].filter((e) => e.at);
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex justify-between text-sm py-2 border-b border-surface-border">
          <span className="text-text-secondary">{e.text}</span>
          <span className="text-text-muted">{e.at ? formatDateTime(e.at) : "—"}</span>
        </div>
      ))}
    </div>
  );
}
