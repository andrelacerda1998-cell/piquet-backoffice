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

/** Barra de abas. `underline` para abas de secção; `pill` para sub-abas aninhadas. */
export function Tabs({ tabs, active, onChange, className, variant = "underline" }: TabsProps) {
  if (variant === "pill") {
    return (
      <div className={cn("flex gap-1.5 flex-wrap", className)}>
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-piquet/15 text-piquet-700"
                  : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              )}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{t.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1 border-b border-surface-border overflow-x-auto", className)}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              isActive
                ? "border-piquet text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  isActive ? "bg-piquet/15 text-piquet-700" : "bg-surface-subtle text-text-secondary"
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
