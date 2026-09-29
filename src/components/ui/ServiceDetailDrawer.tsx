"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import type { ServiceRequest } from "@/types";
import { X, Star, Pencil, Lock } from "lucide-react";
import { getFotosDoCliente, type FotoDoCliente } from "@/services/dashboardService";

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
const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "crono", label: "Cronologia" },
  { id: "media", label: "Fotos do cliente" },
  { id: "pag", label: "Pagamento" },
  { id: "fat", label: "Faturas" },
  { id: "aval", label: "Avaliações" },
  { id: "rec", label: "Reclamação" },
  { id: "notas", label: "Notas internas" },
  { id: "hist", label: "Histórico" },
  { id: "conversa", label: "Conversa" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ServiceDetailDrawer({ service, onClose, onEdit }: { service: ServiceRequest; onClose: () => void; onEdit?: (s: ServiceRequest) => void }) {
  const [tab, setTab] = useState<TabId>("resumo");
  const panelRef = useDrawerA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Serviço ${service.id}`} className="w-full max-w-xl bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted">{service.id}</p>
              <h2 className="text-lg font-bold mt-0.5">{service.serviceName}</h2>
              <p className="text-sm text-text-secondary">{service.customerName} · {service.city}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={service.status} label={SERVICE_STATUS_LABELS[service.status]} />
            {onEdit && (service.status === "concluido" || service.source === "manual") && (
              <button onClick={() => onEdit(service)} className="btn-secondary text-xs py-1">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          </div>

          {/*
            Aqui estavam quatro botões que só mostravam mensagens. Não se
            substituem por outros: as ações que existem de facto sobre um
            serviço vivem no Filament e são duas, ambas para pagamentos que
            ficaram por capturar. Declarar falta de técnico faz-se em
            Qualidade › Faltas, que é real e cobra mesmo.
          */}
          {/* Separadores */}
          <div className="mt-4 flex gap-1 overflow-x-auto -mb-4 pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  tab === t.id ? "border-piquet text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {tab === "resumo" && <Resumo service={service} />}
          {tab === "crono" && <Cronologia service={service} />}
          {tab === "media" && <Fotos service={service} />}
          {tab === "pag" && <Pagamento service={service} />}
          {tab === "fat" && <Faturas service={service} />}
          {tab === "aval" && <Avaliacoes service={service} />}
          {tab === "rec" && <Reclamacao service={service} />}
          {tab === "notas" && <Notas service={service} />}
          {tab === "hist" && <Historico service={service} />}
          {tab === "conversa" && <Conversa service={service} />}
        </div>
      </div>
    </div>
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
      <Row label="IVA" value={formatCurrency(service.vatValue)} />
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
      <Row label="IVA" value={formatCurrency(service.vatValue)} />
      <Row label="Receita Piquet" value={formatCurrency(service.piquetRevenue)} />
      <Row label="A pagar ao técnico" value={formatCurrency(service.technicianValue)} />
    </div>
  );
}

function Faturas({ service }: { service: ServiceRequest }) {
  return (
    <div className="space-y-1">
      <Row label="Estado da fatura" value={<StatusBadge status={service.invoiceStatus} />} />
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

function Notas({ service }: { service: ServiceRequest }) {
  const notes = service.internalNotes?.length ? service.internalNotes : ["Sem notas internas registadas."];
  return (
    <div className="space-y-2">
      {notes.map((n, i) => (
        <div key={i} className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">{n}</div>
      ))}
      {/*
        Aqui estava uma caixa com um botão "Guardar" que não guardava. As
        notas internas escrevem-se ao editar o serviço, onde há write-back a
        sério (`internalNotes` em PATCH /api/services/:id).
      */}
      <p className="pt-2 text-xs text-text-secondary">
        Para acrescentar uma nota, usa <strong className="text-text-primary">Editar</strong> no topo do painel.
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
