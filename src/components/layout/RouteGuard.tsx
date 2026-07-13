"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { canAccessRoute, hasPermission } from "@/lib/permissions";
import { PermissionDenied } from "@/components/ui/States";
import type { Permission } from "@/types";

export function RouteGuard({ children, route }: { children: React.ReactNode; route: string }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

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
