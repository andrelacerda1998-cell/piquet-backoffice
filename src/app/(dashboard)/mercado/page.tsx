"use client";

import { Map as MapIcon } from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import Liquidez from "./Liquidez";
import Cobertura from "./Cobertura";

/**
 * Mercado: se a procura e a oferta se estão a encontrar, e onde não estão.
 *
 * Esta pergunta estava repartida por três sítios -- Operações › Desempenho
 * (SLA), Técnicos › Cobertura e o mapa -- e é a que decide o negócio. Agora
 * vive num só (09/10/2026). O que se passa AGORA, pedido a pedido, continua
 * em Pedidos › Ao vivo.
 */
const TABS: TabDef[] = [
  { id: "liquidez", label: "Liquidez" },
  { id: "cobertura", label: "Cobertura" },
];

export default function MercadoPage() {
  const [tab, setTab] = useTabParam("liquidez");
  return (
    <RouteGuard route="/mercado">
      <div className="space-y-6">
        <PageHeader
          icon={MapIcon}
          eyebrow="Marketplace"
          title="Mercado"
          subtitle="Se os pedidos estão a ser servidos, e onde há ou falta oferta"
        />
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === "liquidez" && <Liquidez />}
        {tab === "cobertura" && <Cobertura />}
      </div>
    </RouteGuard>
  );
}
