"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_RODAPE } from "@/config/dashboard";
import { estaEm, gruposVisiveis, type GrupoVisivel } from "@/lib/navGrupos";
import { useFilterStore } from "@/stores";
import { canAccessRoute, ROLE_LABELS } from "@/lib/permissions";
import { useNavBadges } from "@/hooks/useNavBadges";
import { rotuloBadge } from "@/lib/navBadges";
import { useAuthStore } from "@/stores";
import {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings, ChevronLeft, X,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus, SlidersHorizontal,
  ChevronDown, MonitorSmartphone, Code2, Inbox,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus, SlidersHorizontal,
  MonitorSmartphone, Code2, Inbox,
};

const NAV_BY_HREF = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]));

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useFilterStore();
  const user = useAuthStore((s) => s.user);
  // Grupos abertos à mão; o da página atual abre-se sempre sozinho.
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  // Quantos assuntos estão à espera em cada ecrã — mesma fonte dos Alertas.
  const badges = useNavBadges();

  const canSee = (href: string) => (user ? canAccessRoute(user.role, href) : false);
  const grupos = gruposVisiveis(user?.role, pathname, badges);
  const rodape = NAV_RODAPE.filter(canSee);

  // Ao mudar de página, o grupo dela fica aberto (e os abertos à mão também).
  useEffect(() => {
    const ativo = gruposVisiveis(user?.role, pathname, {}).find((g) => g.ativo);
    if (ativo) setAbertos((a) => (a.has(ativo.id) ? a : new Set(a).add(ativo.id)));
  }, [pathname, user?.role]);

  /**
   * `colapsado` é um parâmetro e não o estado global de propósito: recolher a
   * barra é uma opção do computador. O painel do telemóvel usava o mesmo
   * estado e, se a barra estivesse recolhida no portátil, o menu abria no
   * telemóvel como uma tira de ícones sem texto — inútil, e sem forma óbvia de
   * o desfazer a partir do telemóvel.
   */
  const sidebarContent = (colapsado: boolean) => (
    <>
      {/* Cabeçalho / wordmark */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-ink-border">
        {!colapsado ? (
          <Link href="/" className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-white">Piquet</span>
            <span className="text-piquet text-xl leading-none">.</span>
            <span className="ml-1.5 text-[11px] font-semibold tracking-[0.18em] text-ink-muted">ADMIN</span>
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
          aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
        >
          {mobileSidebarOpen ? <X className="h-5 w-5" /> : <ChevronLeft className={cn("h-5 w-5 transition-transform", colapsado && "rotate-180")} />}
        </button>
      </div>

      {/*
        Seis grupos (ver NAV_GROUPS). Um grupo com um ecrã só é um link; com
        vários, abre-se para os mostrar. Recolhido, cada grupo é um ícone que
        leva ao primeiro ecrã dele.
      */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {grupos.map((g) => (
          <Grupo key={g.id} g={g} colapsado={colapsado} aberto={abertos.has(g.id) || g.ativo}
            alternar={() => setAbertos((a) => { const n = new Set(a); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
            fechar={() => setMobileSidebarOpen(false)} />
        ))}
        {rodape.length > 0 && (
          <div className="pt-3 mt-3 border-t border-ink-border space-y-1">
            {rodape.map((href) => {
              const item = NAV_BY_HREF[href];
              if (!item) return null;
              const Icon = iconMap[item.icon] ?? LayoutDashboard;
              return (
                <Link key={href} href={href} onClick={() => setMobileSidebarOpen(false)}
                  title={colapsado ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    estaEm(pathname, href) ? "bg-piquet text-ink font-semibold" : "text-ink-muted hover:bg-ink-soft hover:text-white",
                    colapsado && "justify-center px-2",
                  )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!colapsado && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Rodapé / utilizador */}
      {user && (
        <div className="border-t border-ink-border p-3">
          <div className={cn("flex items-center gap-3", colapsado && "justify-center")}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-piquet text-ink text-sm font-bold">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            {!colapsado && (
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
          // Margens do telemovel: zero no computador.
          "pt-[var(--margem-topo)] pb-[var(--margem-fundo)] pl-[var(--margem-esquerda)]",
          sidebarCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {sidebarContent(sidebarCollapsed)}
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 h-full w-64 bg-ink-deep border-r border-ink-border z-50 transform transition-transform duration-300",
          "pt-[var(--margem-topo)] pb-[var(--margem-fundo)] pl-[var(--margem-esquerda)]",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}

/** O número de assuntos à espera; recolhido, um ponto sobre o ícone. */
function Badge({ n, colapsado, sobreAtivo }: { n: number; colapsado: boolean; sobreAtivo: boolean }) {
  if (n <= 0) return null;
  if (colapsado) {
    return <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-ink-alert ring-2 ring-ink-deep" aria-hidden />;
  }
  return (
    <span className={cn(
      "ml-auto shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center tabular-nums",
      // Ativo, o fundo já é dourado: o vermelho vivo por cima vibra.
      sobreAtivo ? "bg-ink text-piquet" : "bg-ink-alert text-white",
    )}>
      {rotuloBadge(n)}
    </span>
  );
}

function Grupo({ g, colapsado, aberto, alternar, fechar }: {
  g: GrupoVisivel; colapsado: boolean; aberto: boolean; alternar: () => void; fechar: () => void;
}) {
  const Icon = iconMap[g.icon] ?? LayoutDashboard;
  const simples = g.filhos.length === 1 || colapsado;
  const base = "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors";
  const estilo = (ativo: boolean) => ativo ? "bg-piquet text-ink font-semibold shadow-sm" : "text-ink-muted hover:bg-ink-soft hover:text-white";

  if (simples) {
    return (
      <Link href={g.destino} onClick={fechar} title={colapsado ? g.label : undefined}
        className={cn(base, estilo(g.ativo), colapsado && "justify-center px-2")}>
        <Icon className="h-5 w-5 shrink-0" />
        {!colapsado && <span className="truncate">{g.label}</span>}
        <Badge n={g.badge} colapsado={colapsado} sobreAtivo={g.ativo} />
        <span className="sr-only">{g.badge > 0 ? `${g.badge} por tratar` : ""}</span>
      </Link>
    );
  }

  return (
    <div>
      <button onClick={alternar} aria-expanded={aberto}
        className={cn(base, "w-full", g.ativo ? "text-white" : "text-ink-muted hover:bg-ink-soft hover:text-white")}>
        <Icon className={cn("h-5 w-5 shrink-0", g.ativo && "text-piquet")} />
        <span className="flex-1 text-left truncate">{g.label}</span>
        {!aberto && <Badge n={g.badge} colapsado={false} sobreAtivo={false} />}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className="mt-1 ml-4 pl-3 border-l border-ink-border space-y-1">
          {g.filhos.map((f) => (
            <Link key={f.href} href={f.href} onClick={fechar}
              className={cn("relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors", estilo(f.ativo))}>
              <span className="truncate">{f.label}</span>
              <Badge n={f.badge} colapsado={false} sobreAtivo={f.ativo} />
              <span className="sr-only">{f.badge > 0 ? `${f.badge} por tratar` : ""}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
