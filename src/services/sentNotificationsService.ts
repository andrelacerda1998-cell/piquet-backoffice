import { apiGet } from "./api";
import type { PaginatedResult } from "@/types";

/**
 * Sent Notifications — migrado do Filament (SentNotificationResource) para a
 * API de admin do Laravel. Só leitura: histórico do que já foi mesmo enviado
 * a clientes/técnicos (tabela `notifications`), distinto do tab "Push" em
 * Marketing (que serve para CRIAR campanhas, não para ver o que já saiu).
 * Ver src/lib/laravelAdmin.ts e src/app/api/sent-notifications/*.
 */
export interface SentNotification {
  id: string;
  recipient: { id: number; name: string } | null;
  recipient_type: "customer" | "vendor" | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export interface NotificationTypeOption {
  value: string;
  label: string;
}

interface SentNotificationsApiData {
  items: SentNotification[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface SentNotificationFilters {
  search?: string;
  type?: string;
  read?: "read" | "unread";
  recipientType?: "customer" | "vendor";
}

export async function getSentNotifications(
  page = 1,
  pageSize = 20,
  filters: SentNotificationFilters = {}
): Promise<PaginatedResult<SentNotification>> {
  const raw = await apiGet<SentNotificationsApiData>(
    "/sent-notifications",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: pageSize, total: 0 } }),
    {
      page,
      per_page: pageSize,
      search: filters.search,
      type: filters.type,
      read: filters.read,
      recipient_type: filters.recipientType,
    }
  ).then((r) => r.data);

  return {
    data: raw.items,
    total: raw.meta.total,
    page: raw.meta.current_page,
    pageSize: raw.meta.per_page,
    totalPages: raw.meta.last_page,
  };
}

export async function getSentNotificationTypes(): Promise<NotificationTypeOption[]> {
  return apiGet<{ items: NotificationTypeOption[] }>(
    "/sent-notifications/types",
    () => ({ items: [] })
  ).then((r) => r.data.items);
}
