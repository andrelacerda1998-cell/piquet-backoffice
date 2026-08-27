"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Code2 } from "lucide-react";
import { DevPanel } from "./DevPanel";

export default function DevelopmentPage() {
  return (
    <RouteGuard route="/desenvolvimento">
      <div className="space-y-6">
        <PageHeader
          icon={Code2}
          eyebrow="Equipa & ferramentas"
          title="Desenvolvimento"
          subtitle="Quadro de tarefas do site e da app — arrasta os cartões entre colunas"
        />
        <DevPanel />
      </div>
    </RouteGuard>
  );
}
