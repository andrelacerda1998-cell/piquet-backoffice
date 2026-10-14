"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal, Field } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { createZone, getZones, updateZone, type AllowedZone } from "@/services/zonesService";
import { toast } from "@/stores";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { SectionHeader } from "@/components/ui/PageHeader";
import { Etiqueta } from "@/components/ui/Ficha";
import { notaDaContagem, porMedir, resumoDasContagens } from "@/lib/pelasCidades";
import { Plus, Pencil } from "lucide-react";

/**
 * Zonas — migrado do Filament (AllowedZoneResource) para o Laravel. Ver
 * src/services/zonesService.ts.
 *
 * Fatia "Lista + criar/editar, sem apagar" (decisão explícita, 2026-07-29).
 * O ecrã anterior ("Zonas de operação") mostrava um dashboard de desempenho
 * inteiramente fictício -- clientes/técnicos/pedidos/cobertura/receita por
 * zona não existem no modelo real (AllowedZone é só cidade + distrito +
 * técnicos associados). Esses indicadores foram removidos, não substituídos:
 * mostrar zero em vez de ficção seria enganador na mesma forma, e mostrar
 * como "vazio" também não é verdade -- o Laravel simplesmente não modela
 * "desempenho por zona".
 */

function ZonasContent() {
  const { data, loading, error, refetch } = useAsyncData(() => getZones(), []);
  const zones = data?.items ?? [];
  // O backend conta pelas cidades escolhidas na app desde o backend#185. Antes
  // disso só há o questionário antigo, e o ecrã mostra-o como até aqui.
  const pelasCidades = zones.some((z) => z.tecnicos_nas_cidades !== undefined);
  const semCidades = data?.meta.sem_cidades;
  const rodape = pelasCidades ? resumoDasContagens(zones.map((z) => z.contagem), { um: "zona", varios: "zonas" }) : [];

  const [modal, setModal] = useState<{ open: boolean; editing: AllowedZone | null; city: string; district: string }>({
    open: false, editing: null, city: "", district: "",
  });
  const [saving, setSaving] = useState(false);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openNew = () => setModal({ open: true, editing: null, city: "", district: "" });
  const openEdit = (z: AllowedZone) => setModal({ open: true, editing: z, city: z.city, district: z.district ?? "" });
  const close = () => setModal({ open: false, editing: null, city: "", district: "" });

  const save = async () => {
    const city = modal.city.trim();
    if (!city) { toast("Indica a cidade da zona.", "error"); return; }
    const district = modal.district.trim() || null;

    setSaving(true);
    try {
      if (modal.editing) {
        await updateZone(modal.editing.id, { city, district });
        toast(`Zona "${city}" atualizada.`);
      } else {
        await createZone({ city, district });
        toast(`Zona "${city}" criada.`);
      }
      close();
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar a zona.", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AllowedZone>[] = [
    { key: "city", label: "Cidade", sortable: true, render: (r) => <span className="font-medium">{r.city}</span> },
    { key: "district", label: "Distrito", render: (r) => r.district ?? "—" },
    ...(pelasCidades ? [
      /*
        Quem recebe um pedido no centro da zona, pelas cidades que escolheu na
        app -- a regra do matching. Sem coordenadas conta só pelo nome; fora do
        catálogo não há medida, e um zero lia-se como "ninguém".
      */
      { key: "tecnicos_nas_cidades", label: "Técnicos", className: "text-right", render: (r) => {
        const nota = notaDaContagem(r.contagem);
        return (
          <span className="inline-flex items-center justify-end gap-2">
            {nota && <Etiqueta tom={porMedir(r.contagem) ? "atencao" : "neutro"} title={nota.explicacao}>{nota.texto}</Etiqueta>}
            {porMedir(r.contagem)
              ? <span className="text-text-muted">—</span>
              : <span className={(r.tecnicos_nas_cidades ?? 0) === 0 ? "tabular-nums font-medium text-danger" : "tabular-nums font-medium"}>{r.tecnicos_nas_cidades}</span>}
          </span>
        );
      } },
      { key: "podem_trabalhar", label: "Prontos", className: "text-right", render: (r) => porMedir(r.contagem)
        ? <span className="text-text-muted">—</span>
        : <span className="tabular-nums text-text-secondary">{r.podem_trabalhar}</span> },
    ] satisfies Column<AllowedZone>[] : [
      /*
        Quem marcou a zona no questionário antigo da app do técnico
        (`vendor_allowed_zones`). A app já não o mostra -- grava as cidades por
        /vendor/cities --, por isso este número parou no tempo e NÃO é quem
        recebe pedidos aqui. Chamava-se "Técnicos", e lia-se como cobertura.
      */
      { key: "vendors_count", label: "No questionário", className: "text-right", render: (r) => (
        <span className="tabular-nums text-text-secondary">{r.vendors_count}</span>
      ) },
    ] satisfies Column<AllowedZone>[]),
    {
      key: "actions", label: "",
      render: (r) => (
        <div className="flex justify-end md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={() => openEdit(r)} className="btn-ghost text-xs px-2 py-1">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <section>
        <SectionHeader
          title="Zonas"
          description={pelasCidades
            ? `${zones.length} cidades onde a Piquet aceita pedidos. «Técnicos» são os que recebem um pedido no centro da cidade, pelas cidades que escolheram na app; «Prontos» são os que já podem trabalhar (falta-lhes só estar Online).`
            : `${zones.length} cidades onde a Piquet aceita pedidos. Quem é convidado para cada pedido depende das cidades que cada técnico escolhe na app; «No questionário» conta só quem marcou a zona no questionário antigo, que a app já não mostra.`}
          aside={
            <>
              <DemoBadge endpoint="/allowed-zones" />
              <button onClick={openNew} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova zona</button>
            </>
          }
        />
        {/* Quem não escolheu cidades não entra em zona nenhuma, mas recebe pedidos. */}
        {pelasCidades && semCidades && semCidades.tecnicos > 0 && (
          <div className="aviso aviso-info mb-3">
            <p>
              <b className="font-medium text-text-primary">
                {semCidades.tecnicos} técnico{semCidades.tecnicos === 1 ? " ainda não escolheu" : "s ainda não escolheram"} cidades
              </b>{" "}
              ({semCidades.podem_trabalhar} pronto{semCidades.podem_trabalhar === 1 ? "" : "s"} a trabalhar). Não {semCidades.tecnicos === 1 ? "conta" : "contam"} em
              nenhuma zona: sem cidades, o matching manda-lhes pedidos de qualquer zona, até ao raio máximo de onde estiverem.
            </p>
          </div>
        )}
        <DataTable columns={columns} data={zones} keyField="id" emptyMessage="Ainda sem zonas." />
        {rodape.length > 0 && (
          <div className="mt-2 space-y-1 text-xs text-text-muted">
            {rodape.map((frase) => <p key={frase}>{frase}</p>)}
          </div>
        )}
      </section>

      <Modal
        open={modal.open}
        onClose={close}
        title={modal.editing ? "Editar zona" : "Nova zona"}
        subtitle="Cidade onde a Piquet aceita pedidos de serviço"
        footer={
          <>
            <button onClick={close} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">{modal.editing ? "Guardar" : "Criar zona"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Cidade">
            <input
              value={modal.city}
              onChange={(e) => setModal({ ...modal, city: e.target.value })}
              placeholder="Ex.: Cascais"
              className="input-field"
            />
          </Field>
          <Field label="Distrito" hint="Opcional">
            <input
              value={modal.district}
              onChange={(e) => setModal({ ...modal, district: e.target.value })}
              placeholder="Ex.: Lisboa"
              className="input-field"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export default function ZonesPage() {
  return (
    <RouteGuard route="/zonas">
      <ZonasContent />
    </RouteGuard>
  );
}
