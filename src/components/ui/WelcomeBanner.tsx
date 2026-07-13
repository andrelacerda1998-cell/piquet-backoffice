"use client";

import { useUiStore, useAuthStore } from "@/stores";
import { Command, Check, X } from "lucide-react";

export function WelcomeBanner() {
  const { welcomeDismissed, dismissWelcome, setCommandOpen } = useUiStore();
  const user = useAuthStore((s) => s.user);

  if (welcomeDismissed) return null;

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="relative overflow-hidden rounded-card border border-piquet/30 bg-piquet/10 p-5">
      <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-piquet/20 blur-3xl" />
      <button
        onClick={dismissWelcome}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-text-muted hover:bg-surface/60 hover:text-text-primary transition-colors"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative">
        <h2 className="text-lg font-bold text-text-primary">
          Bem-vindo(a), {firstName} <span className="align-middle">👋</span>
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Tens visão total. Começa pela Visão geral ou usa ⌘K para saltar para qualquer módulo.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setCommandOpen(true)} className="btn-primary text-sm py-1.5">
            <Command className="h-4 w-4" />
            Abrir comandos (⌘K)
          </button>
          <button onClick={dismissWelcome} className="btn-secondary text-sm py-1.5">
            <Check className="h-4 w-4" />
            Percebi, dispensar
          </button>
        </div>
      </div>
    </div>
  );
}
