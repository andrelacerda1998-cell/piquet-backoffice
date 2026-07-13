/**
 * Cliente para o backend REAL do Piquet app (Express em `~/dev/piquet/backend`).
 *
 * O dashboard e a app Flutter partilham este backend. Estes endpoints `/admin/*`
 * devolvem dados agregados de TODOS os utilizadores (reservas criadas na app).
 *
 * URL configurável por `NEXT_PUBLIC_PIQUET_API` (default http://localhost:3100).
 */

import { httpRequest } from "./http";

const BASE = (process.env.NEXT_PUBLIC_PIQUET_API ?? "http://localhost:3100").replace(/\/$/, "");
// Chave partilhada dos endpoints /admin/* do backend (header x-admin-key).
const ADMIN_KEY = process.env.NEXT_PUBLIC_PIQUET_ADMIN_KEY ?? "dev-admin-key";
const ADMIN_HEADERS = { "x-admin-key": ADMIN_KEY };

export const PIQUET_API_BASE = BASE;

export interface AppBooking {
  id: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  categoryId: string;
  technicianId: string;
  technicianName: string;
  technicianRating: number;
  technicianJobs: number;
  technicianHourlyRate: number;
  technicianVerified: boolean;
  technicianIsNew: boolean;
  scheduledAt: string;
  immediate: boolean;
  price: number;
  address: string;
  status: string;
  paid: boolean;
  paymentMethod: string;
}

export interface AppStats {
  users: number;
  bookings: number;
  revenue: number;
  paid: number;
}

export interface AppUser {
  email: string;
  name: string;
  bookings: number;
}

const get = <T>(path: string): Promise<T> => httpRequest<T>(BASE, path, { headers: ADMIN_HEADERS });
const put = <T>(path: string, body: unknown): Promise<T> => httpRequest<T>(BASE, path, { method: "PUT", body, headers: ADMIN_HEADERS });

/** Estados de reserva válidos na app Flutter (BookingStatus). */
export type AppBookingStatus = "pending" | "confirmed" | "declined";

/** Técnico no formato que a app Flutter exige (Technician.fromJson). */
export interface TechnicianPayload {
  id: string;
  name: string;
  rating: number;
  jobs: number;
  hourlyRate: number;
  verified?: boolean;
  isNew?: boolean;
}

/** Escreve de volta na app: estado, pagamento, agendamento e/ou técnico. */
export async function updateAppBooking(
  id: string,
  patch: { status?: AppBookingStatus; paid?: boolean; scheduledAt?: string; technician?: TechnicianPayload }
): Promise<void> {
  await put(`/admin/bookings/${id}`, patch);
}

/** Atualiza um técnico (verificado, €/hora, etc.) em todas as reservas dele. */
export async function updateAppTechnician(
  id: string,
  patch: { verified?: boolean; isNew?: boolean; hourlyRate?: number; rating?: number }
): Promise<{ updated: number }> {
  return put<{ ok: boolean; updated: number }>(`/admin/technicians/${id}`, patch);
}

interface RawBooking {
  id: string;
  categoryId?: string;
  serviceName?: string;
  technician?: { id?: string; name?: string; rating?: number; jobs?: number; hourlyRate?: number; verified?: boolean; isNew?: boolean };
  immediate?: boolean;
  scheduledAt?: string;
  price?: number;
  address?: string;
  status?: string;
  paid?: boolean;
  paymentMethod?: string;
  customerEmail?: string;
  customerName?: string;
}

export async function getAppBookings(): Promise<AppBooking[]> {
  const raw = await get<RawBooking[]>("/admin/bookings");
  return raw.map((b) => ({
    id: b.id,
    customerName: b.customerName ?? b.customerEmail ?? "—",
    customerEmail: b.customerEmail ?? "",
    serviceName: b.serviceName ?? "—",
    categoryId: b.categoryId ?? "",
    technicianId: b.technician?.id ?? b.technician?.name ?? "—",
    technicianName: b.technician?.name ?? "—",
    technicianRating: b.technician?.rating ?? 0,
    technicianJobs: b.technician?.jobs ?? 0,
    technicianHourlyRate: b.technician?.hourlyRate ?? 0,
    technicianVerified: !!b.technician?.verified,
    technicianIsNew: !!b.technician?.isNew,
    scheduledAt: b.scheduledAt ?? "",
    immediate: !!b.immediate,
    price: Number(b.price) || 0,
    address: b.address ?? "",
    status: b.status ?? "",
    paid: !!b.paid,
    paymentMethod: b.paymentMethod ?? "—",
  }));
}

