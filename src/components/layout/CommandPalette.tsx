"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_VISIBLE } from "@/config/dashboard";
import { useUiStore, useAuthStore, useThemeStore } from "@/stores";
import { canAccessRoute } from "@/lib/permissions";
import {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings, Search, Moon, Sun, CornerDownLeft,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus,
};

type Command = {
  id: string;
  label: string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen } = useUiStore();
  const user = useAuthStore((s) => s.user);
  const { theme, toggleTheme } = useThemeStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    if (commandOpen) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandOpen]);

  const commands = useMemo<Command[]>(() => {
    // Apenas os módulos visíveis na navegação (mesma lista da sidebar).
    const byHref = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]));
    const navCmds: Command[] = NAV_VISIBLE
      .map((href) => byHref[href])
      .filter((i): i is (typeof NAV_ITEMS)[number] => !!i && (user ? canAccessRoute(user.role, i.href) : false))
      .map((i) => ({
        id: `nav:${i.href}`,
        label: i.label,
        hint: "Navegar",
        Icon: iconMap[i.icon] ?? LayoutDashboard,
        run: () => router.push(i.href),
      }));
    const actionCmds: Command[] = [
      {
        id: "action:theme",
        label: theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro",
        hint: "Ação",
        Icon: theme === "dark" ? Sun : Moon,
        run: () => toggleTheme(),
      },
    ];
    return [...navCmds, ...actionCmds];
  }, [user, theme, router, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!commandOpen) return null;

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    cmd.run();
    setCommandOpen(false);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % Math.max(1, filtered.length)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + filtered.length) % Math.max(1, filtered.length)); }
    if (e.key === "Enter") { e.preventDefault(); runAt(active); }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh] px-4"
      onClick={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-lg card overflow-hidden shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <div className="flex items-center gap-2 px-4 border-b border-surface-border">
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Procurar módulos e ações..."
            className="w-full bg-transparent py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="hidden sm:block text-[10px] font-medium text-text-muted border border-surface-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Sem resultados para “{query}”.</p>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                  i === active ? "bg-piquet/15 text-text-primary" : "text-text-secondary"
                )}
              >
                <c.Icon className={cn("h-4 w-4 shrink-0", i === active ? "text-piquet-600" : "text-text-muted")} />
                <span className="flex-1 font-medium text-text-primary">{c.label}</span>
                <span className="text-xs text-text-muted">{c.hint}</span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-text-muted" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
