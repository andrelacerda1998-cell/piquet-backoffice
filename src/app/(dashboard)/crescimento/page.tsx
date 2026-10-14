"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { useAuthStore } from "@/stores";
import { hasAnyPermission } from "@/lib/permissions";

import MarketingView from "../marketing/MarketingView";
import ProdutoView from "../produto/ProdutoView";
import ObjetivosPage from "../objetivos/Objetivos";
import RelatoriosPage from "../relatorios/Relatorios";

/**
 * Crescimento: o que se faz à semana e ao mês para o negócio crescer
 * (auditoria de 08/10/2026, secção 7). Junta o que estava em quatro sítios:
 *
 * - Marketing: anúncios, comunicação, CAC e LTV.
 * - Produto: adoção das apps, funil e a análise dos clientes (que abria
 *   Clientes, onde se vai para encontrar uma pessoa).
 * - Objetivos e relatórios: eram separadores da Visão Geral, com mais duas
 *   rotas repetidas (/objetivos e /relatorios).
 */
function CrescimentoPageInner() {
  const role = useAuthStore((s) => s.user?.role);
  const veMarketing = !!role && hasAnyPermission(role, ["view_marketing"]);
  const TABS: TabDef[] = [
    ...(veMarketing ? [{ id: "marketing", label: "Marketing" }] : []),
    { id: "produto", label: "Produto e clientes" },
    { id: "objetivos", label: "Objetivos e relatórios" },
  ];
  const [tab, setTab] = useTabParam("marketing");
  // Quem não vê o Marketing começa no Produto.
  const ativo = TABS.some((t) => t.id === tab) ? tab : TABS[0].id;

  return (
    <RouteGuard route="/crescimento">
      <div className="space-y-6">
        <PageHeader
          title="Crescimento"
          subtitle="Marketing, adoção das apps, clientes e objetivos do ano"
        />
        <Tabs tabs={TABS} active={ativo} onChange={setTab} />
        {ativo === "marketing" && <MarketingView embutido />}
        {ativo === "produto" && <ProdutoView embutido />}
        {ativo === "objetivos" && (
          <div className="space-y-10">
            <ObjetivosPage />
            <RelatoriosPage />
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

/**
 * O separador vem do endereço (`useTabParam` → `useSearchParams`), e o Next
 * pede um limite de Suspense por cima para compilar a página estática.
 */
export default function CrescimentoPage() {
  return (
    <Suspense>
      <CrescimentoPageInner />
    </Suspense>
  );
}
