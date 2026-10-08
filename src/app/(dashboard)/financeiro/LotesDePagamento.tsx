"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { useAsyncData } from "@/hooks/useDashboard";
import { useAuthStore, toast } from "@/stores";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { cn, copiarParaAreaDeTransferencia, downloadCsv } from "@/lib/utils";
import { csvDoLote, podeAprovar, type EstadoLinha, type EstadoLote, type Lote } from "@/lib/lotesPagamento";
import {
  aprovarLote, cancelarLote, conferirExtrato, criarLote, getLotes, pagarLote,
  type ResultadoDaConferencia, type VendorPayment,
} from "@/services/vendorPaymentsService";

/**
 * Pagar técnicos por lotes.
 *
 * O "Pagar" que aqui estava zerava a carteira de um técnico com um clique, sem
 * segunda pessoa e sem nada que provasse que a transferência saiu. Agora:
 *
 *  1. escolhem-se os técnicos e cria-se um lote (fica em rascunho);
 *  2. OUTRA pessoa aprova — quem criou não pode;
 *  3. descarrega-se o ficheiro, fazem-se as transferências no banco;
 *  4. marca-se como pago: só então cada carteira é debitada, pelo valor do lote;
 *  5. confere-se com o extrato do banco, e o que não bater fica à vista.
 */

const RETENCAO: Record<string, string> = {
  iban_missing: "sem IBAN",
  fiscal_address_missing: "sem morada fiscal",
  at_user_missing: "sem acesso AT",
};

const ROTULO_LOTE: Record<EstadoLote, { texto: string; cor: string }> = {
  rascunho: { texto: "À espera de aprovação", cor: "bg-warning-light text-warning" },
  aprovado: { texto: "Aprovado · por transferir", cor: "bg-piquet/15 text-piquet-700" },
  pago: { texto: "Pago", cor: "bg-success-light text-success" },
  cancelado: { texto: "Cancelado", cor: "bg-surface-subtle text-text-muted" },
};

const ROTULO_LINHA: Record<EstadoLinha, { texto: string; cor: string }> = {
  por_pagar: { texto: "Por pagar", cor: "text-text-secondary" },
  a_pagar: { texto: "A pagar… (confirmar à mão se ficar assim)", cor: "text-warning" },
  pago: { texto: "Pago · por conferir no banco", cor: "text-warning" },
  falhou: { texto: "Falhou", cor: "text-danger" },
  confirmado: { texto: "Confirmado no banco", cor: "text-success" },
};

