"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const LARGURA = 256;
const MARGEM = 8;

/**
 * A ajuda "ⓘ" ao lado de um número: abre com um toque e fecha com outro, com
 * Esc, tocando fora ou ao rolar a página.
 *
 * Era um `title` no ícone, que só aparece com o rato por cima -- num telemóvel
 * (onde o backoffice se usa muito) não abria nunca, e a definição do número
 * ficava escondida.
 *
 * A caixa desenha-se por cima de tudo (num portal, com posição fixa): dentro
 * de um cartão com `overflow-hidden` -- os grupos de números, as tabelas -- uma
 * caixa posicionada dentro dele ficava cortada a meio. Fica sempre dentro do
 * ecrã: encosta às margens e, sem espaço por baixo, abre por cima do ícone.
 */
export function InfoTip({ texto, className, lado = "direita" }: { texto: string; className?: string; lado?: "direita" | "esquerda" }) {
  const [ancora, setAncora] = useState<DOMRect | null>(null);
  const [acima, setAcima] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLSpanElement>(null);
  const aberto = ancora !== null;

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAncora(null);
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !caixa.current?.contains(alvo)) fechar();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  // Só depois de desenhada se sabe a altura da caixa.
  useLayoutEffect(() => {
    if (!ancora || !caixa.current) return;
    const altura = caixa.current.offsetHeight;
    setAcima(ancora.bottom + 6 + altura > window.innerHeight - MARGEM && ancora.top - 6 - altura > MARGEM);
  }, [ancora]);

  const alternar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAncora(aberto ? null : botao.current?.getBoundingClientRect() ?? null);
  };

  let estilo: React.CSSProperties | undefined;
  if (ancora) {
    const largura = Math.min(LARGURA, window.innerWidth * 0.8);
    // "direita": a caixa acaba onde acaba o ícone e cresce para a esquerda.
    const desejado = lado === "direita" ? ancora.right - largura : ancora.left;
    const left = Math.max(MARGEM, Math.min(desejado, window.innerWidth - largura - MARGEM));
    estilo = acima
      ? { left, width: largura, bottom: window.innerHeight - ancora.top + 6 }
      : { left, width: largura, top: ancora.bottom + 6 };
  }

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-label="O que quer dizer este número?"
        aria-expanded={aberto}
        className="text-text-muted hover:text-text-primary p-0.5 -m-0.5 rounded"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {aberto && createPortal(
        <span
          ref={caixa}
          role="tooltip"
          style={estilo}
          className="fixed z-[80] rounded-lg border border-surface-border bg-surface p-3 text-xs leading-relaxed text-text-secondary shadow-elevated normal-case tracking-normal font-normal text-left whitespace-normal"
        >
          {texto}
        </span>,
        document.body,
      )}
    </span>
  );
}
