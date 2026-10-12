"use client";

import { useUiStore, useAuthStore } from "@/stores";
import { Check, X, ListChecks, ClipboardList, Search } from "lucide-react";

/**
 * Guia de três passos, no primeiro login: a fila, a ficha do pedido e o ⌘K.
 *
 * Era um "Tens visão total" igual para toda a gente, com um botão de comandos
 * -- não dizia por onde começar. Quem chega pela primeira vez precisa de
 * saber três coisas, e só três (auditoria de 08/10/2026, secção 19).
 */
const PASSOS = [
  {
    Icon: ListChecks,
    titulo: "Começa por \"Precisa de ti\"",
    texto: "É a fila do que está à tua espera, a mais urgente em cima. Cada linha tem um botão com o passo seguinte.",
  },
  {
    Icon: ClipboardList,
    titulo: "Tudo de um pedido está no pedido",
    texto: "Abre um pedido: telefones, próximo passo, reembolso, notas e tickets. Copia a ligação para a mandar a alguém.",
  },
  {
    Icon: Search,
    titulo: "Procura com ⌘K (ou a lupa)",
    texto: "Um número de pedido, um telefone, um nome ou um NIF. Com \">\" fazes coisas: \"> reembolsar 282\".",
  },
] as const;

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
          Olá, {firstName}. Três coisas para começar:
        </h2>
        <ol className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="rounded-xl bg-surface/70 p-3">
              <p className="flex items-center gap-2 font-semibold text-text-primary text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-piquet text-xs text-white">{i + 1}</span>
                <p.Icon className="h-4 w-4 text-piquet-700" />
                {p.titulo}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{p.texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setCommandOpen(true)} className="btn-secondary text-sm py-1.5">
            <Search className="h-4 w-4" />
            Experimentar a pesquisa
          </button>
          <button onClick={dismissWelcome} className="btn-primary text-sm py-1.5">
            <Check className="h-4 w-4" />
            Percebi
          </button>
        </div>
      </div>
    </div>
  );
}
