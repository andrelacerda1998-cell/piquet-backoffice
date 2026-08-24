"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { canAccessRoute, hasPermission } from "@/lib/permissions";
import { PermissionDenied } from "@/components/ui/States";
import type { Permission } from "@/types";

export function RouteGuard({ children, route }: { children: React.ReactNode; route: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    /**
     * O utilizador guardado no browser não prova que a sessão ainda é válida.
     * Era esse o buraco: com a sessão do Supabase expirada, este guarda deixava
     * entrar (porque o utilizador continuava no localStorage) e depois todas as
     * chamadas devolviam 401 — "Sessão expirada" em ciclo, sem saída.
     *
     * Confirma-se a sessão real ao entrar; se não houver, sai já para o login.
     */
    let cancelado = false;
    (async () => {
      try {
        const { SUPABASE_AUTH_ENABLED, supabaseBrowser } = await import("@/lib/supabase/client");
        if (!SUPABASE_AUTH_ENABLED) return; // modo demo: não há sessão a validar
        const { data } = await supabaseBrowser().auth.getSession();
        if (!cancelado && !data.session) {
          logout();
          router.push("/login");
        }
      } catch {
        /* Supabase indisponível: não expulsa ninguém por causa de uma falha de rede. */
      }
    })();
    return () => { cancelado = true; };
  }, [user, router, logout]);

  if (!user) return null;

  if (!canAccessRoute(user.role, route)) {
    return <PermissionDenied />;
  }

  return <>{children}</>;
}

export function PermissionGate({
  permission,
  children,
  fallback,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  if (!hasPermission(user.role, permission)) {
    return fallback ?? null;
  }
  return <>{children}</>;
}
