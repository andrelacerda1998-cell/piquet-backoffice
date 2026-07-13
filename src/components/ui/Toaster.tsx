"use client";

import { useToastStore } from "@/stores";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONE = {
  success: "border-success/30 text-success",
  error: "border-danger/30 text-danger",
  info: "border-info/30 text-info",
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => {
        const Icon = ICON[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-surface shadow-elevated px-4 py-3 animate-in",
              TONE[t.type]
            )}
            role="status"
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-text-primary">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="text-text-muted hover:text-text-primary" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
