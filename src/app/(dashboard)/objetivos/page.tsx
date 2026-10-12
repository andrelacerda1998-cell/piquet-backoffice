import { redirect } from "next/navigation";

/** Os objetivos do ano estão em Crescimento › Objetivos e relatórios (12/10/2026). */
export default function ObjetivosRedirect() {
  redirect("/crescimento?tab=objetivos");
}