export async function getAppStats(): Promise<AppStats> {
  return get<AppStats>("/admin/stats");
}

export async function getAppUsers(): Promise<AppUser[]> {
  return get<AppUser[]>("/admin/users");
}

/** Cliente real da app, enriquecido com as suas reservas. */
export interface AppCustomer {
  email: string;
  name: string;
  bookingsCount: number;
  paidCount: number;
  totalSpent: number;
  lastServiceAt: string | null;
  avgRating: number;
  bookings: AppBooking[];
}

/** Técnico real, extraído das reservas da app. */
export interface AppTechnician {
  id: string;
  name: string;
  rating: number;
  jobs: number;
  hourlyRate: number;
  verified: boolean;
  isNew: boolean;
  bookingsCount: number;
  revenue: number;
  categories: string[];
  lastServiceAt: string | null;
  bookings: AppBooking[];
}

/** Extrai e agrega os técnicos que aparecem nas reservas reais da app. */
export async function getAppTechnicians(): Promise<AppTechnician[]> {
  const bookings = await getAppBookings();
  const byTech = new Map<string, AppBooking[]>();
  for (const b of bookings) {
    if (!b.technicianId || b.technicianId === "—") continue;
    const arr = byTech.get(b.technicianId) ?? [];
    arr.push(b);
    byTech.set(b.technicianId, arr);
  }
  return [...byTech.entries()].map(([id, list]) => {
    const first = list[0];
    const dates = list.map((b) => b.scheduledAt).filter(Boolean).sort();
    return {
      id,
      name: first.technicianName,
      rating: Math.max(...list.map((b) => b.technicianRating), 0),
      jobs: Math.max(...list.map((b) => b.technicianJobs), 0),
      hourlyRate: first.technicianHourlyRate,
      verified: list.some((b) => b.technicianVerified),
      isNew: list.every((b) => b.technicianIsNew),
      bookingsCount: list.length,
      revenue: list.reduce((s, b) => s + b.price, 0),
      categories: [...new Set(list.map((b) => b.categoryId))],
      lastServiceAt: dates.length ? dates[dates.length - 1] : null,
      bookings: list,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

/** Combina /admin/users com /admin/bookings para dar clientes reais com métricas. */
export async function getAppCustomers(): Promise<AppCustomer[]> {
  const [users, bookings] = await Promise.all([getAppUsers(), getAppBookings()]);
  const byEmail = new Map<string, AppBooking[]>();
  for (const b of bookings) {
    const arr = byEmail.get(b.customerEmail) ?? [];
    arr.push(b);
    byEmail.set(b.customerEmail, arr);
  }
  return users.map((u) => {
    const list = byEmail.get(u.email) ?? [];
    const ratings = list.map((b) => b.technicianRating).filter((r) => r > 0);
    const dates = list.map((b) => b.scheduledAt).filter(Boolean).sort();
    return {
      email: u.email,
      name: u.name,
      bookingsCount: list.length,
      paidCount: list.filter((b) => b.paid).length,
      totalSpent: list.reduce((s, b) => s + b.price, 0),
      lastServiceAt: dates.length ? dates[dates.length - 1] : null,
      avgRating: ratings.length ? +(ratings.reduce((a, r) => a + r, 0) / ratings.length).toFixed(1) : 0,
      bookings: list,
    };
  });
}

// ---- Tickets de suporte da app Profissionais --------------------------------
// A primeira mensagem de um técnico no chat de suporte da app abre um ticket;
// aqui a equipa lista, responde (a resposta chega ao chat da app) e fecha.

export interface ProSupportMessage {
  text: string;
  fromPro: boolean;
  time: string;
  read: boolean;
}

export interface ProSupportTicket {
  proEmail: string;
  proName: string;
  ticketId: string | null;
  status: "open" | "closed";
  messages: ProSupportMessage[];
  lastMessageAt: string;
  unread: number;
}

const post = <T>(path: string, body?: unknown): Promise<T> =>
  httpRequest<T>(BASE, path, { method: "POST", body, headers: ADMIN_HEADERS });

export const getProSupportTickets = (): Promise<ProSupportTicket[]> =>
  get<ProSupportTicket[]>("/admin/support-tickets");

export const replyProSupportTicket = (proEmail: string, text: string): Promise<ProSupportMessage> =>
  post<ProSupportMessage>(`/admin/support-tickets/${encodeURIComponent(proEmail)}/reply`, { text });

export const closeProSupportTicket = (proEmail: string): Promise<void> =>
  put(`/admin/support-tickets/${encodeURIComponent(proEmail)}`, { status: "closed" });
