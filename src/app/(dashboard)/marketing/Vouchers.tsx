"use client";

import { useState } from "react";
import { useAsyncData } from "@/hooks/useDashboard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { toast } from "@/stores";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Plus, TicketPercent } from "lucide-react";
import {
  getVouchers, criarVoucher, alterarVoucher, apagarVoucher,
  type Voucher,
} from "@/services/marketingService";

/**
 * Vouchers — os que existem mesmo.
 *
 * Aqui esteve uma lista de "códigos de desconto" guardada no localStorage do
 * browser, semeada com VERAO25, VOLTEI10, BEMVINDO5 e PRIMAVERA, e com
 * 34.852 € de "receita gerada". Nenhum desses códigos existia: criar um ali
 * não criava nada, e o cliente que o escrevesse na app ouvia que era
 * inválido. Isto lê e escreve na tabela `vouchers` do Laravel — a mesma que a
 * app consulta quando o cliente aplica o código.
 */

const TIPOS = [
  { id: "immediate", label: "Imediatos", ajuda: "Serviços pedidos para agora" },
  { id: "scheduled", label: "Agendados", ajuda: "Serviços marcados para outra altura" },
] as const;

const rotuloTipos = (tipos: string[]) => {
  const nomes = TIPOS.filter((t) => tipos.includes(t.id)).map((t) => t.label);
  return nomes.length === TIPOS.length ? "Todos" : nomes.join(" e ") || "Nenhum";
};

/**
 * O estado que interessa não é `is_active` sozinho: um voucher ligado cuja
 * data de fim passou não funciona, e dizer "Ativo" sobre ele seria falso.
 */
function estadoDe(v: Voucher): { label: string; tom: string; ajuda: string } {
  if (!v.active) {
    return { label: "Desligado", tom: "bg-surface-subtle text-text-secondary", ajuda: "Desligado à mão — o código não é aceite." };
  }
  if (!v.usableToday) {
    return {
      label: "Fora das datas",
      tom: "bg-warning-light text-warning",
      ajuda: "Está ligado, mas hoje está fora do período de validade — o código não é aceite.",
    };
  }
  return { label: "A funcionar", tom: "bg-success-light text-success", ajuda: "O cliente pode usar este código na app agora." };
}

const FORM_VAZIO = {
  name: "",
  discountPercentage: 10,
  startDate: "",
  endDate: "",
  maxUsesPerCustomer: "" as string,
  validServices: ["immediate", "scheduled"] as string[],
};

