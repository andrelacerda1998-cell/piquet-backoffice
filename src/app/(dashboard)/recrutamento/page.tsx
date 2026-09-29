"use client";

import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { useAsyncData } from "@/hooks/useDashboard";
import { getOnboardingTecnicos } from "@/services/vendorsService";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/States";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { UserPlus, ArrowRight, Phone } from "lucide-react";
import {
  ETAPAS, ETAPA_LABEL, ETAPA_ACAO, ESPERA_POR_NOS, type Etapa,
} from "@/lib/onboardingTecnicos";

/**
 * Onboarding de técnicos — o que era o ecrã de "Recrutamento".
 *
 * Aqui estavam candidatos, vagas, entrevistas marcadas e tarefas de
 * recrutamento, tudo inventado: não há (nem havia) sistema de recrutamento
 * nenhum no Laravel, e o ecrã nem sequer estava no menu — só se lá chegava
 * escrevendo o endereço à mão.
 *
 * O recrutamento a sério da Piquet são as centenas de pessoas que já criaram
 * conta na app para trabalhar e ficaram a meio do caminho. Enquanto não
 * terminarem, não recebem trabalho — e ninguém lhes disse porquê. Foi a única
 * pergunta que os técnicos alguma vez fizeram ao suporte:
 *
 *   Vanessa Oliveira, 10/09: "Pode verificar se meu perfil no app está ativo?"
 *   Danúbia Trintrim, 18/09: "Ainda não recebi confirmação de validação."
 *
 * A regra do que falta vem do Laravel (`account_blocker`), a mesma que a app
 * do técnico lê no `GET /me`. Aqui só se agrupa, se conta e se ordena por
 * quem está à espera há mais tempo.
 */
export default function OnboardingTecnicosPage() {
  const { data: funil, loading, error } = useAsyncData(() => getOnboardingTecnicos(), []);

  const maiorEtapa = funil
    ? Math.max(1, ...ETAPAS.map((e) => funil.porEtapa[e]))
    : 1;

  return (
    <RouteGuard route="/recrutamento">
      <div className="space-y-6">
        <PageHeader
          icon={UserPlus}
          eyebrow="Técnicos"
          title="Onboarding de técnicos"
          subtitle="Quem se inscreveu para trabalhar e ainda não pode"
        />

        {error && (
          <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-4 py-3">
            <p className="text-sm font-semibold text-danger">Não foi possível ler o funil</p>
            <p className="text-xs text-text-secondary mt-0.5">{error}</p>
          </div>
        )}

        {loading && !funil && <LoadingState />}

        {funil && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="card p-4">
                <p className="text-xs text-text-secondary">Inscritos</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{funil.total}</p>
                <p className="text-[11px] text-text-muted">sem contar suspensos</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-secondary">Prontos a trabalhar</p>
                <p className="text-2xl font-bold text-success tabular-nums">{funil.prontos}</p>
                <p className="text-[11px] text-text-muted">
                  {funil.total > 0 ? `${Math.round((funil.prontos / funil.total) * 100)}% dos inscritos` : "—"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-secondary">A meio</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{funil.total - funil.prontos}</p>
                <p className="text-[11px] text-text-muted">falta-lhes alguma coisa</p>
              </div>
              <div className={cn("card p-4", funil.aEsperaDeNos > 0 && "border-l-[3px] border-l-warning")}>
                <p className="text-xs text-text-secondary">À espera de nós</p>
                <p className={cn("text-2xl font-bold tabular-nums", funil.aEsperaDeNos > 0 ? "text-warning" : "text-text-primary")}>
                  {funil.aEsperaDeNos}
                </p>
                <p className="text-[11px] text-text-muted">documentos por rever</p>
              </div>
            </div>

            {/* ---------- Onde é que estão parados ---------- */}
            <div className="card p-4 space-y-4">
              <div>
                <SectionHeader title="Onde é que estão parados" />
                <p className="text-xs text-text-secondary -mt-1">
                  A ordem é a mesma que a app aplica: não vale a pena pedir o IBAN a quem ainda nem confirmou o
                  telemóvel — preencheria o campo e continuaria bloqueado.
                </p>
              </div>

              <div className="space-y-3">
                {ETAPAS.map((etapa) => {
                  const n = funil.porEtapa[etapa];
                  const nosso = ESPERA_POR_NOS[etapa];
                  return (
                    <div key={etapa}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-text-primary">
                          {ETAPA_LABEL[etapa]}
                          {nosso && n > 0 && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-warning-light px-1.5 py-0.5 text-[11px] font-semibold text-warning align-middle">
                              depende de nós
                            </span>
                          )}
                        </p>
                        <span className="text-sm tabular-nums text-text-secondary">
                          {n} {n === 1 ? "técnico" : "técnicos"}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", nosso ? "bg-warning" : "bg-piquet")}
                          style={{ width: `${(n / maiorEtapa) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-text-muted">{ETAPA_ACAO[etapa]}</p>
                    </div>
                  );
                })}
              </div>

              {funil.porEtapa.documents_pending > 0 && (
                <Link
                  href="/tecnicos?tab=aprovacoes"
                  className="inline-flex items-center gap-2 text-sm font-medium text-piquet-700 hover:underline"
                >
                  Rever os {funil.porEtapa.documents_pending} documentos pendentes
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {/* ---------- Quem espera há mais tempo ---------- */}
            <div className="space-y-3">
              <div>
                <SectionHeader title="À espera há mais tempo" />
                <p className="text-xs text-text-secondary -mt-1">
                  Os mais antigos por resolver. Quem não tem data de inscrição fica no fim, em vez de aparecer
                  como se fosse de hoje.
                </p>
              </div>

              {funil.parados.length === 0 ? (
                <p className="card p-6 text-center text-sm text-text-muted">
                  Ninguém a meio — todos os inscritos estão prontos a trabalhar.
                </p>
              ) : (
                <div className="space-y-2">
                  {funil.parados.map((t) => (
                    <div key={t.id} className="card p-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">{t.nome}</p>
                        <p className="text-xs text-text-secondary">
                          {t.categorias.length > 0 ? t.categorias.join(" · ") : "sem categoria"}
                          {t.criadoEm && ` · inscrito a ${formatDate(t.criadoEm)}`}
                        </p>
                      </div>
                      {t.telefone && (
                        <a
                          href={`tel:${t.telefone}`}
                          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-piquet-700"
                          title="Ligar"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {t.telefone}
                        </a>
                      )}
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        t.etapa && ESPERA_POR_NOS[t.etapa] ? "bg-warning-light text-warning" : "bg-surface-subtle text-text-secondary",
                      )}>
                        {t.etapa ? ETAPA_LABEL[t.etapa as Etapa] : "—"}
                      </span>
                      <span className="text-xs tabular-nums text-text-muted w-24 text-right">
                        {t.diasParado == null
                          ? "sem data"
                          : t.diasParado === 0
                            ? "hoje"
                            : `há ${t.diasParado} dias`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
