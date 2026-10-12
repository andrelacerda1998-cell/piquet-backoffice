"use client";

import { useEffect, useRef, useState } from "react";
import { getOperationAreas } from "@/services/catalogService";
import { usePathname } from "next/navigation";
import { useFilterStore, useAuthStore, useUiStore } from "@/stores";
import { getActiveFilterCount } from "@/lib/filters";
import { getPeriodLabel } from "@/lib/formatters";
import { DEFAULT_SETTINGS , NAV_ITEMS } from "@/config/dashboard";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Notificacoes } from "@/components/layout/Notificacoes";
import { Modal } from "@/components/ui/Modal";
import { hasAnyPermission } from "@/lib/permissions";
import { pedirAbertura } from "@/hooks/useAbrirPeloEndereco";
import { useThemeStore } from "@/stores";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu, Search, Filter,
  ChevronDown, X, Command, Plus, FileText, Inbox, UserPlus, StickyNote, ListChecks, BellRing, Moon, Sun, LogOut,
} from "lucide-react";
import type { Permission } from "@/types";
import type { PeriodPreset } from "@/types";

/*
  Os ecrãs que aplicam MESMO os filtros globais.

  A barra de período e o botão "Filtros" apareciam em todos os 20 ecrãs, mas só
  estes dois os usam -- nos outros dezoito escolher um período não mudava nada,
  e o contador continuava a dizer que havia um filtro ativo. Um controlo que não
  controla nada é pior do que não existir: quem filtra e vê o mesmo conclui que
  os dados estão errados.

  Quando outro ecrã passar a ler os filtros, acrescenta-se aqui.
*/
const ECRAS_COM_FILTROS = ["/servicos", "/financeiro"];

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "ultimos_7_dias", label: "Últimos 7 dias" },
  { value: "ultimos_30_dias", label: "Últimos 30 dias" },
  { value: "este_mes", label: "Este mês" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "este_trimestre", label: "Este trimestre" },
  { value: "este_ano", label: "Este ano" },
  { value: "personalizado", label: "Personalizado" },
];

