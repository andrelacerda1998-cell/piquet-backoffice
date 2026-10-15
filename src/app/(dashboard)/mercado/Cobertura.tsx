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
import { getVendorsByCategory, getVendorCoverage, getVendorLiveLocations, type ProcuraEOferta } from "@/services/vendorsService";
import { notaDaContagem, porMedir, resumoDasContagens } from "@/lib/pelasCidades";
import { Etiqueta } from "@/components/ui/Ficha";

// Leaflet mexe em `window`/`document` na inicialização — sem ssr:false a
// build do Next.js falha (o componente tenta correr no servidor).
const TechnicianMap = dynamic(() => import("@/components/ui/TechnicianMap").then((m) => m.TechnicianMap), { ssr: false });
import { getCoverage, type CoverageTechnician, type CoverageOpenZone } from "@/services/coverageService";
import { Modal } from "@/components/ui/Modal";
import { DemoBadge } from "@/components/ui/DemoBadge";

/** Quem conta numa zona: pelas cidades escolhidas na app ou, antes do backend#185, o questionário. */
function tecnicosDaZona(z: CoverageOpenZone): Array<CoverageTechnician & { podem_trabalhar?: boolean }> {
  return z.nas_cidades?.tecnicos ?? z.technicians;
}

/** Fora do catálogo não há centro para medir: o zero não quer dizer nada. */
function zonaPorMedir(z: CoverageOpenZone): boolean {
  return porMedir(z.nas_cidades?.contagem);
}

/** A oferta pelas cidades escolhidas quando o backend a manda; senão, a do questionário. */
function ofertaDe(z: ProcuraEOferta): number {
  return z.oferta_cidades ?? z.oferta;
}

/**
 * Cobertura: onde há técnicos, onde falta gente e onde abrir a seguir, mais o
 * mapa de quem está online. Era um separador de Técnicos; passou para Mercado
 * (09/10/2026), ao lado da liquidez -- a oferta e a procura no mesmo sítio.
 */
