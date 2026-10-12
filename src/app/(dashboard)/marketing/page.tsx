import { redirect } from "next/navigation";

/** O Marketing é um separador de Crescimento (12/10/2026). Este endereço continua a funcionar. */
export default function MarketingPage() {
  redirect("/crescimento?tab=marketing");
}
