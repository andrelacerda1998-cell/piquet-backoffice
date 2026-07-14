"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_PRIMARY, NAV_SECONDARY } from "@/config/dashboard";
import { useFilterStore } from "@/stores";
import { canAccessRoute, ROLE_LABELS } from "@/lib/permissions";
import { useAuthStore } from "@/stores";
import {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings, ChevronLeft, X,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus, SlidersHorizontal,
  MoreHorizontal, ChevronDown, MonitorSmartphone, Code2,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus, SlidersHorizontal,
  MonitorSmartphone, Code2,
};

const NAV_BY_HREF = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]));

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useFilterStore();
  const user = useAuthStore((s) => s.user);
  const [showMore, setShowMore] = useState(false);

  const canSee = (href: string) => (user ? canAccessRoute(user.role, href) : false);
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  // Abre "Mais" automaticamente quando a página ativa está lá dentro.
  useEffect(() => {
    if (NAV_SECONDARY.some((h) => pathname === h || (h !== "/" && pathname.startsWith(h)))) setShowMore(true);
  }, [pathname]);

  const sidebarContent = (
    <>
      {/* Cabeçalho / wordmark */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-ink-border">
        {!sidebarCollapsed ? (
          <Link href="/" className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-white">Piquet</span>
            <span className="text-piquet text-xl leading-none">.</span>
            <span className="ml-1.5 text-[10px] font-semibold tracking-[0.18em] text-ink-muted">ADMIN</span>
          </Link>
        ) : (
          <Link href="/" className="mx-auto flex items-center">
            <span className="font-bold text-lg text-white">P</span>
            <span className="text-piquet text-lg leading-none">.</span>
          </Link>
        )}
        <button
          onClick={() => {
            if (mobileSidebarOpen) setMobileSidebarOpen(false);
            else toggleSidebar();
          }}
          className="p-1.5 rounded-lg hover:bg-ink-soft text-ink-muted hover:text-white transition-colors"
          aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {mobileSidebarOpen ? <X className="h-5 w-5" /> : <ChevronLeft className={cn("h-5 w-5 transition-transform", sidebarCollapsed && "rotate-180")} />}
        </button>
      </div>

      {/* Navegação enxuta: primário sempre visível + "Mais" recolhível */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {(() => {
          const renderLink = (href: string) => {
            const item = NAV_BY_HREF[href];
            if (!item) return null;
            const Icon = iconMap[item.icon] ?? LayoutDashboard;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-piquet text-ink font-semibold shadow-sm"
                    : "text-ink-muted hover:bg-ink-soft hover:text-white",
                  sidebarCollapsed && "justify-center px-2"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          };

          const primary = NAV_PRIMARY.filter(canSee);
          const secondary = NAV_SECONDARY.filter(canSee);

          // Recolhido (só ícones): mostra tudo em lista, sem "Mais".
          if (sidebarCollapsed) return [...primary, ...secondary].map(renderLink);

          return (
            <>
              {primary.map(renderLink)}
              {secondary.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-muted hover:bg-ink-soft hover:text-white transition-colors"
                    aria-expanded={showMore}
                  >
                    <MoreHorizontal className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">Mais</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
                  </button>
                  {showMore && <div className="mt-1 space-y-1">{secondary.map(renderLink)}</div>}
                </div>
              )}
            </>
          );
        })()}
      </nav>

      {/* Rodapé / utilizador */}
      {user && (
        <div className="border-t border-ink-border p-3">
          <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-piquet text-ink text-sm font-bold">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-ink-muted">{ROLE_LABELS[user.role]}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-full bg-ink-deep border-r border-ink-border z-30 transition-all duration-300",
          sidebarCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 h-full w-64 bg-ink-deep border-r border-ink-border z-50 transform transition-transform duration-300",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
