"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toneClass, type StatusTone } from "@/lib/formatters";
import { pedirAbertura } from "@/hooks/useAbrirPeloEndereco";
import { NAV_ITEMS, NAV_VISIBLE, NAV_DEEPLINKS } from "@/config/dashboard";
import { useUiStore, useAuthStore, useThemeStore } from "@/stores";
import { canAccessRoute, hasAnyPermission } from "@/lib/permissions";
import { pedidoHref } from "@/lib/fichas";
import { searchEntities, type SearchResult, type SearchType } from "@/services/searchService";
import type { Permission } from "@/types";
import {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat,
  MapPin, Megaphone, Headphones, Bell, Settings, Search, Moon, Sun, CornerDownLeft,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText, Inbox, CreditCard, History,
  MessageSquare, Target, ListChecks, Wand2, UserPlus, Code2, MonitorSmartphone, SlidersHorizontal,
  Undo2, UserX, Ban, StickyNote, ChevronRight,
} from "lucide-react";

/*
  ⌘K: a porta de entrada para tudo (auditoria de 08/10/2026, anexo F).

  - Pesquisa: pedido pelo número, cliente e técnico pelo nome, telefone (como
    quer que esteja escrito), email ou NIF, pagamento pelo id do Payshop,
    contacto pelo telefone. Os resultados vêm agrupados por tipo, com o
    estado ao lado.
  - Caixa vazia: os últimos registos abertos daqui, as ações e as áreas.
  - Comandos, começados por ">": "> reembolsar 282", "> suspender Rui",
    "> bloquear Ana", "> nota 282", "> nova fatura"… Respeitam o perfil, e os
    perigosos abrem a MESMA confirmação (com motivo) que o botão da ficha.
*/

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, Euro, Landmark, Users, HardHat, Inbox,
  MapPin, Megaphone, Headphones, Bell, Settings,
  Radio, BookOpen, Tag, Map, ShieldCheck, FileText,
  MessageSquare, Target, ListChecks, Wand2, UserPlus, Code2, MonitorSmartphone, SlidersHorizontal,
};

type Item = {
  id: string;
  label: string;
  sublabel?: string;
  hint?: string;
  estado?: string;
  tom?: StatusTone;
  Icon: React.ComponentType<{ className?: string }>;
  /** Corre o item (navegar, mudar o tema…). */
  run?: () => void;
  /** Em vez de correr, completa a caixa: comandos que precisam de um argumento. */
  completar?: string;
};
type Grupo = { titulo: string; itens: Item[] };

const TYPE_ICON: Record<SearchType, React.ComponentType<{ className?: string }>> = {
  service: Wrench, customer: Users, technician: HardHat, payment: CreditCard,
  invoice: FileText, lead: Inbox, ticket: Headphones,
};

const TITULO_DO_GRUPO: Record<SearchType, string> = {
  service: "Pedidos", customer: "Clientes", technician: "Técnicos", payment: "Pagamentos",
  lead: "Contactos", ticket: "Tickets", invoice: "Faturas",
};
const ORDEM: SearchType[] = ["service", "customer", "technician", "payment", "lead", "ticket", "invoice"];

/** As ações do ⌘K. `perm`: basta uma. As que pedem um argumento completam a caixa. */
const ACOES: Array<{
  id: string; label: string; sublabel?: string; perm?: Permission[];
  Icon: React.ComponentType<{ className?: string }>; href?: string; completar?: string;
}> = [
  { id: "nova-fatura", label: "Nova fatura", sublabel: "Custos e faturas", perm: ["view_finance"], Icon: FileText, href: "/financeiro?tab=custos&novo=fatura" },
  { id: "novo-contacto", label: "Novo contacto", sublabel: "Alguém que pediu informação", perm: ["view_marketing", "view_customers"], Icon: Inbox, href: "/leads?novo=contacto" },
  { id: "conta-teste", label: "Criar conta de teste de técnico", perm: ["manage_technicians"], Icon: UserPlus, href: "/tecnicos?tab=lista&novo=conta-teste" },
  { id: "lote", label: "Criar lote de transferências", sublabel: "Pagamentos a técnicos", perm: ["pay_technicians"], Icon: Euro, href: "/financeiro?tab=pagamentos" },
  { id: "reembolsar", label: "Reembolsar um pedido…", sublabel: "Escreve o número: > reembolsar 282", perm: ["refund_payments"], Icon: Undo2, completar: "> reembolsar " },
  { id: "suspender", label: "Suspender um técnico…", sublabel: "Escreve o nome: > suspender Rui", perm: ["manage_technicians"], Icon: UserX, completar: "> suspender " },
  { id: "bloquear", label: "Bloquear um cliente…", sublabel: "Escreve o nome: > bloquear Ana", perm: ["destructive_actions"], Icon: Ban, completar: "> bloquear " },
  { id: "nota", label: "Escrever uma nota…", sublabel: "Num pedido, cliente ou técnico: > nota 282", Icon: StickyNote, completar: "> nota " },
];

