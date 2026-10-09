"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";
import type { ServiceRequest } from "@/types";
import { X, Star, Lock, Phone, MessageCircle, ArrowUpRight, Link2, Undo2, Send, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuthStore, toast } from "@/stores";
import { hasPermission } from "@/lib/permissions";
import { refundAppPayment } from "@/services/financeService";
import { MOTIVO_MINIMO } from "@/lib/motivo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HistoricoDaEquipa } from "@/components/ui/HistoricoDaEquipa";
import { getFotosDoCliente, getDetalheDoServico, acaoDoPedido, type FotoDoCliente } from "@/services/dashboardService";
import { DespacharPersonalizado } from "@/components/ui/DespacharPersonalizado";
import type { CandidatoLaravel, DetalheDoServico } from "@/app/api/services/[id]/detalhe/route";
import { comIntervalos, textoDoEvento } from "@/lib/historicoPedido";

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
  // O detalhe lê-se UMA vez: os convites e a cronologia saem da mesma resposta.
  const detalhe = useDetalhe(service.id);

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
        {/* Cabeçalho: o pedido, as duas pessoas e o que se pode fazer. */}
        <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 z-10">
          <div className="mx-auto max-w-[1400px] flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs text-text-muted">#{service.id}</p>
              <h2 className="text-lg font-bold mt-0.5">{service.serviceName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                <StatusBadge status={service.status} label={SERVICE_STATUS_LABELS[service.status]} />
                <span>{[service.city, service.requestedAt && `pedido ${formatDateTime(service.requestedAt)}`].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <AcoesDoPedido service={service} detalhe={detalhe.detalhe} onMudou={() => detalhe.recarregar?.()} />
              <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="mx-auto max-w-[1400px] mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Pessoa
              papel="Cliente"
              nome={service.customerName || "(sem nome)"}
              telefone={detalhe.detalhe?.contactos?.cliente}
              semAcesso={!!detalhe.detalhe && detalhe.detalhe.contactos === null}
              ficha={service.customerId ? fichaHref("/clientes?tab=lista", "cliente", service.customerId, service.customerName) : undefined}
            />
            <Pessoa
              papel="Técnico"
              nome={service.technicianName ?? "Ainda sem técnico"}
              telefone={service.technicianId ? detalhe.detalhe?.contactos?.tecnico : undefined}
              semAcesso={!!service.technicianId && !!detalhe.detalhe && detalhe.detalhe.contactos === null}
              ficha={service.technicianId ? fichaHref("/tecnicos?tab=lista", "tecnico", service.technicianId, service.technicianName) : undefined}
            />
          </div>
          {/*
            Os quatro botões antigos (Avançar estado, Agendar, Cancelar,
            Reembolsar) só mostravam mensagens. Os que estão agora acima fazem
            o que dizem: ligar, abrir a ficha, reembolsar pelo Payshop.
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
          <Seccao titulo="Pedido"><Resumo service={service} /></Seccao>
          {/* Os convites importam enquanto não há técnico; depois ficam fechados. */}
          <Seccao titulo="Técnicos convidados" fechada={!!service.technicianId}><Matching detalhe={detalhe} /></Seccao>
          <Seccao titulo="Cronologia"><Cronologia service={service} detalhe={detalhe} /></Seccao>
          <Seccao titulo="Dinheiro"><Pagamento service={service} /></Seccao>
          <Seccao titulo="Fotos do cliente"><Fotos service={service} /></Seccao>
          {/*
            Avaliação e reclamação num cartão só: são as duas o que o cliente
            achou no fim e, na esmagadora maioria dos serviços, são as duas
            uma frase a dizer que não há. Dois cartões para duas frases era o
            desperdício mais visível deste ecrã.
          */}
          <Seccao titulo="O que o cliente achou">
            {!service.rating && !service.hasComplaint ? (
              <p className="text-sm text-text-muted">Sem avaliação nem reclamação.</p>
            ) : (
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
            )}
          </Seccao>
          <Seccao titulo="Histórico da equipa"><HistoricoDaEquipa key={detalhe.versao} entidade="pedido" id={service.id} /></Seccao>
          <Seccao titulo="Conversa" fechada><Conversa service={service} /></Seccao>
        </div>
      </div>
    </div>
  );
}

