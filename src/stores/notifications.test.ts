import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "@/stores";

function reset() {
  useNotificationStore.setState({ notifications: [] });
}

describe("useNotificationStore", () => {
  beforeEach(reset);

  it("adiciona notificações por ler no topo", () => {
    useNotificationStore.getState().addNotification({ kind: "ticket", title: "T1", body: "b", ticketId: "t1" });
    const list = useNotificationStore.getState().notifications;
    expect(list).toHaveLength(1);
    expect(list[0].read).toBe(false);
  });

  it("dedupe: não notifica o mesmo ticketId duas vezes", () => {
    const add = useNotificationStore.getState().addNotification;
    add({ kind: "ticket", title: "T", body: "b", ticketId: "t1" });
    add({ kind: "ticket", title: "T de novo", body: "b2", ticketId: "t1" });
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it("markAllRead marca tudo lido", () => {
    const add = useNotificationStore.getState().addNotification;
    add({ kind: "ticket", title: "A", body: "b", ticketId: "t1" });
    add({ kind: "ticket", title: "B", body: "b", ticketId: "t2" });
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true);
  });
});
