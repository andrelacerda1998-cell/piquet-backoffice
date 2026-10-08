import { NAV_GROUPS, NAV_ITEMS, NAV_ROTULO_NO_GRUPO, type NavGroup } from "@/config/dashboard";
import { canAccessRoute } from "@/lib/permissions";
import type { UserRole } from "@/types";

/** O menu de um perfil, já filtrado e com o grupo ativo marcado. */
export interface GrupoVisivel {
  id: string;
  label: string;
  icon: string;
  /** Para onde vai o clique no grupo: o primeiro ecrã do grupo que o perfil vê. */
  destino: string;
  filhos: Array<{ href: string; label: string; icon: string; ativo: boolean; badge: number }>;
  ativo: boolean;
  /** Soma dos avisos dos filhos — o que se mostra com o grupo fechado. */
  badge: number;
}

const ITEM = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]));

/** A página está neste ecrã? A Visão Geral só na raiz; os outros incluem as subpáginas. */
export function estaEm(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function gruposVisiveis(
  role: UserRole | undefined,
  pathname: string,
  badges: Record<string, number>,
  grupos: readonly NavGroup[] = NAV_GROUPS,
): GrupoVisivel[] {
  if (!role) return [];
  return grupos
    .map((g) => {
      const filhos = g.filhos
        .filter((href) => canAccessRoute(role, href) && ITEM[href])
        .map((href) => ({
          href,
          label: NAV_ROTULO_NO_GRUPO[href] ?? ITEM[href].label,
          icon: ITEM[href].icon,
          ativo: estaEm(pathname, href),
          badge: badges[href] ?? 0,
        }));
      return {
        id: g.id,
        label: g.label,
        icon: g.icon,
        destino: filhos[0]?.href ?? "",
        filhos,
        ativo: filhos.some((f) => f.ativo),
        badge: filhos.reduce((s, f) => s + f.badge, 0),
      };
    })
    .filter((g) => g.filhos.length > 0);
}
