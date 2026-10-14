"use client";

import { useState } from "react";
import { useAuthStore, DEMO_USERS } from "@/stores";
import { ROLE_LABELS } from "@/lib/permissions";
import { USE_REAL_API } from "@/services/api";
import { SUPABASE_AUTH_ENABLED } from "@/lib/supabase/client";
import { login as apiLogin } from "@/services/authService";
import { cn } from "@/lib/utils";
import type { User, UserRole } from "@/types";
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-muted">
      {/* Painel esquerdo — autenticação */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-12">
            <span className="text-xl font-semibold tracking-tight text-text-primary">Piquet</span>
            <span className="rounded-md bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-text-muted">Gestão</span>
          </div>

          <h1 className="text-[28px] leading-9 font-semibold tracking-tight text-text-primary">Área de administração</h1>
          {USE_REAL_API || SUPABASE_AUTH_ENABLED ? <RealLoginForm /> : <DemoProfileSelector />}
        </div>
      </div>

      {/* Painel direito — marca (escuro) */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#111010] p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-piquet/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-piquet/10 blur-3xl" />

        {/* A marca já está à esquerda, por cima do formulário: aqui ficava repetida. */}
        <div />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-piquet" />
            Plataforma de serviços ao domicílio
          </span>
          <h2 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight">
            Deixa para<br />quem sabe.
          </h2>
          <p className="mt-5 max-w-md text-white/70 leading-relaxed">
            Gere serviços, técnicos, pagamentos e marketing — tudo num só sítio, com a
            rapidez e a confiança da Piquet.
          </p>

          {/* Sem estatísticas inventadas no ecrã público: os únicos números
              verificáveis hoje são os downloads das lojas. */}
          <div className="mt-10 grid grid-cols-1 gap-6 max-w-md">
            <Stat value="6.400+" label="downloads nas lojas (App Store + Google Play)" />
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-white/60">
          <ShieldCheck className="h-4 w-4 text-piquet" />
          Profissionais certificados e verificados · Pagamento seguro
        </div>
      </div>
    </div>
  );
}

/* -------------------- Modo produção: email + palavra-passe -------------------- */

function RealLoginForm() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await apiLogin(email.trim(), password);
      setUser(user);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar sessão.");
      setLoading(false);
    }
  };

  return (
    <>
      <p className="text-text-muted mt-2">Inicia sessão para gerir a operação da Piquet.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="text-[13px] font-medium text-text-primary mb-1.5 block">E-mail</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@piquet.pt"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-[13px] font-medium text-text-primary mb-1.5 block">Palavra-passe</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Introduz a tua palavra-passe"
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/*
          Aqui havia "Manter sessão iniciada" (uma caixa que nada lia) e
          "Recuperar palavra-passe" (um link para "#"). Dois controlos que não
          faziam nada; fica o que é verdade: os acessos tratam-se no Supabase.
        */}
        {error && (
          <p className="aviso aviso-perigo py-2">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "A entrar..." : "Iniciar sessão"}
        </button>
      </form>

      <p className="text-xs text-text-muted mt-8">
        Acesso reservado à equipa Piquet. Esqueceste-te da palavra-passe? Fala com o CTO — os acessos tratam-se no Supabase.
      </p>
    </>
  );
}

/* -------------------- Modo demonstração: seleção de perfil -------------------- */

// Palavra-passe partilhada do ambiente demo (soft gate — em produção usa-se o RealLoginForm).
const DEMO_PASSWORD = "piquet2026";

function DemoProfileSelector() {
  const login = useAuthStore((s) => s.login);
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!selected) { setError("Escolhe um perfil."); return; }
    if (password !== DEMO_PASSWORD) { setError("Palavra-passe incorreta."); return; }
    login(selected);
    window.location.href = "/";
  };

  return (
    <>
      <p className="text-text-muted mt-2">Escolhe um perfil e introduz a palavra-passe para entrar.</p>
      <span className="inline-flex items-center gap-1.5 mt-4 px-2 py-0.5 rounded-md bg-warning-light text-warning text-xs font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        Ambiente de demonstração
      </span>

      <div className="mt-6 space-y-2">
        {(Object.entries(DEMO_USERS) as [UserRole, User][]).map(([role, demoUser]) => (
          <button
            key={role}
            onClick={() => { setSelected(role); setError(null); }}
            aria-pressed={selected === role}
            className={cn(
              "group w-full flex items-center justify-between px-3 py-2.5 rounded-xl border bg-surface transition-colors text-left",
              selected === role ? "border-piquet ring-1 ring-piquet" : "border-surface-border hover:border-surface-strong"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-piquet/20 text-text-primary text-[13px] font-semibold">
                {demoUser.name.charAt(0)}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">{demoUser.name}</p>
                <p className="text-xs text-text-muted">{ROLE_LABELS[role]}</p>
              </div>
            </div>
            <span className={cn("h-4 w-4 shrink-0 rounded-full border transition-colors",
              selected === role ? "border-[5px] border-piquet" : "border-surface-strong group-hover:border-text-muted")} aria-hidden />
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-4 space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          placeholder="Palavra-passe"
          autoComplete="current-password"
          className="input-field"
          aria-label="Palavra-passe"
        />
        {error && <p className="aviso aviso-perigo py-2">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5">Iniciar sessão</button>
      </form>

      <p className="text-xs text-text-muted mt-6">
        Demonstração — palavra-passe: <span className="font-mono text-text-secondary">{DEMO_PASSWORD}</span>. Autenticação simulada, sem ligação a servidores.
      </p>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-white/60 leading-snug">{label}</p>
    </div>
  );
}
