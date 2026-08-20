"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { SupportInbox } from "@/components/ui/SupportInbox";
import { PageHeader } from "@/components/ui/PageHeader";
import { LifeBuoy } from "lucide-react";

/**
 * Suporte = a caixa de entrada de tickets, e mais nada.
 *
 * A página tinha quatro separadores, mas só este tem dados reais — os outros
 * (Reclamações, Mediação, FAQ interna) eram demonstração e só acrescentavam
 * ruído a quem vinha responder a um cliente. As Reclamações continuam em
 * Clientes › Reclamações; Mediação e FAQ voltam quando existirem a sério.
 */
export default function SuportePage() {
  return (
    <RouteGuard route="/suporte">
      <div className="space-y-6">
        <PageHeader
          icon={LifeBuoy}
          eyebrow="Operação"
          title="Suporte"
          subtitle="Tickets das apps do cliente e do técnico — responde daqui, a resposta chega ao canal certo"
        />
        <Suspense fallback={<div className="text-sm text-text-muted py-8 text-center">A carregar caixa de entrada…</div>}>
          <SupportInbox />
        </Suspense>
      </div>
    </RouteGuard>
  );
}
