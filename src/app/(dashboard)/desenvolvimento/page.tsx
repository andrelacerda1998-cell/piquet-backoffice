import { redirect } from "next/navigation";

/**
 * O quadro de desenvolvimento saiu do backoffice a 12/10/2026 (sem uso desde
 * 02/09; o trabalho do CTO vive no GitHub). As tarefas continuam na tabela
 * dev_tasks do Supabase.
 */
export default function DesenvolvimentoRedirect() {
  redirect("/");
}
