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
    <div className="card relative p-5">
      <button
        onClick={dismissWelcome}
        className="absolute top-3 right-3 p-1.5 rounded-md text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="text-[15px] font-semibold text-text-primary pr-8">
        Olá, {firstName}. Três coisas para começar
      </h2>
      <ol className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-piquet/15 text-xs font-semibold text-piquet-700">{i + 1}</span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                <p.Icon className="h-3.5 w-3.5 text-text-muted" />
                {p.titulo}
              </p>
              <p className="mt-0.5 text-[13px] text-text-secondary">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={dismissWelcome} className="btn-primary py-1.5">
          <Check className="h-4 w-4" />
          Percebi
        </button>
        <button onClick={() => setCommandOpen(true)} className="btn-ghost">
          <Search className="h-4 w-4" />
          Experimentar a pesquisa
        </button>
      </div>
    </div>
  );
}
