import { redirect } from "next/navigation";

/**
 * A "Equipa" (conversas, tarefas da equipa e agenda) saiu do backoffice a
 * 12/10/2026: sem uso desde julho, ao lado do WhatsApp e do Google Calendar
 * que a equipa já usa. As mensagens e tarefas continuam no Supabase. As
 * tarefas pessoais estão em "As minhas tarefas", no menu do utilizador.
 */
export default function EquipaRedirect() {
  redirect("/");
}