export function Topbar() {
  const { filters, setFilter, clearFilters, setMobileSidebarOpen } = useFilterStore();
  /*
    Saíram do painel o "Estado" (os 18 estados técnicos, a competir com o
    filtro de estado da própria lista), a "Origem" (não filtrava nada em
    lado nenhum) e as "vistas guardadas" (só no browser de quem as criava).
    Quem os tinha escolhido ficava preso a eles sem os ver: limpam-se aqui.
  */
  useEffect(() => {
    if (filters.serviceStatus) setFilter("serviceStatus", undefined);
    if (filters.customerSource) setFilter("customerSource", undefined);
  }, [filters.serviceStatus, filters.customerSource, setFilter]);
  const { user, logout } = useAuthStore();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [showFilters, setShowFilters] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [showAvisos, setShowAvisos] = useState(false);
  const abrirComando = useUiStore((s) => s.abrirComando);
  // Os dois menus fecham ao tocar fora deles ou com Esc.
  const novoRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showNovo && !showUserMenu) return;
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (showNovo && !novoRef.current?.contains(alvo)) setShowNovo(false);
      if (showUserMenu && !userRef.current?.contains(alvo)) setShowUserMenu(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowNovo(false); setShowUserMenu(false); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [showNovo, showUserMenu]);
  const { theme, toggleTheme } = useThemeStore();
  const router = useRouter();

  /*
    "+ Novo": o que se cria sem ter de ir procurar o ecrã (auditoria, anexo F).
    Cada um abre a janela certa no sítio certo (ver useAcaoPeloEndereco); a
    nota pergunta primeiro onde, pelo ⌘K.
  */
  const NOVOS: Array<{ label: string; Icon: typeof Plus; perm?: Permission[]; href?: string; comando?: string }> = [
    { label: "Fatura", Icon: FileText, perm: ["view_finance"], href: "/financeiro?tab=custos&novo=fatura" },
    { label: "Contacto", Icon: Inbox, perm: ["view_marketing", "view_customers"], href: "/leads?novo=contacto" },
    { label: "Conta de teste", Icon: UserPlus, perm: ["manage_technicians"], href: "/tecnicos?tab=lista&novo=conta-teste" },
    { label: "Nota num pedido, cliente ou técnico", Icon: StickyNote, comando: "> nota " },
  ];
  const novos = NOVOS.filter((n) => !n.perm || (!!user && hasAnyPermission(user.role, n.perm)));
  const criar = (n: (typeof NOVOS)[number]) => {
    setShowNovo(false);
    if (n.comando) { abrirComando(n.comando); return; }
    if (n.href) { router.push(n.href); pedirAbertura(n.href); }
  };
  const activeCount = getActiveFilterCount(filters);

  const pathname = usePathname();
  const filtrosValem = ECRAS_COM_FILTROS.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  /*
    AS CATEGORIAS REAIS do catálogo (áreas de operação do Laravel).

    O filtro oferecia as 8 categorias fixas da configuração ("cat_canalizacao"),
    que não existem no Laravel: em Operações não filtrava nada, e no Financeiro
    não coincidia com serviço nenhum e deixava o ecrã vazio. Carregam-se só
    quando servem — painel aberto ou uma categoria escolhida — e, sem backend
    (modo de demonstração), ficam as fixas, que são as dos dados de exemplo.
  */
  const [areas, setAreas] = useState<{ value: string; label: string }[] | null>(null);
  const precisaDasAreas = filtrosValem && (showFilters || !!filters.categoryId);
  useEffect(() => {
    if (!precisaDasAreas || areas) return;
    getOperationAreas()
      .then((d) => setAreas(d.items.map((a) => ({ value: String(a.id), label: a.name }))))
      .catch(() => setAreas([]));
  }, [precisaDasAreas, areas]);
  const opcoesCategoria = areas && areas.length > 0
    ? areas
    : DEFAULT_SETTINGS.categories.map((c) => ({ value: c.id, label: c.name }));

  /*
    O nome do ecrã, só em telemóvel.

    Instalada, a aplicação não tem barra de endereço -- desaparece a única
    pista de onde se está. E a pesquisa, que ocupa este espaço no
    computador, está escondida abaixo dos 640px: ficava aqui uma faixa vazia
    entre o menu e os ícones.
  */
  const nomeDoEcra = NAV_ITEMS.find((i) => i.href === pathname)?.label
    ?? (pathname === "/" ? "Visão geral" : "");

  return (
    /*
      `pt-[var(--margem-topo)]`: em modo app a pagina ocupa o ecra todo, e sem
      isto este cabecalho ficava por baixo do relogio e da bateria. No browser
      e no computador a margem e zero.
    */
    <header className="sticky top-0 z-20 bg-surface border-b border-surface-border pt-[var(--margem-topo)]">
      <div className="flex items-center gap-3 px-4 h-16">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-surface-muted"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="sm:hidden flex-1 truncate font-semibold text-text-primary">{nomeDoEcra}</span>

        {/*
          A PESQUISA GLOBAL É O ⌘K, e esta caixa passa a abri-lo.

          Era um <input> chamado "Pesquisa global" que afinal escrevia num
          filtro da lista aberta -- e nem isso em produção, porque Serviços e
          Configurações usam a sua própria pesquisa. Quem escrevia um telefone
          aqui não encontrava nada e concluía que o cliente não existia. A
          pesquisa que procura de facto clientes, técnicos e serviços no
          Laravel estava ao lado, num botão com um K. Ficou uma só.
        */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex-1 max-w-md hidden sm:flex items-center gap-2 input-field text-sm text-text-muted text-left hover:bg-surface-muted transition-colors"
          aria-label="Pesquisar pedidos, clientes, técnicos e comandos"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">Pedido, cliente, técnico, telefone…</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-surface-border px-1.5 py-0.5 font-sans text-[11px] text-text-secondary">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {/* No telemóvel a caixa não cabe: fica a lupa, que abre o mesmo ⌘K. */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="sm:hidden p-2 rounded-lg hover:bg-surface-muted"
            aria-label="Pesquisar"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Período e filtros — só nos ecrãs que os aplicam (ver ECRAS_COM_FILTROS). */}
          {filtrosValem && (<>
          <select
            value={filters.period}
            onChange={(e) => setFilter("period", e.target.value as PeriodPreset)}
            className="input-field text-sm w-auto py-1.5 pr-8 hidden md:block"
            aria-label="Período"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn-secondary text-sm py-1.5 relative",
              activeCount > 0 && "border-piquet"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-piquet rounded-full text-[11px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
          </>)}

          {/*
            O botão "Exportar" que aqui estava mostrava um alert a dizer que a
            funcionalidade não estava feita -- em todos os ecrãs, desde sempre.
            Exportar bem depende do que está no ecrã, por isso vive em cada
            lista: ver "Exportar CSV" em Pedidos, que usa downloadCsv().
          */}

          <div className="relative" ref={novoRef}>
            <button
              onClick={() => setShowNovo(!showNovo)}
              className="btn-primary text-sm py-1.5 px-2.5 sm:px-3"
              aria-haspopup="menu"
              aria-expanded={showNovo}
              aria-label="Criar novo"
            >
              <Plus className="h-4 w-4" /> <span className="hidden md:inline">Novo</span>
            </button>
            {showNovo && (
              <div role="menu" className="absolute right-0 top-full mt-1 w-64 bg-surface border border-surface-border rounded-lg shadow-elevated py-1 z-50">
                {novos.map((n) => (
                  <button key={n.label} role="menuitem" onClick={() => criar(n)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted inline-flex items-center gap-2">
                    <n.Icon className="h-4 w-4 text-text-muted" /> {n.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <NotificationBell />

          {/* User menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-muted"
            >
              <div className="w-8 h-8 bg-piquet rounded-full flex items-center justify-center text-sm font-bold">
                {user?.name.charAt(0) ?? "?"}
              </div>
              <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
              <ChevronDown className="h-4 w-4 text-text-muted hidden md:block" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-surface-border rounded-lg shadow-elevated py-1 z-50">
                <div className="px-3 py-2 border-b border-surface-border">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-text-muted">{user?.email}</p>
                  <p className="text-xs text-piquet-600 mt-0.5">{user ? ROLE_LABELS[user.role] : ""}</p>
                </div>
                {/* O que é de cada pessoa vive aqui, e não no menu de toda a gente. */}
                <Link href="/tarefas" onClick={() => setShowUserMenu(false)} className="w-full px-3 py-1.5 text-sm hover:bg-surface-muted inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-text-muted" /> As minhas tarefas
                </Link>
                <button onClick={() => { setShowAvisos(true); setShowUserMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted inline-flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-text-muted" /> Avisos neste dispositivo
                </button>
                <button onClick={() => toggleTheme()} className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted inline-flex items-center gap-2">
                  {theme === "dark" ? <Sun className="h-4 w-4 text-text-muted" /> : <Moon className="h-4 w-4 text-text-muted" />}
                  {theme === "dark" ? "Tema claro" : "Tema escuro"}
                </button>
                <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-surface-muted inline-flex items-center gap-2 border-t border-surface-border mt-1">
                  <LogOut className="h-4 w-4" /> Terminar sessão
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avisos neste dispositivo: cada pessoa liga os seus, sem precisar de Configurações. */}
      <Modal open={showAvisos} onClose={() => setShowAvisos(false)} title="Avisos neste dispositivo" subtitle="Notificações no telemóvel ou no computador quando há algo à tua espera.">
        <Notificacoes />
      </Modal>

      {/* Painel de filtros — fechado, e só existe onde os filtros valem. */}
      {showFilters && filtrosValem && (
        <div className="border-t border-surface-border px-4 py-3 bg-surface-muted/30">
          <div className="flex flex-wrap gap-3 items-end">
            <FilterSelect
              label="Categoria"
              value={filters.categoryId ?? ""}
              onChange={(v) => setFilter("categoryId", v || undefined)}
              options={opcoesCategoria}
            />
            <FilterSelect
              label="Cidade"
              value={filters.city ?? ""}
              onChange={(v) => setFilter("city", v || undefined)}
              options={DEFAULT_SETTINGS.locations.map((l) => ({ value: l.name, label: l.name }))}
            />
            <div className="flex gap-2">
              <button onClick={clearFilters} className="btn-secondary text-sm py-1.5">
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.period !== "ultimos_30_dias" && (
                <FilterChip label={getPeriodLabel(filters.period)} onRemove={() => setFilter("period", "ultimos_30_dias")} />
              )}
              {filters.categoryId && (
                <FilterChip label={opcoesCategoria.find((c) => c.value === filters.categoryId)?.label ?? filters.categoryId} onRemove={() => setFilter("categoryId", undefined)} />
              )}
              {filters.city && <FilterChip label={filters.city} onRemove={() => setFilter("city", undefined)} />}
            </div>
          )}

        </div>
      )}

    </header>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field text-sm py-1.5 w-40">
        <option value="">Todos</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-piquet/15 text-xs rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-danger" aria-label={`Remover filtro ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