export default function Cobertura() {
  const { data: byCategory } = useAsyncData(() => getVendorsByCategory(), []);
  const { data: coverage } = useAsyncData(() => getVendorCoverage(), []);
  // Cobertura por técnico (App\Http\Controllers\Api\Admin\CoverageController,
  // sem equivalente direto no Filament, pedido do utilizador a 2026-08-10): as
  // zonas abertas com quem lá recebe pedidos e as cidades candidatas, com quem
  // mostrou interesse no questionário antigo.
  const { data: technicianCoverage } = useAsyncData(() => getCoverage(), []);
  const [selectedArea, setSelectedArea] = useState<{
    label: string;
    technicians: Array<CoverageTechnician & { podem_trabalhar?: boolean }>;
    vazio: string;
    porMedir?: boolean;
  } | null>(null);

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

  /*
    Desde o backend#185 as zonas contam pelas cidades que cada técnico escolhe
    na app -- a regra com que os pedidos são distribuídos (ver
    lib/pelasCidades). Antes disso só há o questionário antigo, que parou no
    tempo, e o ecrã mostra-o como até aqui. Cada pedido ao backend é detetado
    à parte: os dois podem chegar em alturas diferentes.
  */
  const pelasCidades = (technicianCoverage?.open ?? []).some((z) => z.nas_cidades !== undefined);
  const ofertaPelasCidades = (coverage?.cidades ?? []).some((z) => z.oferta_cidades !== undefined);
  const foraDasCidades = coverage?.foraDasCidades ?? 0;
  const semCidades = technicianCoverage?.sem_cidades;

  // As zonas com menos gente primeiro; as que não dá para medir no fim.
  const zonasAbertasOrdenadas = useMemo(() =>
    [...(technicianCoverage?.open ?? [])].sort((a, b) =>
      (zonaPorMedir(a) ? Number.MAX_SAFE_INTEGER : tecnicosDaZona(a).length) - (zonaPorMedir(b) ? Number.MAX_SAFE_INTEGER : tecnicosDaZona(b).length)),
  [technicianCoverage]);
  const candidatasOrdenadas = useMemo(() =>
    [...(technicianCoverage?.candidate ?? [])].sort((a, b) => b.technicians.length - a.technicians.length),
  [technicianCoverage]);
  // A "oferta" do questionário: se ninguém declarou, vem tudo a zero — o que
  // NÃO significa que não haja técnicos na zona, significa que não está
  // medido. Pelas cidades escolhidas há sempre medida, e isto não se aplica.
  const coberturaPorMedir = useMemo(() => {
    const zonas = coverage?.cidades ?? [];
    return !ofertaPelasCidades && zonas.length > 0 && zonas.every((z) => z.oferta === 0);
  }, [coverage, ofertaPelasCidades]);
  // Onde falta gente: primeiro onde não há ninguém, depois onde não se sabe
  // (cidade fora do catálogo), depois onde há mais procura do que técnicos.
  const zonasEmFalta = useMemo(() => {
    const ordem = (z: ProcuraEOferta) => (porMedir(z.contagem) ? 1 : ofertaDe(z) === 0 ? 0 : 2);
    return [...(coverage?.cidades ?? [])]
      .filter((z) => z.procura > 0 && (porMedir(z.contagem) || ofertaDe(z) === 0 || z.procura > ofertaDe(z)))
      .sort((a, b) => ordem(a) - ordem(b) || b.procura - a.procura)
      .slice(0, 8);
  }, [coverage]);
  const coberturaResumo = useMemo(() => {
    const abertas = technicianCoverage?.open ?? [];
    const distintos = new Set<number>();
    const prontos = new Set<number>();
    for (const z of abertas) {
      for (const t of tecnicosDaZona(z)) {
        distintos.add(t.id);
        if (t.podem_trabalhar) prontos.add(t.id);
      }
    }
    return {
      zonasAbertas: abertas.length,
      zonasSemTecnicos: abertas.filter((z) => !zonaPorMedir(z) && tecnicosDaZona(z).length === 0).length,
      candidatas: (technicianCoverage?.candidate ?? []).length,
      tecnicosDistintos: distintos.size,
      prontosDistintos: prontos.size,
    };
  }, [technicianCoverage]);
  const rodapeDasZonas = pelasCidades
    ? resumoDasContagens((technicianCoverage?.open ?? []).map((z) => z.nas_cidades?.contagem), { um: "zona", varios: "zonas" })
    : [];
  const comProntos = (byCategory ?? []).some((c) => c.podem_trabalhar !== undefined);
  const prontosPelaAt = (byCategory ?? []).some((c) => c.podem_trabalhar_com_at !== undefined);

  // A maior procura da lista, e não a da primeira linha: as zonas sem ninguém
  // vêm à frente mesmo com menos pedidos, e a barra delas enchia-se toda.
  const maisProcura = Math.max(1, ...zonasEmFalta.map((z) => z.procura));
  const maisInteressados = Math.max(1, candidatasOrdenadas[0]?.technicians.length ?? 1);

  const abrirZona = (z: CoverageOpenZone) => setSelectedArea({
    label: z.city,
    technicians: tecnicosDaZona(z),
    porMedir: zonaPorMedir(z),
    vazio: !pelasCidades
      ? "Ainda nenhum técnico marcou esta área no questionário."
      : zonaPorMedir(z)
        ? "Esta cidade não está no catálogo da app: nenhum técnico a pode escolher, e sem o centro dela não dá para saber quem a cobre."
        : "Nenhum técnico escolheu na app uma cidade que cubra esta zona.",
  });

  return (
    <>
      <div className="space-y-6">
        {/*
          De onde vêm as zonas e as cidades candidatas. O questionário da app
          do técnico (vendor_allowed_zones, vendor_city_votes) deixou de existir:
          a app grava agora as cidades por /vendor/cities, que é o que o
          matching usa. Sem isto dito, "nenhum técnico cobre esta zona" lia-se
          como facto.
        */}
        {pelasCidades ? (
          <div className="aviso aviso-info">
            <p className="font-medium">Contado pelas cidades que cada técnico escolhe na app</p>
            <p className="text-text-secondary mt-1">
              É a regra com que os pedidos são distribuídos: em cada zona conta quem recebe um pedido no centro da cidade.
              {semCidades && semCidades.tecnicos > 0 && <>
                {" "}{semCidades.tecnicos} técnico{semCidades.tecnicos === 1 ? " ainda não escolheu" : "s ainda não escolheram"} cidades
                ({semCidades.podem_trabalhar} pronto{semCidades.podem_trabalhar === 1 ? "" : "s"} a trabalhar): não {semCidades.tecnicos === 1 ? "conta" : "contam"} em
                nenhuma zona, e o matching manda-{semCidades.tecnicos === 1 ? "lhe" : "lhes"} pedidos de qualquer uma.
              </>}
              {" "}As cidades candidatas ainda vêm do questionário antigo, que a app já não mostra.
            </p>
          </div>
        ) : (
          <div className="aviso aviso-info">
            <p className="font-medium">As zonas e as cidades candidatas vêm do questionário antigo da app do técnico</p>
            <p className="text-text-secondary mt-1">
              A app já não o mostra: só contam os técnicos que responderam antes da mudança. Quem recebe pedidos é decidido
              pelas cidades que cada técnico escolhe hoje na app, que ainda não aparecem aqui. A procura (pedidos por cidade) é real.
            </p>
          </div>
        )}

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
        {pelasCidades ? (
          <StatGroup cols={4}>
            <Stat label="Zonas abertas" value={coberturaResumo.zonasAbertas} />
            <Stat label="Zonas sem técnicos" value={coberturaResumo.zonasSemTecnicos} note="nas cidades escolhidas"
              tone={coberturaResumo.zonasSemTecnicos > 0 ? "mau" : undefined} />
            <Stat label="Técnicos nas zonas" value={coberturaResumo.tecnicosDistintos}
              note={`${coberturaResumo.prontosDistintos} prontos a trabalhar`} />
            <Stat label="Sem cidades escolhidas" value={semCidades?.tecnicos ?? "—"} note="recebem de qualquer zona" />
          </StatGroup>
        ) : (
          <StatGroup cols={4}>
            <Stat label="Zonas abertas" value={coberturaResumo.zonasAbertas} />
            <Stat label={coberturaPorMedir ? "Zonas por medir" : "Zonas sem respostas"} value={coberturaResumo.zonasSemTecnicos}
              note="no questionário" />
            <Stat label="Cidades candidatas" value={coberturaResumo.candidatas} />
            <Stat label="No questionário" value={coberturaResumo.tecnicosDistintos} note="técnicos" />
          </StatGroup>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Onde falta gente — procura acima da oferta, o mais urgente primeiro. */}
          <Painel
            titulo={coberturaPorMedir ? "Onde há mais procura" : "Onde falta gente"}
            descricao={coberturaPorMedir
              ? "Pedidos de serviço por cidade (dados reais)"
              : ofertaPelasCidades
                ? "Pedidos por cidade e quantos técnicos a cobrem, pelas cidades que escolheram na app"
                : "Pedidos por cidade e quantos técnicos a marcaram no questionário"}
            corpo="p-4 space-y-3.5"
          >
            {zonasEmFalta.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">Sem dados de procura por zona.</p>
            ) : zonasEmFalta.map((z) => {
              const oferta = ofertaDe(z);
              const semMedida = porMedir(z.contagem);
              return (
                <Barra key={`${z.name}·${z.district ?? ""}`} nome={z.name}
                  valor={<>
                    {z.procura} pedido{z.procura === 1 ? "" : "s"}
                    {semMedida ? " · por medir" : !coberturaPorMedir && ` · ${oferta} técnico${oferta === 1 ? "" : "s"}`}
                    {ofertaPelasCidades && !semMedida && oferta > 0 && ` (${z.podem_trabalhar ?? 0} pronto${z.podem_trabalhar === 1 ? "" : "s"})`}
                  </>}
                  largura={(z.procura / maisProcura) * 100}
                  cor="bg-piquet"
                  nota={semMedida
                    ? <span className="text-text-muted">{notaDaContagem(z.contagem)?.explicacao}</span>
                    : oferta === 0 && !coberturaPorMedir
                      ? <span className="text-text-muted">{ofertaPelasCidades
                        ? z.contagem === "nome" ? "Nenhum técnico escolheu esta cidade (contado só pelo nome)" : "Nenhum técnico a cobre com as cidades que escolheu"
                        : "Ninguém a marcou no questionário"}</span>
                      : undefined} />
              );
            })}
            {foraDasCidades > 0 && (
              <p className="text-xs text-text-muted">
                Cada pedido conta na cidade onde fica a morada. {foraDasCidades} pedido{foraDasCidades === 1 ? " fica" : "s ficam"} fora
                de todas as cidades do catálogo e não {foraDasCidades === 1 ? "entra" : "entram"} nesta lista.
              </p>
            )}
          </Painel>

          {/* Onde abrir a seguir — candidatas por interesse declarado. */}
          <Painel titulo="Onde abrir a seguir"
            descricao={pelasCidades ? "Cidades candidatas, por interessados no questionário antigo (já não é atualizado)" : "Cidades candidatas, por técnicos interessados"}
            aside={<DemoBadge endpoint="/coverage" />} corpo="p-2">
            {candidatasOrdenadas.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">Sem cidades candidatas.</p>
            ) : candidatasOrdenadas.slice(0, 8).map((c) => (
              <button key={c.id} onClick={() => setSelectedArea({ label: c.city, technicians: c.technicians, vazio: "Ainda nenhum técnico marcou esta cidade no questionário." })}
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
            description={pelasCidades
              ? "Quem recebe pedidos em cada zona, pelas cidades que escolheu na app. Clica numa zona para ver quem é."
              : "Quem marcou cada zona no questionário antigo da app. Clica numa zona para ver quem a marcou."}
            aside={<DemoBadge endpoint="/coverage" />} />
          <DataTable<CoverageOpenZone>
            columns={pelasCidades ? [
              { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
              { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
              { key: "tecnicos", label: "Técnicos", className: "text-right", render: (r) => {
                const nota = notaDaContagem(r.nas_cidades?.contagem);
                return (
                  <span className="inline-flex items-center justify-end gap-2">
                    {nota && <Etiqueta tom={zonaPorMedir(r) ? "atencao" : "neutro"} title={nota.explicacao}>{nota.texto}</Etiqueta>}
                    {zonaPorMedir(r)
                      ? <span className="text-text-muted">—</span>
                      : <span className={tecnicosDaZona(r).length === 0 ? "tabular-nums font-medium text-danger" : "tabular-nums font-medium"}>{tecnicosDaZona(r).length}</span>}
                  </span>
                );
              } },
              { key: "prontos", label: "Prontos", className: "text-right", render: (r) => zonaPorMedir(r)
                ? <span className="text-text-muted">—</span>
                : <span className="tabular-nums text-text-secondary">{r.nas_cidades?.podem_trabalhar ?? 0}</span> },
              { key: "estado", label: "", className: "text-right", render: (r) => tecnicosDaZona(r).length === 0
                ? <span className="text-xs text-text-muted">{zonaPorMedir(r) ? "por medir" : "ninguém"}</span>
                : <span className="text-xs text-text-muted group-hover:text-text-primary">Ver técnicos →</span> },
            ] : [
              { key: "city", label: "Cidade", render: (r) => <span className="font-medium">{r.city}</span> },
              { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
              { key: "technicians", label: "No questionário", className: "text-right", render: (r) => (
                <span className="tabular-nums font-medium">{r.technicians.length}</span>
              ) },
              { key: "estado", label: "", className: "text-right", render: (r) => r.technicians.length === 0
                ? <span className="text-xs text-text-muted">ninguém marcou</span>
                : <span className="text-xs text-text-muted group-hover:text-text-primary">Ver técnicos →</span> },
            ]}
            data={zonasAbertasOrdenadas}
            keyField="id"
            onRowClick={abrirZona}
            emptyMessage="Sem zonas abertas"
          />
          {rodapeDasZonas.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-text-muted">
              {rodapeDasZonas.map((frase) => <p key={frase}>{frase}</p>)}
            </div>
          )}
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
          {/*
            Registados: com a categoria, em qualquer estado (registo a meio,
            documentos em falta, suspensos, sem entrar há meses). Prontos: fazem
            um tipo de serviço dela e já podem trabalhar -- falta-lhes só estar
            Online. Quem está Online agora vê-se em Pedidos › Ao vivo, e por isso
            os números diferem tanto.

            Os prontos são a soma de dois grupos, os mesmos dos filtros da lista
            de técnicos: AT validada, e só falta a AT (trabalham até ao 3.º
            serviço). Por baixo do total vai a soma, "3 + 40". Quem tem a AT
            validada mas está travado por outra razão não recebe pedidos e não
            conta.
          */}
          <Painel titulo={comProntos ? "Técnicos por categoria" : "Registados por categoria"}
            descricao={comProntos ? "Registados em qualquer estado, e os prontos a trabalhar. Online agora: Pedidos › Ao vivo" : "Em qualquer estado — disponíveis agora: Pedidos › Ao vivo"}
            corpo="">
            {(byCategory ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">Sem dados.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {comProntos && (
                  <li className="flex items-baseline gap-3 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    <span className="flex-1">Categoria</span>
                    <span className="w-20 text-right">Registados</span>
                    <span className="w-14 text-right">Prontos</span>
                  </li>
                )}
                {[...(byCategory ?? [])].sort((a, b) => b.value - a.value).map((c) => (
                  <li key={c.name} className="flex items-baseline gap-3 px-4 py-2 text-[13px]">
                    {/* min-w-0 + hífen: "ELETRODOMÉSTICOS" não cabe na coluna e empurrava os números. */}
                    <span className="min-w-0 flex-1 break-words hyphens-auto text-text-secondary">{c.name}</span>
                    <span className={comProntos ? "w-20 text-right font-medium tabular-nums text-text-primary" : "font-medium tabular-nums text-text-primary"}>{c.value}</span>
                    {comProntos && (
                      <span className="w-14 text-right tabular-nums text-text-secondary">
                        {c.podem_trabalhar ?? 0}
                        {c.podem_trabalhar_com_at !== undefined && (
                          <span className="block text-[11px] text-text-muted"
                            title={`${c.podem_trabalhar_com_at} com a AT validada + ${(c.podem_trabalhar ?? 0) - c.podem_trabalhar_com_at} só com a AT em falta`}>
                            {c.podem_trabalhar_com_at} + {(c.podem_trabalhar ?? 0) - c.podem_trabalhar_com_at}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {prontosPelaAt && (byCategory ?? []).length > 0 && (
              <p className="border-t border-surface-border px-4 py-3 text-xs text-text-muted">
                Prontos = AT validada + só falta a AT (até 3 serviços).
              </p>
            )}
          </Painel>
        </div>
      </div>

      <Modal
        open={!!selectedArea}
        onClose={() => setSelectedArea(null)}
        title={selectedArea?.label ?? ""}
        subtitle={selectedArea ? (() => {
          if (selectedArea.porMedir) return "Por medir";
          const n = selectedArea.technicians.length;
          const prontos = selectedArea.technicians.filter((t) => t.podem_trabalhar).length;
          const comProntidao = selectedArea.technicians.some((t) => t.podem_trabalhar !== undefined);
          return `${n} técnico${n === 1 ? "" : "s"}${comProntidao ? ` · ${prontos} pronto${prontos === 1 ? "" : "s"} a trabalhar` : ""}`;
        })() : undefined}
        footer={<button onClick={() => setSelectedArea(null)} className="btn-secondary text-sm">Fechar</button>}
      >
        {selectedArea && (
          selectedArea.technicians.length === 0 ? (
            <p className="text-sm text-text-secondary">{selectedArea.vazio}</p>
          ) : (
            <ul className="card divide-y divide-surface-border">
              {selectedArea.technicians.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{t.name ?? "—"}</p>
                    <p className="text-xs text-text-muted truncate">{t.nif ?? "—"} · {t.phone_number ?? t.email ?? "—"}</p>
                    {t.podem_trabalhar === false && <p className="text-xs text-warning">Ainda não pode trabalhar</p>}
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
