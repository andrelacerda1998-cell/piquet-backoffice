import { redirect } from "next/navigation";

/**
 * "Onboarding de técnicos" passou a fazer parte de Técnicos (08/10/2026).
 *
 * Os contadores e o funil repetiam o Resumo de Técnicos com outros nomes e
 * outros totais ("Prontos a trabalhar" contra "Podem aceitar serviço"; "À
 * espera de nós" a querer dizer documentos aqui e workspaces lá). A lista de
 * quem ficou a meio — a única coisa que só existia aqui — está agora em
 * Técnicos › Aprovações › Inscrições paradas. Este endereço continua a
 * funcionar para quem o tenha guardado.
 */
export default function OnboardingTecnicosPage() {
  redirect("/tecnicos?tab=aprovacoes");
}
