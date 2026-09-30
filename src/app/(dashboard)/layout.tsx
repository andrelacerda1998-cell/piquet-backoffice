"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Toaster } from "@/components/ui/Toaster";
import { RegistarWorker } from "@/components/layout/RegistarWorker";
import { useFilterStore } from "@/stores";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useFilterStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar />
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64")}>
        <Topbar />
        {/*
          O fundo leva a margem do indicador de home: sem isto, o ultimo
          botao de cada ecra ficava por baixo da barra de gestos e nao se
          conseguia tocar nele.
        */}
        <main className="p-4 md:p-6 max-w-[1600px] mx-auto pb-[calc(1rem+var(--margem-fundo))] md:pb-[calc(1.5rem+var(--margem-fundo))]">
          {children}
        </main>
      </div>
      <CommandPalette />
      <Toaster />
      <RegistarWorker />
    </div>
  );
}