export function LotesDePagamento({ saldos, aCarregar, recarregarSaldos }: {
  saldos: VendorPayment[];
  aCarregar: boolean;
  recarregarSaldos: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const podePagar = !!user && hasPermission(user.role, "pay_technicians");
  const { data, refetch } = useAsyncData(() => getLotes(), []);
  const lotes = useMemo(() => data?.lotes ?? [], [data]);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [conferencia, setConferencia] = useState<ResultadoDaConferencia | null>(null);

  // Quem já está num lote por pagar não pode entrar noutro.
  const emLoteAberto = useMemo(() => new Set(
    lotes.filter((l) => l.estado === "rascunho" || l.estado === "aprovado")
      .flatMap((l) => l.linhas.filter((x) => x.estado !== "pago" && x.estado !== "confirmado").map((x) => x.vendor_id)),
  ), [lotes]);
  const impedimento = (v: VendorPayment) =>
    !v.iban ? "sem IBAN" : v.payout_blocker ? RETENCAO[v.payout_blocker] ?? v.payout_blocker : emLoteAberto.has(v.id) ? "já num lote" : null;
  // "Sem IBAN" já aparece no lugar do IBAN: não se repete ao lado.
  const avisoDe = (v: VendorPayment) => (v.iban ? impedimento(v) : null);
  const elegiveis = saldos.filter((v) => !impedimento(v));
  const totalEscolhido = saldos.filter((v) => escolhidos.has(v.id)).reduce((s, v) => s + v.balance, 0);

  const correr = async (chave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(chave);
    try {
      await fn();
      toast(ok);
      refetch();
      recarregarSaldos();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível.", "error");
    } finally {
      setOcupado(null);
    }
  };

  const criar = () => correr("criar", async () => {
    const linhas = saldos.filter((v) => escolhidos.has(v.id)).map((v) => ({ vendor_id: v.id, valor: v.balance }));
    await criarLote(linhas);
    setEscolhidos(new Set());
  }, "Lote criado. Falta outra pessoa aprová-lo.");

  const lerFicheiro = async (f: File | undefined) => {
    if (!f) return;
    setOcupado("conferir");
    try {
      const r = await conferirExtrato(await f.text());
      setConferencia(r);
      toast(`${r.conferidas} ${r.conferidas === 1 ? "pagamento conferido" : "pagamentos conferidos"} em ${r.movimentos} movimentos.`);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível ler o extrato.", "error");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-6">
      {data && !data.ativo && (
        <p className="rounded-lg border-l-[3px] border-l-warning bg-warning-light/40 px-4 py-3 text-sm text-text-secondary">
          Os lotes de pagamento ainda não estão ativos: falta aplicar a migração <code>20261008120000_payout_lotes</code> no Supabase.
        </p>
      )}

      {/* Saldos por pagar, com seleção para um lote novo */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Saldos por pagar</h2>
          {podePagar && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary text-xs py-1" disabled={elegiveis.length === 0}
                onClick={() => setEscolhidos(escolhidos.size === elegiveis.length ? new Set() : new Set(elegiveis.map((v) => v.id)))}>
                {escolhidos.size === elegiveis.length && elegiveis.length > 0 ? "Limpar seleção" : "Escolher todos os que se podem pagar"}
              </button>
              <button className="btn-primary text-sm" disabled={escolhidos.size === 0 || ocupado === "criar" || !data?.ativo} onClick={criar}>
                {ocupado === "criar" ? "A criar…" : `Criar lote${escolhidos.size ? ` · ${escolhidos.size} · ${formatCurrency(totalEscolhido)}` : ""}`}
              </button>
            </div>
          )}
        </div>
        <div className="card divide-y divide-surface-border">
          {aCarregar && saldos.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">A carregar…</p>
          ) : saldos.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">Sem técnicos com saldo por pagar. 🎉</p>
          ) : saldos.map((v) => {
            const imp = impedimento(v);
            return (
              <label key={v.id} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", imp ? "opacity-60" : "cursor-pointer hover:bg-surface-subtle")}>
                {podePagar && (
                  <input type="checkbox" className="rounded border-surface-border" disabled={!!imp}
                    checked={escolhidos.has(v.id)}
                    onChange={(e) => {
                      const n = new Set(escolhidos);
                      if (e.target.checked) n.add(v.id); else n.delete(v.id);
                      setEscolhidos(n);
                    }} />
                )}
                <span className="font-medium text-text-primary min-w-0 truncate">{v.vendor_name ?? `Técnico ${v.id}`}</span>
                <Iban iban={v.iban} nome={v.vendor_name} />
                {avisoDe(v) && <span className="text-xs text-warning whitespace-nowrap">{avisoDe(v)}</span>}
                <span className="ml-auto font-semibold tabular-nums whitespace-nowrap">{formatCurrency(v.balance)}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Conferir com o banco */}
      {podePagar && data?.ativo && (
        <section className="card p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <FileCheck2 className="h-5 w-5 text-piquet-600" />
            <div className="min-w-0">
              <p className="font-medium text-text-primary">Conferir com o extrato do banco</p>
              <p className="text-xs text-text-secondary">Exporta os movimentos da conta em CSV no homebanking e escolhe o ficheiro. Cada pagamento casa com a transferência do mesmo valor (ao cêntimo), pelo nome ou pelo IBAN do técnico.</p>
            </div>
            <label className={cn("btn-secondary text-sm ml-auto cursor-pointer", ocupado === "conferir" && "opacity-60 pointer-events-none")}>
              {ocupado === "conferir" ? "A conferir…" : "Escolher extrato (CSV)"}
              <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { lerFicheiro(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          {conferencia && conferencia.porConferir.length > 0 && (
            <div className="rounded-lg bg-danger-light/40 px-3 py-2 text-xs">
              <p className="font-medium text-danger">Pagos no backoffice sem transferência no extrato:</p>
              <ul className="mt-1 space-y-0.5 text-text-secondary">
                {conferencia.porConferir.map((l) => (
                  <li key={l.id}>{l.vendor_name ?? "Técnico"} · {formatCurrency(l.valor)}{l.pago_em ? ` · marcado como pago a ${formatDateTime(l.pago_em)}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Os lotes */}
      <section className="space-y-3">
        <h2 className="font-semibold">Lotes</h2>
        {lotes.length === 0 ? (
          <p className="card p-4 text-sm text-text-secondary">Ainda não há lotes de pagamento.</p>
        ) : lotes.map((l) => (
          <CartaoDoLote key={l.id} lote={l} userId={user?.id ?? ""} podePagar={podePagar} ocupado={ocupado}
            aprovar={() => correr(`aprovar:${l.id}`, () => aprovarLote(l.id), "Lote aprovado. Já se podem fazer as transferências.")}
            pagar={() => {
              if (!confirm(`Já fizeste as transferências deste lote (${formatCurrency(l.total)}) no banco?\n\nAo confirmar, cada carteira é debitada pelo valor do lote e cada técnico é avisado de que foi pago.`)) return;
              correr(`pagar:${l.id}`, () => pagarLote(l.id), "Lote marcado como pago.");
            }}
            cancelar={() => {
              if (!confirm("Cancelar este lote? Nenhuma carteira foi debitada.")) return;
              correr(`cancelar:${l.id}`, () => cancelarLote(l.id), "Lote cancelado.");
            }}
          />
        ))}
      </section>
    </div>
  );
}

function Iban({ iban, nome }: { iban: string | null; nome: string | null }) {
  if (!iban) return <span className="text-xs text-text-muted">Sem IBAN</span>;
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="font-mono text-xs text-text-secondary truncate">{iban}</span>
      <button type="button" title="Copiar IBAN" aria-label={`Copiar IBAN de ${nome ?? "técnico"}`}
        onClick={async (e) => {
          e.preventDefault();
          const ok = await copiarParaAreaDeTransferencia(iban.replace(/\s/g, ""));
          toast(ok ? "IBAN copiado." : "Não foi possível copiar o IBAN.", ok ? "success" : "error");
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text-primary shrink-0">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function CartaoDoLote({ lote, userId, podePagar, ocupado, aprovar, pagar, cancelar }: {
  lote: Lote; userId: string; podePagar: boolean; ocupado: string | null;
  aprovar: () => void; pagar: () => void; cancelar: () => void;
}) {
  const rotulo = ROTULO_LOTE[lote.estado];
  const aprovacao = podeAprovar(lote, userId);
  const nadaPago = lote.linhas.every((x) => x.estado === "por_pagar");
  const porConferir = lote.linhas.filter((x) => x.estado === "pago").length;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(lote.total)}</span>
            <span className="text-sm text-text-secondary">· {lote.linhas.length} {lote.linhas.length === 1 ? "técnico" : "técnicos"}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", rotulo.cor)}>{rotulo.texto}</span>
            {lote.estado === "pago" && porConferir > 0 && (
              <span className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning">{porConferir} por conferir no banco</span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Criado por {lote.criado_por_email ?? "—"} a {formatDateTime(lote.criado_em)}
            {lote.aprovado_em && <> · aprovado por {lote.aprovado_por_email ?? "—"} a {formatDateTime(lote.aprovado_em)}</>}
            {lote.pago_em && <> · pago por {lote.pago_por_email ?? "—"} a {formatDateTime(lote.pago_em)}</>}
          </p>
        </div>
        {podePagar && (
          <div className="flex flex-wrap items-center gap-2">
            {lote.estado === "rascunho" && (
              <button className="btn-primary text-xs py-1" onClick={aprovar} disabled={!aprovacao.pode || ocupado === `aprovar:${lote.id}`}
                title={aprovacao.porque}>
                <ShieldCheck className="h-3.5 w-3.5" /> Aprovar
              </button>
            )}
            {lote.estado === "aprovado" && (
              <>
                <button className="btn-secondary text-xs py-1" onClick={() => {
                  const { cabecalho, linhas } = csvDoLote(lote);
                  downloadCsv(`lote-${lote.id.slice(0, 8)}.csv`, cabecalho, linhas);
                }}>
                  <Download className="h-3.5 w-3.5" /> Ficheiro das transferências
                </button>
                <button className="btn-primary text-xs py-1" onClick={pagar} disabled={ocupado === `pagar:${lote.id}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {ocupado === `pagar:${lote.id}` ? "A registar…" : "Já transferi: marcar como pago"}
                </button>
              </>
            )}
            {(lote.estado === "rascunho" || lote.estado === "aprovado") && nadaPago && (
              <button className="btn-secondary text-xs py-1" onClick={cancelar} disabled={ocupado === `cancelar:${lote.id}`}>Cancelar</button>
            )}
          </div>
        )}
      </div>
      {lote.estado === "rascunho" && !aprovacao.pode && aprovacao.porque && (
        <p className="text-xs text-text-secondary">{aprovacao.porque}</p>
      )}
      <ul className="divide-y divide-surface-border rounded-lg border border-surface-border">
        {lote.linhas.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <span className="font-medium text-text-primary">{x.vendor_name ?? `Técnico ${x.vendor_id}`}</span>
            <Iban iban={x.iban} nome={x.vendor_name} />
            <span className={cn("text-xs", ROTULO_LINHA[x.estado].cor)}>
              {ROTULO_LINHA[x.estado].texto}
              {x.erro && <>: {x.erro}</>}
              {x.movimento && <> · {x.movimento.data} · {x.movimento.descricao}</>}
            </span>
            <span className="ml-auto font-semibold tabular-nums">{formatCurrency(x.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
