"use client";

import { useEffect, useRef } from "react";

/**
 * Acessibilidade para drawers/painéis modais:
 * - fecha com `Esc`,
 * - prende o foco dentro do painel (Tab/Shift+Tab циclam),
 * - foca o primeiro elemento focável ao abrir e devolve o foco ao fechar.
 *
 * Devolve um ref para colocar no elemento do painel.
 */
export function useDrawerA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  // Guardamos `onClose` num ref para o efeito NÃO depender da sua identidade.
  // Sem isto, um `onClose` inline (novo a cada render do pai) fazia o efeito
  // re-executar a cada tecla e voltar a chamar `focusable()[0].focus()`,
  // tirando o foco do input — escrita aos solavancos ao preencher formulários.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)
        : [];

    // Foca o primeiro elemento útil do painel.
    focusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
    // Corre uma vez por abertura: o Modal remonta o painel a cada `open`, e os
    // drawers montam/desmontam com o item selecionado, por isso deps vazias
    // dão exatamente o ciclo certo (focar ao abrir, restaurar ao fechar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
