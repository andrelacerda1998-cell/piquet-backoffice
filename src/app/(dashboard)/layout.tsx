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
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-16" : "lg:pl-60")}>
        <Topbar />
        {/*
          O fundo leva a margem do indicador de home: sem isto, o ultimo
          botao de cada ecra ficava por baixo da barra de gestos e nao se
          conseguia tocar nele.
        */}
        <main className="px-4 pt-5 md:px-8 md:pt-7 max-w-[1520px] mx-auto pb-[calc(1.5rem+var(--margem-fundo))] md:pb-[calc(2.5rem+var(--margem-fundo))]">
          {children}
        </main>
      </div>
      <CommandPalette />
      <Toaster />
      <RegistarWorker />
    </div>
  );
}
