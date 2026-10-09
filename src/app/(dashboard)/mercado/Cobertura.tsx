"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useDashboard";
import { getVendorsByCategory, getVendorCoverage, getVendorLiveLocations } from "@/services/vendorsService";

// Leaflet mexe em `window`/`document` na inicialização — sem ssr:false a
// build do Next.js falha (o componente tenta correr no servidor).
const TechnicianMap = dynamic(() => import("@/components/ui/TechnicianMap").then((m) => m.TechnicianMap), { ssr: false });
import { getCoverage, type CoverageTechnician, type CoverageOpenZone } from "@/services/coverageService";
import { Modal } from "@/components/ui/Modal";
import { buildMetricValue } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";

/**
 * Cobertura: onde há técnicos, onde falta gente e onde abrir a seguir, mais o
 * mapa de quem está online. Era um separador de Técnicos; passou para Mercado
 * (09/10/2026), ao lado da liquidez -- a oferta e a procura no mesmo sítio.
 */
export default function Cobertura() {
  const { data: byCategory } = useAsyncData(() => getVendorsByCategory(), []);
  const { data: coverage } = useAsyncData(() => getVendorCoverage(), []);
  // Cobertura por técnico — os técnicos declaram na própria app onde
  // podem/querem atuar (POST /vendor/survey/vote); esta vista junta zonas já
  // abertas com quem lá atua e cidades candidatas com quem manifestou
  // interesse (App\Http\Controllers\Api\Admin\CoverageController, sem
  // equivalente direto no Filament, pedido explícito do utilizador 2026-08-10).
  const { data: technicianCoverage } = useAsyncData(() => getCoverage(), []);
  const [selectedArea, setSelectedArea] = useState<{ label: string; technicians: CoverageTechnician[] } | null>(null);

  // Mapa ao vivo — técnicos Online com localização recente (App\Http\
  // Controllers\Api\Admin\VendorController::liveLocations()). Só
  // informativo; não interfere no matching/fluxo de pedidos, esse continua
  // inteiramente na app. Atualiza a cada 15s enquanto esta página está aberta.
  // `showTestAccounts` é um interruptor manual para validar o mapa sem
  // depender de um técnico real estar online — off por omissão.
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const { data: liveLocations, refetch: refetchLiveLocations } = useAsyncData(
    () => getVendorLiveLocations(showTestAccounts),
    [showTestAccounts]
  );
  useEffect(() => {
    const id = setInterval(refetchLiveLocations, 15000);
    return () => clearInterval(id);
  }, [refetchLiveLocations]);

  // Cobertura: o que interessa decidir — onde falta gente e onde abrir a seguir.
  const zonasAbertasOrdenadas = useMemo(() =>
    [...(technicianCoverage?.open ?? [])].sort((a, b) => a.technicians.length - b.technicians.length),
  [technicianCoverage]);
  const candidatasOrdenadas = useMemo(() =>
    [...(technicianCoverage?.candidate ?? [])].sort((a, b) => b.technicians.length - a.technicians.length),
  [technicianCoverage]);
  // A "oferta" vem das zonas que os técnicos declaram na app. Se ninguém
  // declarou, vem tudo a zero — o que NÃO significa que não haja técnicos na
  // zona, significa que não está medido. Distinguir os dois casos evita
  // afirmar "nenhum técnico cobre esta zona" quando não sabemos.
  const coberturaPorMedir = useMemo(() => {
    const zonas = coverage ?? [];
    return zonas.length > 0 && zonas.every((z) => z.oferta === 0);
  }, [coverage]);
  const zonasEmFalta = useMemo(() =>
    [...(coverage ?? [])]
      .filter((z) => z.procura > 0 && (z.oferta === 0 || z.procura > z.oferta))
      .sort((a, b) => (a.oferta === 0 ? -1 : b.oferta === 0 ? 1 : b.procura - a.procura))
      .slice(0, 8),
  [coverage]);
  const coberturaResumo = useMemo(() => {
    const abertas = technicianCoverage?.open ?? [];
    const distintos = new Set<number>();
    for (const z of abertas) for (const t of z.technicians) distintos.add(t.id);
    return {
      zonasAbertas: abertas.length,
      zonasSemTecnicos: abertas.filter((z) => z.technicians.length === 0).length,
      candidatas: (technicianCoverage?.candidate ?? []).length,
      tecnicosDistintos: distintos.size,
    };
  }, [technicianCoverage]);

  return (
    <>
          <div className="space-y-6">
                  <div className="space-y-5">
                    {/* Sem cobertura declarada não se pode falar de oferta —
                        dizê-lo em vez de mostrar zeros que parecem factos. */}
                    {coberturaPorMedir && (
                      <div className="card border-l-[3px] border-l-warning p-4">
                        <p className="font-semibold text-text-primary">Cobertura por medir</p>
                        <p className="text-sm text-text-secondary mt-1">
                          Nenhum técnico declarou zonas na app, por isso a &ldquo;oferta&rdquo; aparece a zero em todas as cidades —
                          <b className="text-text-primary"> isso não quer dizer que não haja técnicos lá</b>, quer dizer que não está medido.
                          A procura abaixo é real. Para saber quem cobre cada zona, o backend precisa de expor a morada/cidade
                          de cada técnico (ver INTEGRACAO_LARAVEL_BACKOFFICE.md).
                        </p>
                      </div>
                    )}

                    {/* O que decide: onde falta gente e onde vale a pena abrir. */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MetricCard title="Zonas abertas" metric={buildMetricValue(coberturaResumo.zonasAbertas, coberturaResumo.zonasAbertas)} hideDelta />
                      <MetricCard title={coberturaPorMedir ? "Zonas por medir" : "Zonas sem técnicos"}
                        metric={buildMetricValue(coberturaResumo.zonasSemTecnicos, coberturaResumo.zonasSemTecnicos)} hideDelta />
                      <MetricCard title="Cidades candidatas" metric={buildMetricValue(coberturaResumo.candidatas, coberturaResumo.candidatas)} hideDelta />
                      <MetricCard title="Técnicos a cobrir zonas" metric={buildMetricValue(coberturaResumo.tecnicosDistintos, coberturaResumo.tecnicosDistintos)} hideDelta />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Onde falta gente — procura acima da oferta, o mais urgente primeiro. */}
                      <div className="card overflow-hidden">
                        <div className="border-b border-surface-border px-4 py-3">
                          <h3 className="font-semibold text-text-primary">
                            {coberturaPorMedir ? "Onde há mais procura" : "Onde falta gente"}
                          </h3>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {coberturaPorMedir
                              ? "Pedidos de serviço por cidade (dados reais)"
                              : "Zonas com mais pedidos do que técnicos a cobri-las"}
                          </p>
                        </div>
                        <div className="p-4 space-y-2.5">
                          {zonasEmFalta.length === 0 ? (
                            <p className="text-sm text-text-muted py-4 text-center">Sem dados de procura por zona.</p>
                          ) : zonasEmFalta.map((z) => (
                            <div key={z.name}>
                              <div className="flex items-baseline justify-between text-sm">
                                <span className="font-medium text-text-primary">{z.name}</span>
                                <span className="text-text-secondary tabular-nums">
                                  {z.procura} pedido{z.procura === 1 ? "" : "s"}
                                  {!coberturaPorMedir && ` · ${z.oferta} técnico${z.oferta === 1 ? "" : "s"}`}
                                </span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                                <div className={cn("h-full rounded-full", z.oferta === 0 ? "bg-danger" : z.ratio > 2 ? "bg-warning" : "bg-piquet")}
                                  style={{ width: `${Math.min(100, (z.procura / Math.max(1, zonasEmFalta[0].procura)) * 100)}%` }} />
                              </div>
                              {z.oferta === 0 && !coberturaPorMedir && (
                                <p className="text-[11px] text-danger mt-0.5">Nenhum técnico cobre esta zona</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Onde abrir a seguir — candidatas por interesse declarado. */}
                      <div className="card overflow-hidden">
                        <div className="flex items-start justify-between gap-2 border-b border-surface-border px-4 py-3">
                          <div>
                            <h3 className="font-semibold text-text-primary">Onde abrir a seguir</h3>
                            <p className="text-xs text-text-secondary mt-0.5">Cidades candidatas, por técnicos interessados</p>
                          </div>
                          <DemoBadge endpoint="/coverage" />
                        </div>
                        <div className="p-4 space-y-2.5">
                          {candidatasOrdenadas.length === 0 ? (
                            <p className="text-sm text-text-muted py-4 text-center">Sem cidades candidatas.</p>
                          ) : candidatasOrdenadas.slice(0, 8).map((c) => (
                            <button key={c.id} onClick={() => setSelectedArea({ label: c.city, technicians: c.technicians })}
                              className="w-full text-left group">
                              <div className="flex items-baseline justify-between text-sm">
                                <span className="font-medium text-text-primary group-hover:text-piquet-700 transition-colors">
                                  {c.city}
                                  {c.district && <span className="text-text-muted font-normal"> · {c.district}</span>}
                                  {!c.active && <span className="ml-1.5 text-[11px] rounded bg-surface-subtle px-1 py-0.5 text-text-muted">fechada a votos</span>}
                                </span>
                                <span className="text-text-secondary tabular-nums">{c.technicians.length}</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                                <div className="h-full rounded-full bg-piquet"
                                  style={{ width: `${Math.min(100, (c.technicians.length / Math.max(1, candidatasOrdenadas[0].technicians.length)) * 100)}%` }} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Zonas já abertas — quem as cobre. */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Zonas abertas</h3>
                        <DemoBadge endpoint="/coverage" />
                      </div>
                      <p className="text-sm text-text-secondary mb-3">
                        Cada técnico indica na própria app onde pode atuar — clica numa zona para ver quem a marcou.
                      </p>
                      <DataTable<CoverageOpenZone>
                        columns={[
                          { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
                          { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
                          { key: "technicians", label: "Técnicos", render: (r) => (
                            <span className={cn("tabular-nums font-medium", r.technicians.length === 0 && "text-danger")}>
                              {r.technicians.length}
                            </span>
                          ) },
                          { key: "estado", label: "", render: (r) => r.technicians.length === 0
                            ? <span className="text-xs text-danger">sem cobertura</span>
                            : <span className="text-xs text-text-muted">ver técnicos →</span> },
                        ]}
                        data={zonasAbertasOrdenadas}
                        keyField="id"
                        onRowClick={(r) => setSelectedArea({ label: r.city, technicians: r.technicians })}
                        emptyMessage="Sem zonas abertas"
                      />
                    </div>

                  </div>

            {/* Por categoria: uma lista e não um gráfico circular num separador só para ele. */}
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-text-primary">Técnicos por categoria</h3>
              {(byCategory ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">Sem dados.</p>
              ) : [...(byCategory ?? [])].sort((a, b) => b.value - a.value).map((c) => (
                <div key={c.name} className="flex items-baseline justify-between text-sm">
                  <span className="text-text-secondary">{c.name}</span>
                  <span className="font-medium tabular-nums text-text-primary">{c.value}</span>
                </div>
              ))}
            </div>

            {/* O mapa: onde estão, agora, os técnicos com localização recente. */}
            <div className="space-y-3">
              <h3 className="font-semibold text-text-primary">Mapa ao vivo</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-secondary">
                        {(liveLocations?.length ?? 0) === 0
                          ? "Nenhum técnico online com localização recente."
                          : `${liveLocations!.length} técnico${liveLocations!.length === 1 ? "" : "s"} online agora`}
                        {" — "}atualiza a cada 15s. Só informativo: não afeta a atribuição de serviços.
                      </p>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showTestAccounts}
                            onChange={(e) => setShowTestAccounts(e.target.checked)}
                            className="rounded border-surface-border"
                          />
                          Mostrar contas de teste
                        </label>
                      </div>
                    </div>
                    <div className="card overflow-hidden">
                      <TechnicianMap locations={liveLocations ?? []} />
                    </div>
                  </div>
            </div>
          </div>

      <Modal
        open={!!selectedArea}
        onClose={() => setSelectedArea(null)}
        title={selectedArea?.label ?? ""}
        subtitle={selectedArea ? `${selectedArea.technicians.length} técnico${selectedArea.technicians.length === 1 ? "" : "s"}` : undefined}
        footer={<button onClick={() => setSelectedArea(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {selectedArea && (
          selectedArea.technicians.length === 0 ? (
            <p className="text-sm text-text-secondary">Ainda nenhum técnico marcou esta área.</p>
          ) : (
            <div className="space-y-2">
              {selectedArea.technicians.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-subtle text-sm">
                  <div>
                    <p className="font-medium">{t.name ?? "—"}</p>
                    <p className="text-text-secondary text-xs">{t.nif ?? "—"} · {t.phone_number ?? t.email ?? "—"}</p>
                  </div>
                  <StatusBadge status={t.status ?? "Offline"} />
                </div>
              ))}
            </div>
          )
        )}
      </Modal>
    </>
  );
}