/**
 * Um bloco do ecrã, com título. Substitui um separador. `fechada` mostra só
 * o título até alguém o abrir: para o que raramente interessa naquele pedido.
 */
function Seccao({ titulo, children, fechada = false }: { titulo: string; children: React.ReactNode; fechada?: boolean }) {
  const h3 = "text-xs font-semibold uppercase tracking-[0.14em] text-text-muted";
  if (fechada) {
    return (
      <details className="card p-4 mb-5 break-inside-avoid group">
        <summary className={cn(h3, "cursor-pointer select-none list-none flex items-center justify-between")}>
          {titulo}<span className="normal-case tracking-normal font-normal text-text-secondary group-open:hidden">Mostrar</span>
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  }
  return (
    <section className="card p-4 mb-5 break-inside-avoid">
      <h3 className={cn(h3, "mb-3")}>{titulo}</h3>
      {children}
    </section>
  );
}

/** O endereço que abre a ficha de um cliente ou técnico na sua página. */
function fichaHref(base: string, chave: string, id: string, nome?: string): string {
  const url = new URL(base, "http://x");
  url.searchParams.set(chave, id);
  if (nome?.trim()) url.searchParams.set("q", nome.trim());
  return url.pathname + url.search;
}

/** Só os dígitos, com o indicativo de Portugal quando o número vem sem ele. */
function paraWhatsApp(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  return d.length === 9 ? `351${d}` : d;
}

/** Uma das duas pessoas do pedido: nome, telefone e como lhe chegar. */
function Pessoa({ papel, nome, telefone, semAcesso, ficha }: {
  papel: string; nome: string; telefone?: string | null; semAcesso?: boolean; ficha?: string;
}) {
  const botao = "inline-flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-xs font-medium hover:bg-surface-muted";
  return (
    <div className="rounded-lg border border-surface-border px-3 py-2 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">{papel}</p>
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-text-primary truncate">{nome}</p>
          {telefone
            ? <p className="text-sm text-text-secondary select-all tabular-nums">{telefone}</p>
            : semAcesso
              ? <p className="text-xs text-text-muted">O teu perfil não vê contactos.</p>
              : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {telefone && <a href={`tel:${telefone.replace(/\s/g, "")}`} className={botao}><Phone className="h-3.5 w-3.5" /> Ligar</a>}
          {telefone && (
            <a href={`https://wa.me/${paraWhatsApp(telefone)}`} target="_blank" rel="noreferrer" className={botao}>
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          )}
          {ficha && <Link href={ficha} className={botao}>Ficha <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
        </div>
      </div>
    </div>
  );
}

/**
 * Reembolsar (pelo Payshop, com motivo registado) e copiar a ligação do
 * pedido. O reembolso só aparece a quem gere dinheiro, num pedido cobrado e
 * ligado a um pagamento; o Laravel recusa na mesma se o serviço ainda estiver
 * vivo, e a mensagem dele diz porquê.
 */
function AcoesDoPedido({ service, detalhe, onMudou }: { service: ServiceRequest; detalhe: DetalheDoServico | null; onMudou: () => void }) {
  const role = useAuthStore((s) => s.user?.role);
  const [aReembolsar, setAReembolsar] = useState(false);
  const [aDespachar, setADespachar] = useState(false);
  const [acao, setAcao] = useState<"fechar" | "tentar-cobrar" | "desistir-e-devolver" | null>(null);
  const uuid = detalhe?.pagamentoUuid;
  const gereDinheiro = !!role && hasPermission(role, "refund_payments");
  const podeReembolsar = !!uuid && gereDinheiro && service.paymentStatus === "pago";
  /*
    As ações que dependem do estado no Laravel (backend #165):
    - personalizado à espera da Piquet → Despachar;
    - técnico terminou e o cliente não confirmou (Finished) → Fechar, que cobra
      e paga ao técnico (o dinheiro ainda está só cativo, por isso não há
      "reembolsar" aqui);
    - cobrança falhada (ClosedPendingPayment) → Tentar cobrar, ou Desistir e
      devolver.
  */
  const estado = detalhe?.estadoLaravel;
  const podeDespachar = estado === "PendingReview" && !!detalhe?.personalizado && !!role && hasPermission(role, "edit_services");
  const podeFechar = estado === "Finished" && gereDinheiro;
  const porCobrar = estado === "ClosedPendingPayment" && gereDinheiro;

  const correr = async (motivo?: string) => {
    if (!acao) return;
    try {
      const r = await acaoDoPedido(service.id, acao, { motivo });
      const fechou = r.status === "Closed";
      toast(acao === "desistir-e-devolver" ? "Cobrança abandonada e dinheiro devolvido ao cliente."
        : fechou ? "Cobrado e fechado: o técnico já recebeu."
        : "O Payshop não aceitou a cobrança: o pedido ficou em pagamento por capturar.", fechou || acao === "desistir-e-devolver" ? "success" : "error");
      setAcao(null);
      onMudou();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível concluir.", "error");
    }
  };

  const copiar = async () => {
    const url = `${window.location.origin}/servicos?servico=${encodeURIComponent(service.id)}`;
    try { await navigator.clipboard.writeText(url); toast("Ligação do pedido copiada."); }
    catch { toast(url, "info"); }
  };

  return (
    <>
      <button onClick={copiar} className="btn-secondary text-xs py-1.5" title="Copiar a ligação deste pedido">
        <Link2 className="h-3.5 w-3.5" /> Copiar ligação
      </button>
      {podeDespachar && (
        <button onClick={() => setADespachar(true)} className="btn-primary text-xs py-1.5">
          <Send className="h-3.5 w-3.5" /> Despachar
        </button>
      )}
      {podeFechar && (
        <button onClick={() => setAcao("fechar")} className="btn-primary text-xs py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Fechar e cobrar
        </button>
      )}
      {porCobrar && (
        <>
          <button onClick={() => setAcao("tentar-cobrar")} className="btn-primary text-xs py-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar cobrar
          </button>
          <button onClick={() => setAcao("desistir-e-devolver")} className="btn-secondary text-xs py-1.5 text-danger">
            <Undo2 className="h-3.5 w-3.5" /> Desistir e devolver
          </button>
        </>
      )}
      {podeReembolsar && (
        <button onClick={() => setAReembolsar(true)} className="btn-secondary text-xs py-1.5 text-danger">
          <Undo2 className="h-3.5 w-3.5" /> Reembolsar
        </button>
      )}
      {detalhe?.personalizado && (
        <DespacharPersonalizado
          open={aDespachar}
          onClose={() => setADespachar(false)}
          servicoId={service.id}
          descricao={detalhe.personalizado.descricao}
          categoriasDoCliente={detalhe.personalizado.categorias}
          onDespachado={onMudou}
        />
      )}
      <ConfirmDialog
        open={acao !== null}
        onClose={() => setAcao(null)}
        onConfirm={correr}
        title={acao === "fechar" ? `Fechar e cobrar o pedido #${service.id}?`
          : acao === "tentar-cobrar" ? `Tentar cobrar de novo o pedido #${service.id}?`
          : `Desistir da cobrança do pedido #${service.id}?`}
        tone={acao === "desistir-e-devolver" ? "danger" : "default"}
        confirmLabel={acao === "fechar" ? "Fechar e cobrar" : acao === "tentar-cobrar" ? "Tentar cobrar" : "Desistir e devolver"}
        description={
          acao === "fechar" ? <>O técnico deu o trabalho por terminado e o cliente não confirmou. Vais cobrar <b className="text-text-primary">{formatCurrency(service.totalCustomerValue)}</b> ao cliente e pagar ao técnico. Se o Payshop recusar, o pedido fica em pagamento por capturar.</>
          : acao === "tentar-cobrar" ? <>Volta a pedir ao Payshop a cobrança de <b className="text-text-primary">{formatCurrency(service.totalCustomerValue)}</b>. Se passar, o pedido fecha e o técnico recebe.</>
          : <>A cobrança não passa. O pedido é cancelado, o cliente recebe de volta o crédito e a pré-autorização, e o técnico <b className="text-text-primary">não</b> é pago. Não se desfaz.</>
        }
        requireReason={acao !== "tentar-cobrar"}
        minReason={MOTIVO_MINIMO}
        reasonLabel={acao === "fechar" ? "Porque é que estás a fechar sem o cliente confirmar?" : "Porque é que estás a desistir da cobrança?"}
        reasonPlaceholder={acao === "fechar" ? "Ex.: cliente confirmou por telefone que o trabalho ficou feito" : "Ex.: cartão recusado três vezes; cliente sem outro meio de pagamento"}
      />
      <ConfirmDialog
        open={aReembolsar}
        onClose={() => setAReembolsar(false)}
        onConfirm={async (motivo) => {
          if (!uuid || !motivo) return;
          try {
            await refundAppPayment(uuid, motivo, { servicoId: service.id });
            toast(`Reembolso de ${formatCurrency(service.totalCustomerValue)} enviado ao Payshop.`);
            setAReembolsar(false);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Erro ao reembolsar.", "error");
          }
        }}
        title={`Reembolsar o pedido #${service.id}?`}
        tone="danger"
        confirmLabel="Reembolsar"
        description={
          <>
            Vais devolver <b className="text-text-primary">{formatCurrency(service.totalCustomerValue)}</b> a{" "}
            <b className="text-text-primary">{service.customerName || "este cliente"}</b>, pelo mesmo meio de pagamento.
            O dinheiro sai da conta da Piquet e não se desfaz. Se o pedido ainda estiver a decorrer, o Payshop não deixa:
            primeiro tem de ser cancelado na app.
          </>
        }
        requireReason
        minReason={MOTIVO_MINIMO}
        reasonLabel="Porque é que estás a reembolsar?"
        reasonPlaceholder="Ex.: cobrança em duplicado; serviço não realizado por falta do técnico"
      />
    </>
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

/*
  Cada valor aparece uma vez no painel. O cliente e o técnico estão no
  cabeçalho; o dinheiro está em "Dinheiro". Saíram daqui a "Categoria" (o
  Laravel manda o mesmo nome em categoria e serviço) e a "Origem", que é
  sempre "app" -- só se mostra quando é outra.
*/
function Resumo({ service }: { service: ServiceRequest }) {
  const local = [service.location, service.city].filter(Boolean).join(", ");
  return (
    <div className="space-y-1">
      <Row label="Serviço" value={service.serviceName} />
      {service.categoryName && service.categoryName !== service.serviceName && <Row label="Categoria" value={service.categoryName} />}
      <Row label="Morada" value={local || "—"} />
      {service.scheduledAt && <Row label="Marcado para" value={service.scheduledAt.length > 10 ? formatDateTime(service.scheduledAt) : formatDate(service.scheduledAt)} />}
      {service.cancellationReason && <Row label="Motivo do cancelamento" value={service.cancellationReason} />}
      {service.source && service.source.toLowerCase() !== "app" && <Row label="Origem" value={service.source} />}
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
type EstadoDoDetalhe = { detalhe: DetalheDoServico | null; erro: string | null; aCarregar: boolean; recarregar?: () => void; versao?: number };

/** O detalhe do serviço (convites e histórico), lido uma vez por painel. */
function useDetalhe(id: string): EstadoDoDetalhe {
  const [estado, setEstado] = useState<EstadoDoDetalhe>({ detalhe: null, erro: null, aCarregar: true });
  // Depois de uma ação (despachar, fechar…) o pedido lê-se outra vez.
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado({ detalhe: null, erro: null, aCarregar: true });
    getDetalheDoServico(id)
      .then((d) => vivo && setEstado({ detalhe: d, erro: null, aCarregar: false }))
      .catch((e) => vivo && setEstado({ detalhe: null, erro: e instanceof Error ? e.message : "Não foi possível ler o serviço.", aCarregar: false }));
    return () => { vivo = false; };
  }, [id, versao]);
  return { ...estado, recarregar: () => setVersao((v) => v + 1), versao };
}

function Matching({ detalhe: { detalhe, erro, aCarregar } }: { detalhe: EstadoDoDetalhe }) {
  const lista = detalhe?.candidatos ?? [];
  if (erro) return <p className="text-sm text-danger">{erro}</p>;
  if (aCarregar) return <p className="text-sm text-text-muted">A carregar…</p>;
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

/**
 * O caminho do pedido.
 *
 * Com o histórico do Laravel (pedidos a partir de 08/10/2026): cada passo, a
 * hora, e quanto tempo passou desde o anterior — é aqui que se vê quanto
 * esteve à procura ou quanto o técnico demorou a sair. Sem ele, a versão
 * aproximada de antes, dita como tal: o "técnico atribuído" usava a hora do
 * pedido porque não havia outra.
 */
function Cronologia({ service, detalhe: { detalhe, aCarregar } }: { service: ServiceRequest; detalhe: EstadoDoDetalhe }) {
  const eventos = detalhe?.eventos ?? [];
  if (aCarregar) return <p className="text-sm text-text-muted">A carregar…</p>;

  if (eventos.length > 0) {
    return (
      <ol className="relative border-l border-surface-border ml-2 space-y-4">
        {comIntervalos(eventos).map((e, i) => {
          const { titulo, detalhe: pormenor } = textoDoEvento(e);
          return (
            <li key={i} className="ml-4">
              <span className={cn("absolute -left-1.5 h-3 w-3 rounded-full border-2 border-surface", e.tipo === "estado" || e.tipo === "criado" ? "bg-piquet" : "bg-surface-strong")} />
              <p className="text-sm font-medium text-text-primary">{titulo}</p>
              <p className="text-xs text-text-muted">
                {formatDateTime(e.em)}
                {pormenor && <> · {pormenor}</>}
                {e.segundosDesdeAnterior != null && e.segundosDesdeAnterior >= 60 && <> · +{duracaoCurta(e.segundosDesdeAnterior)}</>}
              </p>
            </li>
          );
        })}
      </ol>
    );
  }

  const steps = [
    step("Pedido recebido", service.requestedAt),
    step("Agendado", service.scheduledAt),
    step("Serviço iniciado", service.startedAt),
    step("Serviço concluído", service.completedAt),
  ].filter((s) => s.at);

  return (
    <div className="space-y-3">
      <ol className="relative border-l border-surface-border ml-2 space-y-6">
        {steps.map((s, i) => (
          <li key={i} className="ml-4">
            <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-piquet border-2 border-surface" />
            <p className="text-sm font-medium text-text-primary">{s.label}</p>
            <p className="text-xs text-text-muted">{s.at ? formatDateTime(s.at) : "—"}</p>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-text-muted">Cronologia aproximada: o histórico completo de cada pedido só existe a partir de 08/10/2026.</p>
    </div>
  );
}

/** "3 min", "2 h 10 min", "1 d 4 h". */
function duracaoCurta(segundos: number): string {
  const m = Math.round(segundos / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ""}`;
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
      <p className="text-sm text-text-muted">Sem fotografias (o cliente anexa-as no checkout, se quiser).</p>
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
      <Row label="Pagamento" value={<StatusBadge status={service.paymentStatus} />} />
      <Row label="Cobrado ao cliente" value={formatCurrency(service.totalCustomerValue)} />
      <Row label="Comissão Piquet" value={formatCurrency(service.piquetRevenue)} />
      <Row label="Para o técnico" value={formatCurrency(service.technicianValue)} />
      {service.vatValue != null && <Row label="IVA" value={formatCurrency(service.vatValue)} />}
      {/* O Laravel ainda não envia o estado da fatura: sem ele não há linha. */}
      {service.invoiceStatus && <Row label="Fatura" value={<StatusBadge status={service.invoiceStatus} />} />}
    </div>
  );
}

/*
  "Faturas" era um cartão próprio que repetia a data do pedido e o total, e
  tinha um número de fatura inventado. O estado da fatura (quando vier) está
  em "Dinheiro"; o número e o PDF são do InvoiceXpress e não chegam cá.
*/

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
        O que o cliente disse está no ticket, em Suporte, com o número do pedido no assunto.
      </p>
      <Link href="/suporte" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-danger hover:underline">
        Abrir Suporte <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