/** Os verbos que procuram um registo para agir sobre ele, e o que fazem quando se escolhe. */
const VERBOS: Record<string, { tipos: SearchType[]; perm?: Permission[]; rotulo: (r: SearchResult) => string; parametro: [string, string] }> = {
  suspender: { tipos: ["technician"], perm: ["manage_technicians"], rotulo: (r) => `Suspender ${r.title}`, parametro: ["acao", "suspender"] },
  bloquear: { tipos: ["customer"], perm: ["destructive_actions"], rotulo: (r) => `Bloquear ${r.title}`, parametro: ["acao", "bloquear"] },
  nota: { tipos: ["service", "customer", "technician"], rotulo: (r) => `Nota em ${r.title}`, parametro: ["nota", "1"] },
};

/** Junta um parâmetro a um endereço, tenha ele já query ou não. */
function comParametro(href: string, chave: string, valor: string): string {
  const url = new URL(href, "http://x");
  url.searchParams.set(chave, valor);
  return url.pathname + url.search;
}

/* -------- Abertos recentemente (por pessoa, neste browser; é uma conveniência) -------- */
const RECENTES_MAX = 5;
const chaveRecentes = (userId?: string) => `piquet:cmdk:recentes:${userId ?? "anon"}`;
function lerRecentes(userId?: string): SearchResult[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(chaveRecentes(userId)) ?? "[]");
    return Array.isArray(v) ? v.slice(0, RECENTES_MAX) : [];
  } catch { return []; }
}
function guardarRecente(userId: string | undefined, r: SearchResult) {
  try {
    const lista = [r, ...lerRecentes(userId).filter((x) => !(x.type === r.type && x.id === r.id))].slice(0, RECENTES_MAX);
    window.localStorage.setItem(chaveRecentes(userId), JSON.stringify(lista));
  } catch { /* sem armazenamento: fica sem recentes */ }
}

