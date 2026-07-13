import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardFilter, SavedFilterView, User, UserRole } from "@/types";
import { DEFAULT_FILTER } from "@/lib/filters";
import { clearAuthToken } from "@/services/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

const DEMO_USERS: Record<UserRole, User> = {
  ceo: { id: "u2", name: "André Lacerda", email: "andre@piquet.pt", role: "ceo", department: "Direção" },
  cto: { id: "u1", name: "Rodrigo Pacheco", email: "rodrigo@piquet.pt", role: "cto", department: "Tecnologia" },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Arranca DESLOGADO — o utilizador tem de passar pela página de login.
      user: null,
      isAuthenticated: false,
      login: (role) => set({ user: DEMO_USERS[role], isAuthenticated: true }),
      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () => {
        clearAuthToken();
        set({ user: null, isAuthenticated: false });
      },
    }),
    // v3: invalida sessões antigas (role "administrador" deixou de existir) — força re-login.
    { name: "piquet-auth-v3" }
  )
);

interface FilterState {
  filters: DashboardFilter;
  savedViews: SavedFilterView[];
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  setFilter: <K extends keyof DashboardFilter>(key: K, value: DashboardFilter[K]) => void;
  setFilters: (filters: Partial<DashboardFilter>) => void;
  clearFilters: () => void;
  saveView: (name: string) => void;
  loadView: (viewId: string) => void;
  deleteView: (viewId: string) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      filters: DEFAULT_FILTER,
      savedViews: [],
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),
      clearFilters: () => set({ filters: DEFAULT_FILTER }),
      saveView: (name) => {
        const view: SavedFilterView = {
          id: `view_${Date.now()}`,
          name,
          filters: { ...get().filters },
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ savedViews: [...s.savedViews, view] }));
      },
      loadView: (viewId) => {
        const view = get().savedViews.find((v) => v.id === viewId);
        if (view) set({ filters: view.filters });
      },
      deleteView: (viewId) =>
        set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== viewId) })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    }),
    { name: "piquet-filters" }
  )
);

import { DEFAULT_SETTINGS } from "@/config/dashboard";
import type { DashboardSettings } from "@/types";

interface SettingsState {
  settings: DashboardSettings;
  updateSettings: (partial: Partial<DashboardSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
    }),
    { name: "piquet-settings" }
  )
);

export { DEMO_USERS };

/* -------------------------------- Toasts -------------------------------- */

export type ToastType = "success" | "error" | "info";
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "success") => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Helper para disparar um toast fora de componentes React. */
export function toast(message: string, type: ToastType = "success") {
  useToastStore.getState().addToast(message, type);
}

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface UiState {
  commandOpen: boolean;
  welcomeDismissed: boolean;
  setCommandOpen: (open: boolean) => void;
  dismissWelcome: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      commandOpen: false,
      welcomeDismissed: false,
      setCommandOpen: (open) => set({ commandOpen: open }),
      dismissWelcome: () => set({ welcomeDismissed: true }),
    }),
    {
      name: "piquet-ui",
      partialize: (s) => ({ welcomeDismissed: s.welcomeDismissed }),
    }
  )
);

export interface AppNotification {
  id: string;
  kind: "ticket" | "sistema";
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
  ticketId?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, "id" | "at" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      addNotification: (n) =>
        set((s) => {
          // Dedupe por ticketId — não notifica o mesmo ticket duas vezes.
          if (n.ticketId && s.notifications.some((x) => x.ticketId === n.ticketId)) return s;
          return {
            notifications: [
              { ...n, id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), read: false },
              ...s.notifications,
            ].slice(0, 50),
          };
        }),
      markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      clearAll: () => set({ notifications: [] }),
    }),
    { name: "piquet-notifications" }
  )
);

/**
 * Overlay persistido de mutações (localStorage, key `piquet-data`).
 *
 * As páginas leem os dados mock/backend e aplicam por cima estas alterações,
 * para que respostas de suporte, faturas criadas, etc. sobrevivam ao refresh.
 * Padrão reutilizável — basta acrescentar novos domínios aqui.
 */
export interface PersistedTicketMsg {
  id: string;
  author: "cliente" | "agente";
  authorName: string;
  body: string;
  at: string;
}

// Estrutura mínima de fatura persistida (espelha Invoice em financeService).
export interface PersistedInvoice {
  id: string;
  number: string;
  entity: string;
  description: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paga" | "pendente" | "vencida";
}

interface DataOverridesState {
  // Suporte
  ticketReplies: Record<string, PersistedTicketMsg[]>;
  ticketStatus: Record<string, string>;
  addTicketReply: (ticketId: string, msg: PersistedTicketMsg) => void;
  setTicketStatus: (ticketId: string, status: string) => void;
  // Faturas
  extraInvoices: PersistedInvoice[];
  invoicePaid: Record<string, boolean>;
  addInvoice: (inv: PersistedInvoice) => void;
  markInvoicePaid: (id: string) => void;
  // Listas geridas genéricas (preços, zonas, catálogo, etc.) — persiste a lista inteira por domínio.
  lists: Record<string, unknown[]>;
  setList: (domain: string, items: unknown[]) => void;
  resetList: (domain: string) => void;
}

export const useDataStore = create<DataOverridesState>()(
  persist(
    (set) => ({
      ticketReplies: {},
      ticketStatus: {},
      addTicketReply: (ticketId, msg) =>
        set((s) => ({ ticketReplies: { ...s.ticketReplies, [ticketId]: [...(s.ticketReplies[ticketId] ?? []), msg] } })),
      setTicketStatus: (ticketId, status) =>
        set((s) => ({ ticketStatus: { ...s.ticketStatus, [ticketId]: status } })),
      extraInvoices: [],
      invoicePaid: {},
      addInvoice: (inv) => set((s) => ({ extraInvoices: [inv, ...s.extraInvoices] })),
      markInvoicePaid: (id) => set((s) => ({ invoicePaid: { ...s.invoicePaid, [id]: true } })),
      lists: {},
      setList: (domain, items) => set((s) => ({ lists: { ...s.lists, [domain]: items } })),
      resetList: (domain) => set((s) => {
        const next = { ...s.lists };
        delete next[domain];
        return { lists: next };
      }),
    }),
    { name: "piquet-data" }
  )
);

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
    }),
    {
      name: "piquet-theme",
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    }
  )
);
