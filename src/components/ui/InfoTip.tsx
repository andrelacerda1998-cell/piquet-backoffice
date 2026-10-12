"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A ajuda "ⓘ" ao lado de um número: abre com um toque e fecha com outro, com
 * Esc ou tocando fora.
 *
 * Era um `title` no ícone, que só aparece com o rato por cima -- num telemóvel
 * (onde o backoffice se usa muito) não abria nunca, e a definição do número
 * ficava escondida.
 */
export function InfoTip({ texto, className, lado = "direita" }: { texto: string; className?: string; lado?: "direita" | "esquerda" }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <span ref={ref} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((a) => !a); }}
        aria-label="O que quer dizer este número?"
        aria-expanded={aberto}
        className="text-text-muted hover:text-text-primary p-0.5 -m-0.5 rounded"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {aberto && (
        <span
          role="tooltip"
          className={cn(
            "absolute top-full mt-1.5 z-30 w-64 max-w-[80vw] rounded-lg border border-surface-border bg-surface p-3",
            "text-xs leading-relaxed text-text-secondary shadow-elevated normal-case tracking-normal font-normal text-left whitespace-normal",
            lado === "direita" ? "right-0" : "left-0",
          )}
        >
          {texto}
        </span>
      )}
    </span>
  );
}
