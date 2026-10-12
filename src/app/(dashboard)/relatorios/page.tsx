import { redirect } from "next/navigation";

/** Os relatórios estão em Crescimento › Objetivos e relatórios (12/10/2026). */
export default function RelatoriosRedirect() {
  redirect("/crescimento?tab=objetivos");
}