export function Vouchers() {
  const { data, loading, error, refetch } = useAsyncData(() => getVouchers(), []);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [aGravar, setAGravar] = useState(false);

  const vouchers = data ?? [];
  // Só aparece quando o backend já traz os totais (PR dos descontos).
  const temTotais = vouchers.some((v) => v.discountGiven != null);

  const criar = async () => {
    setAGravar(true);
    try {
      await criarVoucher({
        name: form.name,
        discountPercentage: Number(form.discountPercentage),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        maxUsesPerCustomer: form.maxUsesPerCustomer ? Number(form.maxUsesPerCustomer) : null,
        validServices: form.validServices,
        active: true,
      });
      toast(`Voucher ${form.name.trim().toUpperCase()} criado — já funciona na app.`, "success");
      setAberto(false);
      setForm(FORM_VAZIO);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível criar o voucher.", "error");
    } finally {
      setAGravar(false);
    }
  };

  const alternar = async (v: Voucher) => {
    try {
      await alterarVoucher(v.id, { active: !v.active });
      toast(`${v.name} ${v.active ? "desligado" : "ligado"}.`, v.active ? "info" : "success");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível mudar o estado.", "error");
    }
  };

  const apagar = async (v: Voucher) => {
    const usado = v.usagesCount > 0;
    const aviso = usado
      ? `${v.name} já foi usado ${v.usagesCount} ${v.usagesCount === 1 ? "vez" : "vezes"}. As reservas que o usaram não são afetadas, mas o código deixa de ser aceite. Apagar?`
      : `Apagar o voucher ${v.name}? O código deixa de ser aceite na app.`;
    if (!confirm(aviso)) return;
    try {
      await apagarVoucher(v.id);
      toast(`${v.name} apagado.`, "info");
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível apagar o voucher.", "error");
    }
  };

  const colunas: Column<Voucher>[] = [
    {
      key: "name",
      label: "Código",
      render: (v) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold text-text-primary">{v.name}</p>
          <p className="text-xs text-text-muted">{rotuloTipos(v.validServices)}</p>
        </div>
      ),
    },
    {
      key: "discountPercentage",
      label: "Desconto",
      render: (v) => <span className="tabular-nums font-medium">{v.discountPercentage}%</span>,
    },
    {
      key: "validade",
      label: "Validade",
      render: (v) => {
        if (!v.startDate && !v.endDate) return <span className="text-text-muted">Sem limite de datas</span>;
        return (
          <span className="text-sm">
            {v.startDate ? formatDate(v.startDate) : "desde sempre"}
            {" → "}
            {v.endDate ? formatDate(v.endDate) : "sem fim"}
          </span>
        );
      },
    },
    {
      key: "maxUsesPerCustomer",
      label: "Limite por cliente",
      // NÃO é um limite total: o Laravel conta os usos DAQUELE cliente
      // (Voucher::canBeUsedBy). Chamar-lhe "limite de utilizações", como a
      // lista antiga fazia, dava a entender que o voucher se esgotava.
      render: (v) => (
        <span className="tabular-nums" title="Quantas vezes CADA cliente pode usar este código">
          {v.maxUsesPerCustomer ?? "sem limite"}
        </span>
      ),
    },
    {
      key: "usagesCount",
      label: "Utilizações",
      render: (v) => <span className="tabular-nums">{v.usagesCount}</span>,
    },
    ...(temTotais
      ? [{
          key: "discountGiven",
          label: "Desconto dado",
          render: (v: Voucher) => (
            <span className="tabular-nums" title="Soma do que foi abatido nas reservas que usaram este código">
              {v.discountGiven == null ? "—" : formatCurrency(v.discountGiven)}
            </span>
          ),
        }]
      : []),
    {
      key: "estado",
      label: "Estado",
      render: (v) => {
        const e = estadoDe(v);
        return (
          <span title={e.ajuda} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-help", e.tom)}>
            {e.label}
          </span>
        );
      },
    },
    {
      key: "acoes",
      label: "",
      render: (v) => (
        <div className="flex items-center gap-3">
          <button onClick={() => alternar(v)} className={cn("text-xs hover:underline", v.active ? "text-text-secondary" : "text-success")}>
            {v.active ? "Desligar" : "Ligar"}
          </button>
          <button onClick={() => apagar(v)} className="text-xs text-danger hover:underline">Apagar</button>
        </div>
      ),
    },
  ];

  const tipoLigado = (id: string) => form.validServices.includes(id);
  const alternarTipo = (id: string) =>
    setForm((f) => ({
      ...f,
      validServices: f.validServices.includes(id)
        ? f.validServices.filter((x) => x !== id)
        : [...f.validServices, id],
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary inline-flex items-center gap-2">
          <TicketPercent className="h-4 w-4 text-piquet-600" />
          Códigos que o cliente escreve na app — leem e escrevem no Laravel.
        </p>
        <button onClick={() => setAberto(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo voucher</button>
      </div>

      {error && (
        <p className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-3 py-2 text-sm text-danger">
          {error || "Não foi possível ler os vouchers."}
        </p>
      )}

      {!temTotais && vouchers.length > 0 && (
        <p className="rounded-lg bg-surface-subtle px-3 py-2 text-[11px] text-text-muted">
          A coluna do desconto dado aparece quando o backend passar a somá-lo (PR dos totais dos vouchers). Até lá
          fica-se pelas utilizações, que são reais.
        </p>
      )}

      <DataTable
        columns={colunas}
        data={vouchers}
        keyField="id"
        emptyMessage={loading ? "A ler os vouchers…" : "Ainda não há nenhum voucher criado."}
      />

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Novo voucher"
        footer={<>
          <button onClick={() => setAberto(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={criar} disabled={aGravar} className="btn-primary text-sm disabled:opacity-60">
            {aGravar ? "A criar…" : "Criar voucher"}
          </button>
        </>}
      >
        <div className="space-y-3">
          <Field label="Código" hint="É isto que o cliente escreve na app. Até 30 caracteres.">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              maxLength={30}
              className="input-field font-mono"
              placeholder="OUTONO20"
            />
          </Field>

          <Field label="Desconto (%)" hint="Entre 1 e 100. Só há desconto em percentagem — não há valor fixo.">
            <input
              type="number" min={1} max={100}
              value={form.discountPercentage}
              onChange={(e) => setForm({ ...form, discountPercentage: Number(e.target.value) })}
              className="input-field"
            />
          </Field>

          <Field label="Vale para" hint="Pelo menos um.">
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.ajuda}
                  onClick={() => alternarTipo(t.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    tipoLigado(t.id) ? "bg-piquet text-white" : "bg-surface-subtle text-text-secondary hover:text-text-primary",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início" hint="Vazio = já.">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" />
            </Field>
            <Field label="Fim" hint="Vazio = sem fim.">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" />
            </Field>
          </div>

          <Field
            label="Limite por cliente"
            hint="Quantas vezes CADA cliente pode usar este código. Vazio = sem limite. Não é um limite total."
          >
            <input
              type="number" min={1}
              value={form.maxUsesPerCustomer}
              onChange={(e) => setForm({ ...form, maxUsesPerCustomer: e.target.value })}
              className="input-field"
              placeholder="sem limite"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
