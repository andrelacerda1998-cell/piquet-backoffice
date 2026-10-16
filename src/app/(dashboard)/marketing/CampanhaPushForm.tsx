"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Users } from "lucide-react";
import { Modal, Field } from "@/components/ui/Modal";
import { toast } from "@/stores";
import { formatNumber } from "@/lib/formatters";
import { useAsyncData } from "@/hooks/useDashboard";
import { getOperationAreas, getServiceTypes } from "@/services/catalogService";
import {
  criarCampanhaPush, editarCampanhaPush, contarPublicoPush, traduzirCampanhaPush, type PushCampaign,
} from "@/services/marketingService";
import {
  CAMPANHA_VAZIA, LIMITES, problemasDaCampanha, publicoDe, temIngles,
  type Alvo, type DadosDaCampanha, type Frequencia, type UnidadeDoIntervalo,
} from "@/lib/campanhasPush";

/** ISO → o valor de um <input type="datetime-local">, na hora de quem está a ver. */
function paraInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** O valor do <input> (hora local) → ISO, para o Laravel. */
function doInput(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Uma campanha gravada (rascunho) → o formulário. */
function dadosDe(c: PushCampaign): DadosDaCampanha {
  return {
    name: c.name,
    title: c.textos?.title ?? { "pt-pt": c.title, en: "" },
    body: c.textos?.body ?? { "pt-pt": c.body, en: "" },
    english_reviewed: !c.ingles_por_rever && temIngles({ title: c.textos?.title ?? { "pt-pt": "", en: "" }, body: c.textos?.body ?? { "pt-pt": "", en: "" } }),
    target_type: (c.target_type as Alvo) ?? "customer",
    user_status: (c.user_status === "online" || c.user_status === "offline") ? c.user_status : null,
    vendor_eligibility: (c.vendor_eligibility === "ready" || c.vendor_eligibility === "incomplete") ? c.vendor_eligibility : null,
    vendor_missing_schedule_address: !!c.vendor_missing_schedule_address,
    customer_never_requested: !!c.customer_never_requested,
    inactive_days: c.inactive_days ?? null,
    open_type: (c.open_type === "OperationArea" || c.open_type === "ServicesType") ? c.open_type : null,
    open_id: c.open_id ?? null,
    frequency_type: (c.frequency_type as Frequencia) ?? "once",
    frequency_value: c.frequency_value ?? null,
    frequency_unit: (c.frequency_unit as UnidadeDoIntervalo) ?? null,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
  };
}

/**
 * Criar ou corrigir um rascunho de campanha de push.
 *
 * Grava sempre DESLIGADA. Enquanto se escreve, conta-se a quantas pessoas
 * chega, com a regra do envio: um público que dá zero ou dez mil vê-se antes
 * de alguém carregar em ligar.
 */
export function CampanhaPushForm({ open, campanha, onClose, onGuardada }: {
  open: boolean;
  /** Um rascunho para corrigir; sem ele, é uma campanha nova. */
  campanha: PushCampaign | null;
  onClose: () => void;
  onGuardada: (c: PushCampaign) => void;
}) {
  const [d, setD] = useState<DadosDaCampanha>(CAMPANHA_VAZIA);
  const [aGuardar, setAGuardar] = useState(false);
  const [aTraduzir, setATraduzir] = useState(false);
  const [pessoas, setPessoas] = useState<number | null>(null);
  const [aContar, setAContar] = useState(false);
  const [erroDaContagem, setErroDaContagem] = useState<string | null>(null);
  const pedidoAtual = useRef(0);

  useEffect(() => {
    if (open) setD(campanha ? dadosDe(campanha) : CAMPANHA_VAZIA);
  }, [open, campanha]);

  const muda = (p: Partial<DadosDaCampanha>) => setD((atual) => ({ ...atual, ...p }));
  const tecnicos = d.target_type !== "customer";
  const clientes = d.target_type !== "vendor";

  // A contagem segue o público, com uma pausa para não perguntar a cada tecla.
  const chaveDoPublico = JSON.stringify(publicoDe(d));
  useEffect(() => {
    if (!open) return;
    const n = ++pedidoAtual.current;
    setAContar(true);
    const t = setTimeout(() => {
      contarPublicoPush(publicoDe(d))
        .then((p) => { if (n === pedidoAtual.current) { setPessoas(p); setErroDaContagem(null); } })
        .catch((e) => { if (n === pedidoAtual.current) { setPessoas(null); setErroDaContagem(e instanceof Error ? e.message : "Não foi possível contar."); } })
        .finally(() => { if (n === pedidoAtual.current) setAContar(false); });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave já resume o público
  }, [open, chaveDoPublico]);

  const { data: areas } = useAsyncData(() => (open && d.open_type === "OperationArea" ? getOperationAreas() : Promise.resolve(null)), [open, d.open_type]);
  const { data: tipos } = useAsyncData(() => (open && d.open_type === "ServicesType" ? getServiceTypes() : Promise.resolve(null)), [open, d.open_type]);
  const destinos = useMemo(() => {
    if (d.open_type === "OperationArea") return (areas?.items ?? []).map((a) => ({ id: a.id, nome: a.name }));
    if (d.open_type === "ServicesType") return (tipos?.items ?? []).map((t) => ({ id: t.id, nome: t.operation_area_name ? `${t.operation_area_name} · ${t.name}` : t.name }));
    return [];
  }, [d.open_type, areas, tipos]);

  const problemas = problemasDaCampanha(d);
  const ingles = temIngles(d);

  const traduzir = async () => {
    setATraduzir(true);
    try {
      const t = await traduzirCampanhaPush(d.title["pt-pt"], d.body["pt-pt"]);
      muda({ title: { ...d.title, en: t.title }, body: { ...d.body, en: t.body }, english_reviewed: false });
      toast("Rascunho do inglês preenchido. Revê-o antes de marcar como revisto.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível traduzir.", "error");
    } finally {
      setATraduzir(false);
    }
  };

  const guardar = async () => {
    if (problemas.length) return;
    setAGuardar(true);
    try {
      const c = campanha ? await editarCampanhaPush(campanha.id, d) : await criarCampanhaPush(d);
      onGuardada(c);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível guardar a campanha.", "error");
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={campanha ? `Corrigir "${campanha.name}"` : "Nova campanha de push"}
      subtitle="Fica guardada desligada. Liga-se depois, na lista, com o número de pessoas outra vez à frente."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted min-w-0">{problemas[0] ?? ""}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} disabled={problemas.length > 0 || aGuardar} className="btn-primary disabled:opacity-40">
              {aGuardar ? "A guardar…" : "Guardar rascunho"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <Field label="Nome da campanha" hint="Só para a equipa: não aparece no telemóvel.">
          <input value={d.name} onChange={(e) => muda({ name: e.target.value })} maxLength={255} className="input-field" placeholder="Ex.: Clientes que nunca pediram — outubro" />
        </Field>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">A mensagem</h3>
          <Field label={`Título (${d.title["pt-pt"].length}/${LIMITES.titulo})`} hint="Curto: o telemóvel corta por volta dos 40 caracteres.">
            <input value={d.title["pt-pt"]} onChange={(e) => muda({ title: { ...d.title, "pt-pt": e.target.value } })} maxLength={LIMITES.titulo} className="input-field" />
          </Field>
          <Field label={`Texto (${d.body["pt-pt"].length}/${LIMITES.texto})`} hint="O telemóvel mostra as primeiras duas ou três linhas.">
            <textarea value={d.body["pt-pt"]} onChange={(e) => muda({ body: { ...d.body, "pt-pt": e.target.value } })} maxLength={LIMITES.texto} rows={3} className="input-field" />
          </Field>

          <details className="rounded-xl border border-surface-border px-3 py-2" open={ingles}>
            <summary className="cursor-pointer text-sm text-text-secondary">Inglês (opcional)</summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-text-muted">Sem inglês, quem tem a app em inglês recebe o português. Com inglês, a campanha só sai depois de alguém o rever.</p>
              <button onClick={traduzir} disabled={aTraduzir || (!d.title["pt-pt"].trim() && !d.body["pt-pt"].trim())} className="btn-secondary text-xs py-1.5 disabled:opacity-40">
                <Languages className="h-3.5 w-3.5" /> {aTraduzir ? "A traduzir…" : "Traduzir do português"}
              </button>
              <Field label="Título em inglês">
                <input value={d.title.en} onChange={(e) => muda({ title: { ...d.title, en: e.target.value }, english_reviewed: false })} maxLength={LIMITES.titulo} className="input-field" />
              </Field>
              <Field label="Texto em inglês">
                <textarea value={d.body.en} onChange={(e) => muda({ body: { ...d.body, en: e.target.value }, english_reviewed: false })} maxLength={LIMITES.texto} rows={3} className="input-field" />
              </Field>
              {ingles && (
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" checked={d.english_reviewed} onChange={(e) => muda({ english_reviewed: e.target.checked })} />
                  Revi o inglês
                </label>
              )}
            </div>
          </details>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">A quem</h3>
          <Field label="Público">
            <select value={d.target_type} onChange={(e) => muda({ target_type: e.target.value as Alvo })} className="input-field">
              <option value="customer">Clientes</option>
              <option value="vendor">Técnicos</option>
              <option value="both">Clientes e técnicos</option>
            </select>
          </Field>
          {tecnicos && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Registo do técnico" hint="Incompleto = ainda não pode aceitar serviços.">
                <select value={d.vendor_eligibility ?? ""} onChange={(e) => muda({ vendor_eligibility: (e.target.value || null) as DadosDaCampanha["vendor_eligibility"] })} className="input-field">
                  <option value="">Todos</option>
                  <option value="ready">Prontos a aceitar serviços</option>
                  <option value="incomplete">Com o registo por acabar</option>
                </select>
              </Field>
              {d.target_type === "vendor" && (
                <Field label="Disponibilidade">
                  <select value={d.user_status ?? ""} onChange={(e) => muda({ user_status: (e.target.value || null) as DadosDaCampanha["user_status"] })} className="input-field">
                    <option value="">Online e offline</option>
                    <option value="online">Só online</option>
                    <option value="offline">Só offline</option>
                  </select>
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm text-text-primary sm:col-span-2">
                <input type="checkbox" checked={d.vendor_missing_schedule_address} onChange={(e) => muda({ vendor_missing_schedule_address: e.target.checked })} />
                Só técnicos sem morada de agendamento
              </label>
            </div>
          )}
          {clientes && (
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={d.customer_never_requested} onChange={(e) => muda({ customer_never_requested: e.target.checked })} />
              Só clientes que nunca pediram um serviço
            </label>
          )}
          <Field label="Sem serviços há (dias)" hint="Vazio = não filtra. No cliente conta o que pediu; no técnico, o que fez.">
            <input type="number" min={1} value={d.inactive_days ?? ""} onChange={(e) => muda({ inactive_days: e.target.value ? Math.max(1, Number(e.target.value)) : null })} className="input-field max-w-[10rem]" />
          </Field>

          <div className="rounded-xl bg-surface-subtle px-4 py-3">
            <p className="text-sm font-medium text-text-primary inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-text-muted" />
              {erroDaContagem ? <span className="text-danger">{erroDaContagem}</span>
                : pessoas === null ? "A contar…"
                : <>Chega a <span className="tabular-nums">{formatNumber(pessoas)}</span> pessoa{pessoas === 1 ? "" : "s"} agora{aContar ? "…" : ""}</>}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Só conta quem tem a app com notificações (um telemóvel registado) e não pediu para não receber. É a mesma conta que o envio faz.
            </p>
          </div>
        </section>

        {clientes && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Ao tocar (clientes)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Abre">
                <select value={d.open_type ?? ""} onChange={(e) => muda({ open_type: (e.target.value || null) as DadosDaCampanha["open_type"], open_id: null })} className="input-field">
                  <option value="">A app</option>
                  <option value="OperationArea">Uma categoria</option>
                  <option value="ServicesType">Um tipo de serviço</option>
                </select>
              </Field>
              {d.open_type && (
                <Field label={d.open_type === "OperationArea" ? "Categoria" : "Tipo de serviço"}>
                  <select value={d.open_id ?? ""} onChange={(e) => muda({ open_id: e.target.value ? Number(e.target.value) : null })} className="input-field">
                    <option value="">Escolher…</option>
                    {destinos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Quando</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Frequência">
              <select
                value={d.frequency_type}
                onChange={(e) => {
                  const f = e.target.value as Frequencia;
                  muda(f === "custom"
                    ? { frequency_type: f, frequency_value: d.frequency_value ?? 1, frequency_unit: d.frequency_unit ?? "days" }
                    : { frequency_type: f, frequency_value: null, frequency_unit: null });
                }}
                className="input-field"
              >
                <option value="once">Uma vez</option>
                <option value="daily">Todos os dias</option>
                <option value="weekly">Todas as semanas</option>
                <option value="custom">De tanto em tanto tempo</option>
              </select>
            </Field>
            {d.frequency_type === "custom" && (
              <Field label="De quanto em quanto" hint="No mínimo uma hora.">
                <div className="flex gap-2">
                  <input type="number" min={1} value={d.frequency_value ?? ""} onChange={(e) => muda({ frequency_value: e.target.value ? Number(e.target.value) : null })} className="input-field w-24" />
                  <select value={d.frequency_unit ?? "days"} onChange={(e) => muda({ frequency_unit: e.target.value as UnidadeDoIntervalo })} className="input-field">
                    <option value="hours">horas</option>
                    <option value="days">dias</option>
                    <option value="minutes">minutos</option>
                  </select>
                </div>
              </Field>
            )}
            <Field label="Começa (opcional)" hint="Vazio = assim que for ligada.">
              <input type="datetime-local" value={paraInput(d.starts_at)} onChange={(e) => muda({ starts_at: doInput(e.target.value) })} className="input-field" />
            </Field>
            <Field label="Acaba (opcional)">
              <input type="datetime-local" value={paraInput(d.ends_at)} onChange={(e) => muda({ ends_at: doInput(e.target.value) })} className="input-field" />
            </Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}
