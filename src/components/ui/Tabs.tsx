"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "underline" | "pill";
}

/**
 * Barra de abas. `underline` para as abas de secção (um traço dourado debaixo
 * da ativa); `pill` para sub-abas, desenhadas como um seletor segmentado --
 * assim nunca se confundem os dois níveis no mesmo ecrã.
 */
export function Tabs({ tabs, active, onChange, className, variant = "underline" }: TabsProps) {
  if (variant === "pill") {
    return (
      <div className={cn("inline-flex max-w-full gap-0.5 rounded-lg bg-surface-subtle p-0.5 overflow-x-auto tira-deslizante", className)} role="tablist">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-surface text-text-primary shadow-card ring-1 ring-surface-border"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {t.label}
              {t.count !== undefined && <span className={cn("ml-1.5 text-xs tabular-nums", isActive ? "text-text-muted" : "opacity-70")}>{t.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-6 border-b border-surface-border overflow-x-auto tira-deslizante", className)} role="tablist">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-2 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              isActive
                ? "border-piquet text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary hover:border-surface-strong"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums",
                  isActive ? "bg-piquet/15 text-piquet-700" : "bg-surface-subtle text-text-muted"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Sub-abas aninhadas (pílulas) com estado próprio — evita elevar estado à página. */
export function SubTabs({ tabs, children, className }: {
  tabs: TabDef[];
  children: (active: string) => React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <div className={cn("space-y-4", className)}>
      <Tabs tabs={tabs} active={active} onChange={setActive} variant="pill" />
      {children(active)}
    </div>
  );
}