export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen, commandTexto } = useUiStore();
  const user = useAuthStore((s) => s.user);
  const { theme, toggleTheme } = useThemeStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recentes, setRecentes] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

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
      // Aberto pelo "+ Novo › Nota" vem já com "> nota " escrito.
      setQuery(commandTexto);
      setActive(0);
      setRecentes(lerRecentes(user?.id));
      setTimeout(() => inputRef.current?.focus(), 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandOpen, user?.id]);

  const pode = (perm?: Permission[]) => !perm || perm.length === 0 || (!!user && hasAnyPermission(user.role, perm));

  // O que se escreveu: pesquisa normal, ou comando (">"), com o verbo e o argumento.
  const modoComando = query.trimStart().startsWith(">");
  const texto = (modoComando ? query.trimStart().slice(1) : query).trim();
  const [verbo = "", ...resto] = texto.split(/\s+/);
  const argumento = resto.join(" ").trim();
  const verboComPesquisa = modoComando ? VERBOS[verbo.toLowerCase()] : undefined;
  const termo = modoComando ? (verboComPesquisa && pode(verboComPesquisa.perm) ? argumento : "") : texto;

  /* -------------------------------- Áreas e separadores -------------------------------- */
  const areas = useMemo<Item[]>(() => {
    const byHref = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]));
    const canSee = (i?: (typeof NAV_ITEMS)[number]): i is (typeof NAV_ITEMS)[number] =>
      !!i && (user ? canAccessRoute(user.role, i.href.split("?")[0]) : false);
    const toItem = (hint: string) => (i: (typeof NAV_ITEMS)[number]): Item => ({
      id: `nav:${i.href}`, label: i.label, hint, Icon: iconMap[i.icon] ?? LayoutDashboard,
      run: () => router.push(i.href),
    });
    return [
      ...NAV_VISIBLE.map((h) => byHref[h]).filter(canSee).map(toItem("Área")),
      ...NAV_DEEPLINKS.map((h) => byHref[h]).filter(canSee).map(toItem("Separador")),
    ];
  }, [user, router]);

  /* -------------------------------------- Ações -------------------------------------- */
  const acoes = useMemo<Item[]>(() => [
    ...ACOES.filter((a) => pode(a.perm)).map((a): Item => ({
      id: `acao:${a.id}`, label: a.label, sublabel: a.sublabel, hint: "Ação", Icon: a.Icon,
      completar: a.completar,
      run: a.href ? () => { router.push(a.href!); pedirAbertura(a.href!); } : undefined,
    })),
    {
      id: "acao:tema", label: theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro",
      hint: "Ação", Icon: theme === "dark" ? Sun : Moon, run: () => toggleTheme(),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [user, theme, router, toggleTheme]);

  /* ------------------------- Pesquisa de registos no servidor ------------------------- */
  const [resultados, setResultados] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = termo;
    if (q.length < 2 && !/^#?\d$/.test(q)) { setResultados([]); setSearching(false); return; }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await searchEntities(q);
        if (alive) setResultados(r);
      } catch { if (alive) setResultados([]); }
      finally { if (alive) setSearching(false); }
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [termo]);

  const abrirRegisto = (r: SearchResult, href = r.href) => {
    guardarRecente(user?.id, r);
    router.push(href);
    // Se a página já estiver aberta, não volta a montar: avisa-a.
    pedirAbertura(href);
  };
  const itemDoRegisto = (r: SearchResult): Item => ({
    id: `ent:${r.type}:${r.id}`, label: r.title, sublabel: r.subtitle, hint: r.typeLabel,
    estado: r.estado, tom: r.tom, Icon: TYPE_ICON[r.type] ?? Search, run: () => abrirRegisto(r),
  });

  /* ------------------------------------ Os grupos ------------------------------------ */
  const grupos = useMemo<Grupo[]>(() => {
    const filtra = (lista: Item[], t: string, max = 99) => {
      const q = t.toLowerCase();
      return (q ? lista.filter((c) => c.label.toLowerCase().includes(q) || c.sublabel?.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)) : lista).slice(0, max);
    };

    if (modoComando) {
      const out: Grupo[] = [];
      // "> reembolsar 282"
      const num = argumento.replace("#", "");
      if (verbo.toLowerCase() === "reembolsar" && /^\d+$/.test(num) && pode(["refund_payments"])) {
        const href = comParametro(pedidoHref(num), "acao", "reembolsar");
        out.push({ titulo: "Fazer", itens: [{
          id: `fazer:reembolsar:${num}`, label: `Reembolsar o pedido #${num}`,
          sublabel: "Abre o pedido com a confirmação do reembolso (valor e motivo)", Icon: Undo2,
          run: () => { router.push(href); pedirAbertura(href); },
        }] });
      }
      // "> suspender Rui", "> bloquear Ana", "> nota 282"
      if (verboComPesquisa && pode(verboComPesquisa.perm)) {
        const alvos = resultados.filter((r) => verboComPesquisa.tipos.includes(r.type));
        if (alvos.length) {
          out.push({ titulo: "Fazer", itens: alvos.map((r) => ({
            ...itemDoRegisto(r), id: `fazer:${verbo}:${r.type}:${r.id}`, label: verboComPesquisa.rotulo(r),
            run: () => abrirRegisto(r, comParametro(r.href, ...verboComPesquisa.parametro)),
          })) });
        }
      }
      const outrasAcoes = filtra(acoes, verboComPesquisa ? "" : texto);
      if (!verboComPesquisa && outrasAcoes.length) out.push({ titulo: "Ações", itens: outrasAcoes });
      if (!verboComPesquisa) {
        const ir = filtra(areas, texto.replace(/^ir\s*(para)?\s*/i, ""));
        if (ir.length) out.push({ titulo: "Ir para", itens: ir });
      }
      return out;
    }

    if (!texto) {
      return [
        { titulo: "Abertos recentemente", itens: recentes.map(itemDoRegisto).map((i) => ({ ...i, id: `rec:${i.id}` })) },
        { titulo: "Ações", itens: acoes },
        { titulo: "Ir para", itens: areas.filter((a) => a.hint === "Área") },
      ].filter((g) => g.itens.length > 0);
    }

    const out: Grupo[] = [];
    const ir = filtra(areas, texto, 5);
    if (ir.length) out.push({ titulo: "Ir para", itens: ir });
    for (const tipo of ORDEM) {
      const doTipo = resultados.filter((r) => r.type === tipo);
      if (doTipo.length) out.push({ titulo: TITULO_DO_GRUPO[tipo], itens: doTipo.map(itemDoRegisto) });
    }
    const acoesQueBatem = filtra(acoes, texto, 4);
    if (acoesQueBatem.length) out.push({ titulo: "Ações", itens: acoesQueBatem });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoComando, texto, verbo, argumento, resultados, recentes, acoes, areas, verboComPesquisa]);

  const planos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, planos.length - 1)));
  }, [planos.length]);

  // O item ativo fica sempre à vista quando se anda com as setas.
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-indice="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!commandOpen) return null;

  const runAt = (i: number) => {
    const cmd = planos[i];
    if (!cmd) return;
    if (cmd.completar) {
      setQuery(cmd.completar);
      setActive(0);
      inputRef.current?.focus();
      return;
    }
    cmd.run?.();
    setCommandOpen(false);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % Math.max(1, planos.length)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + planos.length) % Math.max(1, planos.length)); }
    if (e.key === "Enter") { e.preventDefault(); runAt(active); }
  };

  const vazio = planos.length === 0;
  let indice = -1;

  return (
    /*
      Acima dos Modal (z-[65]): um ⌘K aberto por cima de uma janela ficava
      por trás dela, invisível, com o cursor na caixa escondida.
    */
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[8vh] sm:pt-[12vh] px-3 sm:px-4"
      onClick={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-xl card overflow-hidden shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
        role="dialog"
        aria-modal="true"
        aria-label="Pesquisar e comandos"
      >
        <div className="flex items-center gap-2 px-4 border-b border-surface-border">
          {modoComando ? <ChevronRight className="h-4 w-4 text-piquet-600 shrink-0" /> : <Search className="h-4 w-4 text-text-muted shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Pedido, cliente, técnico, telefone, NIF… ou > para comandos"
            className="w-full bg-transparent py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            aria-label="Pesquisar ou escrever um comando"
          />
          <kbd className="hidden sm:block text-[11px] font-medium text-text-muted border border-surface-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listaRef} className="max-h-[60vh] sm:max-h-[26rem] overflow-y-auto py-1">
          {vazio ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              {searching ? "A pesquisar…"
                : modoComando && verboComPesquisa && !argumento ? `Escreve ${verbo === "nota" ? "o número do pedido ou o nome" : "o nome"} a seguir a “${verbo}”.`
                : modoComando ? "Nenhum comando com esse nome. Experimenta “> reembolsar 282” ou “> nova fatura”."
                : `Sem resultados para “${query}”.`}
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.titulo} className="py-1">
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{g.titulo}</p>
                {g.itens.map((c) => {
                  indice += 1;
                  const i = indice;
                  return (
                    <button
                      key={c.id}
                      data-indice={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                        i === active ? "bg-piquet/15 text-text-primary" : "text-text-secondary",
                      )}
                    >
                      {g.titulo === "Abertos recentemente"
                        ? <History className={cn("h-4 w-4 shrink-0", i === active ? "text-piquet-600" : "text-text-muted")} />
                        : <c.Icon className={cn("h-4 w-4 shrink-0", i === active ? "text-piquet-600" : "text-text-muted")} />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-text-primary truncate">{c.label}</span>
                        {c.sublabel && <span className="block text-xs text-text-muted truncate">{c.sublabel}</span>}
                      </span>
                      {c.estado && (
                        <span className={cn("hidden sm:inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", toneClass(c.tom ?? "neutral"))}>
                          {c.estado}
                        </span>
                      )}
                      <span className="text-xs text-text-muted shrink-0">{c.completar ? "…" : c.hint}</span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-text-muted shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {searching && !vazio && (
            <p className="px-4 py-1.5 text-center text-xs text-text-muted">A pesquisar…</p>
          )}
        </div>
        <div className="hidden sm:flex items-center justify-between gap-3 border-t border-surface-border px-4 py-2 text-[11px] text-text-muted">
          <span>↑↓ para escolher · Enter para abrir</span>
          <span>Escreve <kbd className="font-mono">&gt;</kbd> para comandos</span>
        </div>
      </div>
    </div>
  );
}
