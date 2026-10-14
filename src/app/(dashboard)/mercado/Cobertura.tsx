"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { Painel } from "@/components/ui/Painel";
import { Barra } from "@/components/ui/Barra";
import { SectionHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useDashboard";
import { getVendorsByCategory, getVendorCoverage, getVendorLiveLocations } from "@/services/vendorsService";

// Leaflet mexe em `window`/`document` na inicialização — sem ssr:false a
// build do Next.js falha (o componente tenta correr no servidor).
const TechnicianMap = dynamic(() => import("@/components/ui/TechnicianMap").then((m) => m.TechnicianMap), { ssr: false });
import { getCoverage, type CoverageTechnician, type CoverageOpenZone } from "@/services/coverageService";
import { Modal } from "@/components/ui/Modal";
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

  // A maior procura da lista, e não a da primeira linha: as zonas sem ninguém
  // vêm à frente mesmo com menos pedidos, e a barra delas enchia-se toda.
  const maisProcura = Math.max(1, ...zonasEmFalta.map((z) => z.procura));
  const maisInteressados = Math.max(1, candidatasOrdenadas[0]?.technicians.length ?? 1);

  return (
    <>
      <div className="space-y-6">
        {/* Sem cobertura declarada não se pode falar de oferta —
            dizê-lo em vez de mostrar zeros que parecem factos. */}
        {coberturaPorMedir && (
          <div className="aviso aviso-atencao">
            <p className="font-medium">Cobertura por medir</p>
            <p className="text-text-secondary mt-1">
              Nenhum técnico declarou zonas na app, por isso a &ldquo;oferta&rdquo; aparece a zero em todas as cidades —
              <b className="text-text-primary"> isso não quer dizer que não haja técnicos lá</b>, quer dizer que não está medido.
              A procura abaixo é real. Para saber quem cobre cada zona, o backend precisa de expor a morada/cidade
              de cada técnico (ver INTEGRACAO_LARAVEL_BACKOFFICE.md).
            </p>
          </div>
        )}

        {/* O que decide: onde falta gente e onde vale a pena abrir. */}
        <StatGroup cols={4}>
          <Stat label="Zonas abertas" value={coberturaResumo.zonasAbertas} />
          <Stat label={coberturaPorMedir ? "Zonas por medir" : "Zonas sem técnicos"} value={coberturaResumo.zonasSemTecnicos}
            tone={!coberturaPorMedir && coberturaResumo.zonasSemTecnicos > 0 ? "mau" : undefined} />
          <Stat label="Cidades candidatas" value={coberturaResumo.candidatas} />
          <Stat label="Técnicos a cobrir zonas" value={coberturaResumo.tecnicosDistintos} />
        </StatGroup>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Onde falta gente — procura acima da oferta, o mais urgente primeiro. */}
          <Painel
            titulo={coberturaPorMedir ? "Onde há mais procura" : "Onde falta gente"}
            descricao={coberturaPorMedir ? "Pedidos de serviço por cidade (dados reais)" : "Zonas com mais pedidos do que técnicos a cobri-las"}
            corpo="p-4 space-y-3.5"
          >
            {zonasEmFalta.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">Sem dados de procura por zona.</p>
            ) : zonasEmFalta.map((z) => (
              <Barra key={z.name} nome={z.name}
                valor={<>{z.procura} pedido{z.procura === 1 ? "" : "s"}{!coberturaPorMedir && ` · ${z.oferta} técnico${z.oferta === 1 ? "" : "s"}`}</>}
                largura={(z.procura / maisProcura) * 100}
                cor={z.oferta === 0 && !coberturaPorMedir ? "bg-danger/80" : "bg-piquet"}
                nota={z.oferta === 0 && !coberturaPorMedir ? <span className="text-danger">Nenhum técnico cobre esta zona</span> : undefined} />
            ))}
          </Painel>

          {/* Onde abrir a seguir — candidatas por interesse declarado. */}
          <Painel titulo="Onde abrir a seguir" descricao="Cidades candidatas, por técnicos interessados"
            aside={<DemoBadge endpoint="/coverage" />} corpo="p-2">
            {candidatasOrdenadas.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">Sem cidades candidatas.</p>
            ) : candidatasOrdenadas.slice(0, 8).map((c) => (
              <button key={c.id} onClick={() => setSelectedArea({ label: c.city, technicians: c.technicians })}
                className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface-subtle/70 transition-colors">
                <Barra
                  nome={<>
                    {c.city}
                    {c.district && <span className="text-text-muted font-normal"> · {c.district}</span>}
                    {!c.active && <span className="ml-1.5 rounded bg-surface-subtle px-1 py-0.5 text-[11px] font-normal text-text-muted">fechada a votos</span>}
                  </>}
                  valor={c.technicians.length}
                  largura={(c.technicians.length / maisInteressados) * 100} />
              </button>
            ))}
          </Painel>
        </div>

        {/* Zonas já abertas — quem as cobre. */}
        <section>
          <SectionHeader title="Zonas abertas"
            description="Cada técnico indica na própria app onde pode atuar. Clica numa zona para ver quem a marcou."
            aside={<DemoBadge endpoint="/coverage" />} />
          <DataTable<CoverageOpenZone>
            columns={[
              { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
              { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
              { key: "technicians", label: "Técnicos", className: "text-right", render: (r) => (
                <span className={cn("tabular-nums font-medium", r.technicians.length === 0 && "text-danger")}>
                  {r.technicians.length}
                </span>
              ) },
              { key: "estado", label: "", className: "text-right", render: (r) => r.technicians.length === 0
                ? <span className="text-xs text-danger">sem cobertura</span>
                : <span className="text-xs text-text-muted group-hover:text-text-primary">Ver técnicos →</span> },
            ]}
            data={zonasAbertasOrdenadas}
            keyField="id"
            onRowClick={(r) => setSelectedArea({ label: r.city, technicians: r.technicians })}
            emptyMessage="Sem zonas abertas"
          />
        </section>

        {/* O mapa (onde estão, agora, os técnicos com localização recente) e,
            ao lado, quantos há por categoria. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <Painel
            titulo="Mapa ao vivo"
            descricao={`${(liveLocations?.length ?? 0) === 0
              ? "Nenhum técnico online com localização recente"
              : `${liveLocations!.length} técnico${liveLocations!.length === 1 ? "" : "s"} online agora`} · atualiza a cada 15 s · não afeta a atribuição`}
            aside={
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={showTestAccounts} onChange={(e) => setShowTestAccounts(e.target.checked)}
                  className="rounded border-surface-border" />
                Contas de teste
              </label>
            }
            corpo="overflow-hidden rounded-b-card"
          >
            <TechnicianMap locations={liveLocations ?? []} />
          </Painel>

          {/* Por categoria: uma lista e não um gráfico circular num separador só para ele. */}
          <Painel titulo="Técnicos por categoria" corpo="">
            {(byCategory ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">Sem dados.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {[...(byCategory ?? [])].sort((a, b) => b.value - a.value).map((c) => (
                  <li key={c.name} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[13px]">
                    <span className="text-text-secondary">{c.name}</span>
                    <span className="font-medium tabular-nums text-text-primary">{c.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
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
            <ul className="card divide-y divide-surface-border">
              {selectedArea.technicians.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{t.name ?? "—"}</p>
                    <p className="text-xs text-text-muted truncate">{t.nif ?? "—"} · {t.phone_number ?? t.email ?? "—"}</p>
                  </div>
                  <StatusBadge status={t.status ?? "Offline"} />
                </li>
              ))}
            </ul>
          )
        )}
      </Modal>
    </>
  );
}
