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
      {/* Recolhida, a barra só tem largura para um botão: o de a abrir. */}
      <div className={cn("flex items-center h-14", colapsado ? "justify-center px-2" : "justify-between px-4")}>
        {!colapsado && (
          <Link href="/" className="flex items-baseline gap-0.5">
            <span className="font-semibold text-[17px] tracking-tight text-text-primary">Piquet</span>
            <span className="text-piquet text-xl leading-none">.</span>
            <span className="ml-2 rounded-md bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Gestão</span>
          </Link>
        )}
        <button
          onClick={() => {
            if (mobileSidebarOpen) setMobileSidebarOpen(false);
            else toggleSidebar();
          }}
          className="p-1.5 rounded-md text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors"
          aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
        >
          {mobileSidebarOpen ? <X className="h-4 w-4" /> : <ChevronLeft className={cn("h-4 w-4 transition-transform", colapsado && "rotate-180")} />}
        </button>
      </div>

      {/*
        Seis grupos (ver NAV_GROUPS). Um grupo com um ecrã só é um link; com
        vários, abre-se para os mostrar. Recolhido, cada grupo é um ícone que
        leva ao primeiro ecrã dele.
      */}
      <nav className={cn("flex-1 overflow-y-auto py-2 space-y-0.5", colapsado ? "px-2" : "px-3")}>
        {grupos.map((g) => (
          <Grupo key={g.id} g={g} colapsado={colapsado} aberto={abertos.has(g.id) || g.ativo}
            alternar={() => setAbertos((a) => { const n = new Set(a); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
            fechar={() => setMobileSidebarOpen(false)} />
        ))}
        {rodape.length > 0 && (
          <div className="pt-2 mt-2 border-t border-surface-border space-y-0.5">
            {rodape.map((href) => {
              const item = NAV_BY_HREF[href];
              if (!item) return null;
              const Icon = iconMap[item.icon] ?? LayoutDashboard;
              return (
                <Link key={href} href={href} onClick={() => setMobileSidebarOpen(false)}
                  title={colapsado ? item.label : undefined}
                  className={cn(ITEM, estilo(estaEm(pathname, href)), colapsado && "justify-center px-0 before:hidden")}>
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", estaEm(pathname, href) ? "text-piquet-600" : "text-text-muted")} />
                  {!colapsado && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Rodapé / utilizador */}
      {user && (
        <div className="border-t border-surface-border p-3">
          <div className={cn("flex items-center gap-2.5", colapsado && "justify-center")}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-piquet/20 text-piquet-700 text-xs font-semibold">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            {!colapsado && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
                <p className="truncate text-xs text-text-muted">{ROLE_LABELS[user.role]}</p>
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
          "hidden lg:flex flex-col fixed left-0 top-0 h-full bg-surface-sidebar border-r border-surface-border z-30 transition-all duration-300",
          // Margens do telemovel: zero no computador.
          "pt-[var(--margem-topo)] pb-[var(--margem-fundo)] pl-[var(--margem-esquerda)]",
          sidebarCollapsed ? "w-[64px]" : "w-60"
        )}
      >
        {sidebarContent(sidebarCollapsed)}
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 h-full w-72 bg-surface-sidebar border-r border-surface-border z-50 transform transition-transform duration-300",
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
function Badge({ n, colapsado }: { n: number; colapsado: boolean }) {
  if (n <= 0) return null;
  if (colapsado) {
    return <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger ring-2 ring-surface-sidebar" aria-hidden />;
  }
  // Um número que se lê sem gritar: vermelho no texto, não no fundo. Com
  // vários grupos à espera, uma fila de pílulas vermelhas cheias era a coisa
  // mais forte do ecrã -- mais do que a própria página.
  return (
    <span className="ml-auto shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold inline-flex items-center justify-center tabular-nums bg-danger/10 text-danger">
      {rotuloBadge(n)}
    </span>
  );
}

/* O item da barra: o ativo ganha fundo e um traço dourado à esquerda; o
   dourado cheio ficava para os botões, que é onde se pede uma ação. */
const ITEM = "relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors";
const estilo = (ativo: boolean) => ativo
  ? "bg-surface-subtle text-text-primary font-medium before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-piquet"
  : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary";

function Grupo({ g, colapsado, aberto, alternar, fechar }: {
  g: GrupoVisivel; colapsado: boolean; aberto: boolean; alternar: () => void; fechar: () => void;
}) {
  const Icon = iconMap[g.icon] ?? LayoutDashboard;
  const simples = g.filhos.length === 1 || colapsado;

  if (simples) {
    return (
      <Link href={g.destino} onClick={fechar} title={colapsado ? g.label : undefined}
        className={cn(ITEM, estilo(g.ativo), colapsado && "justify-center px-0 before:hidden")}>
        <Icon className={cn("h-[18px] w-[18px] shrink-0", g.ativo ? "text-piquet-600" : "text-text-muted")} />
        {!colapsado && <span className="truncate">{g.label}</span>}
        <Badge n={g.badge} colapsado={colapsado} />
        <span className="sr-only">{g.badge > 0 ? `${g.badge} por tratar` : ""}</span>
      </Link>
    );
  }

  return (
    <div>
      <button onClick={alternar} aria-expanded={aberto}
        className={cn(ITEM, "w-full", g.ativo ? "text-text-primary font-medium" : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary")}>
        <Icon className={cn("h-[18px] w-[18px] shrink-0", g.ativo ? "text-piquet-600" : "text-text-muted")} />
        <span className="flex-1 text-left truncate">{g.label}</span>
        {!aberto && <Badge n={g.badge} colapsado={false} />}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-text-muted transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className="mt-0.5 space-y-0.5">
          {g.filhos.map((f) => (
            <Link key={f.href} href={f.href} onClick={fechar}
              className={cn(ITEM, "pl-[38px]", estilo(f.ativo))}>
              <span className="truncate">{f.label}</span>
              <Badge n={f.badge} colapsado={false} />
              <span className="sr-only">{f.badge > 0 ? `${f.badge} por tratar` : ""}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
