"use client";

import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useDashboard";
import { getAllVendorDocuments, type VendorDocument } from "@/services/vendorDocumentsService";
import { getVendors, type RealVendor } from "@/services/vendorsService";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Eye, Check, X, ChevronRight, FileCheck2 } from "lucide-react";

/**
 * A fila de técnicos à espera de aprovação.
 *
 * A rede de técnicos é o gargalo do negócio, e alargá-la era o processo mais
 * desconfortável do backoffice: os documentos estavam numa tabela e os dados
 * do técnico noutro separador, por isso decidir sobre uma pessoa obrigava a
 * saltar entre ecrãs e a perder o fio.
 *
 * Aqui é uma pessoa de cada vez, com os dados dela ao lado dos documentos
 * dela. Decide-se e passa-se ao seguinte.
 */

export function FilaAprovacao({ onPreview, onAprovar, onRecusar }: {
  onPreview: (d: VendorDocument) => void;
  onAprovar: (d: VendorDocument) => void;
  onRecusar: (d: VendorDocument) => void;
}) {
  const { data: docs, loading } = useAsyncData(() => getAllVendorDocuments("pending"), []);
  const { data: vendors } = useAsyncData(() => getVendors(1, 500), []);
  const [aberto, setAberto] = useState<number | null>(null);

  /*
    Um cartão por técnico, não por documento. Um técnico com quatro documentos
    pendentes era quatro linhas na tabela antiga -- e a decisão é sobre a
    pessoa, não sobre cada ficheiro isolado.
  */
  const fila = useMemo(() => {
    const porTecnico = new Map<number, { nome: string; docs: VendorDocument[] }>();
    for (const d of docs?.items ?? []) {
      const e = porTecnico.get(d.vendor_id) ?? { nome: d.vendor_name ?? `#${d.vendor_id}`, docs: [] };
      e.docs.push(d);
      porTecnico.set(d.vendor_id, e);
    }
    // O mais antigo primeiro: é quem está à espera há mais tempo.
    return [...porTecnico.entries()]
      .map(([id, e]) => ({ id, ...e, desde: e.docs.map((d) => d.created_at ?? "").sort()[0] }))
      .sort((a, b) => (a.desde || "").localeCompare(b.desde || ""));
  }, [docs]);

  const porId = useMemo(
    () => new Map((vendors?.data ?? []).map((v: RealVendor) => [v.id, v])),
    [vendors],
  );

  if (loading && !docs) return <p className="text-sm text-text-muted">A carregar a fila…</p>;
  if (fila.length === 0) {
    return (
      <div className="card p-6 text-center">
        <FileCheck2 className="h-6 w-6 text-success mx-auto mb-2" />
        <p className="text-sm font-medium text-text-primary">Ninguém à espera de aprovação.</p>
        <p className="text-sm text-text-secondary">Os documentos revistos ficam nos separadores ao lado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fila.map((t) => {
        const v = porId.get(t.id);
        const abertoAqui = aberto === t.id;
        const dias = t.desde
          ? Math.floor((Date.now() - Date.parse(t.desde)) / 86_400_000)
          : null;
        return (
          <div key={t.id} className="card overflow-hidden">
            <button
              onClick={() => setAberto(abertoAqui ? null : t.id)}
              className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/40"
            >
              <ChevronRight className={cn("h-4 w-4 text-text-muted shrink-0 transition-transform",
                abertoAqui && "rotate-90")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-text-primary">{t.nome}</span>
                <span className="block truncate text-xs text-text-secondary">
                  {v?.operation_areas?.length ? v.operation_areas.join(" · ") : "sem categorias registadas"}
                </span>
              </span>
              <span className="text-xs text-text-muted shrink-0">
                {t.docs.length} documento{t.docs.length === 1 ? "" : "s"}
              </span>
              {dias != null && (
                <span className={cn("text-xs shrink-0 tabular-nums",
                  dias >= 3 ? "text-warning font-medium" : "text-text-muted")}>
                  {dias === 0 ? "hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}
                </span>
              )}
            </button>

            {abertoAqui && (
              <div className="border-t border-surface-border p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                {/* Os dados da pessoa, ao lado dos documentos dela. */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm content-start">
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold">NIF</dt>
                    <dd className="mt-0.5">{v?.nif || <span className="text-danger">em falta</span>}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold">Telefone</dt>
                    <dd className="mt-0.5">{v?.phone_number || <span className="text-text-muted">—</span>}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold">Empresa</dt>
                    <dd className="mt-0.5">{v?.company_name || <span className="text-text-muted">—</span>}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold">Inscrito</dt>
                    <dd className="mt-0.5">{v?.created_at ? formatDate(v.created_at) : "—"}</dd></div>
                  {/*
                    Sem NIF a Piquet não consegue emitir fatura em nome dele: é
                    um bloqueio de negócio, não um campo em falta qualquer.
                  */}
                  {v && !v.nif && (
                    <p className="col-span-2 text-xs text-danger">
                      Sem NIF não é possível emitir faturas em nome deste técnico.
                    </p>
                  )}
                </dl>

                <ul className="space-y-2">
                  {t.docs.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-surface-border px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-primary">{d.document_type ?? "Documento"}</span>
                        {d.created_at && (
                          <span className="block text-[11px] text-text-muted">enviado a {formatDate(d.created_at)}</span>
                        )}
                      </span>
                      {d.file_url && (
                        <button onClick={() => onPreview(d)}
                          className="btn-secondary text-xs py-1 inline-flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                      )}
                      <button onClick={() => onAprovar(d)}
                        className="btn-primary text-xs py-1 inline-flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </button>
                      <button onClick={() => onRecusar(d)}
                        className="text-xs py-1 px-2 rounded-lg border border-surface-border text-danger hover:bg-danger-light/40 inline-flex items-center gap-1.5">
                        <X className="h-3.5 w-3.5" /> Recusar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
