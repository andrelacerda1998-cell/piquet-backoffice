"use client";

import { useState, useEffect } from "react";
import { RouteGuard, PermissionGate } from "@/components/layout/RouteGuard";
import { getSettings, updateSettings, updateTaxConfig, updateGoal } from "@/services/settingsService";
import { LoadingState } from "@/components/ui/States";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import type { DashboardSettings } from "@/types";

const TABS: TabDef[] = [
  { id: "geral", label: "Geral" },
  { id: "fiscal", label: "Fiscal" },
  { id: "catalogo", label: "Catálogo e zonas" },
  { id: "integracoes", label: "Integrações" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("geral");

  useEffect(() => {
    getSettings().then((s) => { setSettings(s); setLoading(false); });
  }, []);

  const handleSaveTax = async () => {
    if (!settings) return;
    await updateTaxConfig(settings.taxConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveGeneral = async () => {
    if (!settings) return;
    await updateSettings({ activeTechnicianDays: settings.activeTechnicianDays });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) return <LoadingState />;

  return (
    <RouteGuard route="/definicoes">
      <PermissionGate permission="manage_settings">
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-2xl font-bold">Definições</h1>
            <p className="text-text-secondary mt-1">Configuração de taxas, metas e preferências</p>
          </div>

          {saved && (
            <div className="p-3 bg-success-light text-success text-sm rounded-lg">Definições guardadas com sucesso</div>
          )}

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {/* ---------------------------------- GERAL ----------------------------------- */}
          {tab === "geral" && (
            <>
              <section className="card p-6 space-y-4">
                <h2 className="font-semibold">Operações</h2>
                <SettingField label="Dias para técnico ativo" value={settings.activeTechnicianDays} onChange={(v) => setSettings({ ...settings, activeTechnicianDays: v })} />
                <button onClick={handleSaveGeneral} className="btn-primary text-sm">Guardar</button>
              </section>

              <section className="card p-6 space-y-4">
                <h2 className="font-semibold">Metas mensais</h2>
                {settings.goals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{goal.label}</span>
                    <input
                      type="number"
                      value={goal.target}
                      onChange={(e) => {
                        const updated = settings.goals.map((g) => g.id === goal.id ? { ...g, target: Number(e.target.value) } : g);
                        setSettings({ ...settings, goals: updated });
                      }}
                      onBlur={() => updateGoal(goal.id, goal.target)}
                      className="input-field w-32 text-sm"
                    />
                  </div>
                ))}
              </section>
            </>
          )}

          {/* ---------------------------------- FISCAL ---------------------------------- */}
          {tab === "fiscal" && (
            <section className="card p-6 space-y-4">
              <h2 className="font-semibold">Configuração fiscal</h2>
              <p className="text-xs text-text-muted">Taxas configuráveis — não hardcoded nos componentes</p>
              <SettingField label="Taxa IVA (%)" value={settings.taxConfig.vatRate * 100} onChange={(v) => setSettings({ ...settings, taxConfig: { ...settings.taxConfig, vatRate: v / 100 } })} />
              <SettingField label="SS Entidade empregadora (%)" value={settings.taxConfig.employerSocialSecurityRate * 100} onChange={(v) => setSettings({ ...settings, taxConfig: { ...settings.taxConfig, employerSocialSecurityRate: v / 100 } })} />
              <SettingField label="SS Trabalhador (%)" value={settings.taxConfig.employeeSocialSecurityRate * 100} onChange={(v) => setSettings({ ...settings, taxConfig: { ...settings.taxConfig, employeeSocialSecurityRate: v / 100 } })} />
              <SettingField label="Retenção IRS (%)" value={settings.taxConfig.withholdingIrsRate * 100} onChange={(v) => setSettings({ ...settings, taxConfig: { ...settings.taxConfig, withholdingIrsRate: v / 100 } })} />
              <SettingField label="Retenção IRC (%)" value={settings.taxConfig.withholdingIrcRate * 100} onChange={(v) => setSettings({ ...settings, taxConfig: { ...settings.taxConfig, withholdingIrcRate: v / 100 } })} />
              <button onClick={handleSaveTax} className="btn-primary text-sm">Guardar configuração fiscal</button>
            </section>
          )}

          {/* -------------------------------- CATÁLOGO ---------------------------------- */}
          {tab === "catalogo" && (
            <section className="card p-6 space-y-4">
              <h2 className="font-semibold">Categorias ({settings.categories.length})</h2>
              <div className="flex flex-wrap gap-2">
                {settings.categories.map((c) => (
                  <span key={c.id} className="px-2 py-1 bg-surface-muted rounded text-sm">{c.name}</span>
                ))}
              </div>
              <h2 className="font-semibold mt-4">Localizações ({settings.locations.length})</h2>
              <div className="flex flex-wrap gap-2">
                {settings.locations.map((l) => (
                  <span key={l.id} className="px-2 py-1 bg-surface-muted rounded text-sm">{l.name}</span>
                ))}
              </div>
            </section>
          )}

          {/* ------------------------------- INTEGRAÇÕES -------------------------------- */}
          {tab === "integracoes" && (
            <section className="card p-6">
              <h2 className="font-semibold mb-2">Integrações futuras</h2>
              <p className="text-sm text-text-secondary">Preparado para: software de contabilidade, faturação, Segurança Social Direta, Portal das Finanças, Meta Ads, Google Ads, analytics.</p>
              <p className="text-xs text-text-muted mt-2">Importação CSV/Excel disponível via exportação. Adapters a implementar quando APIs estiverem disponíveis.</p>
            </section>
          )}
        </div>
      </PermissionGate>
    </RouteGuard>
  );
}

function SettingField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-text-secondary">{label}</label>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} className="input-field w-32 text-sm" />
    </div>
  );
}
