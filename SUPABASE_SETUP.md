# Ligar o Piquet Dashboard a dados reais (Supabase)

Fundação da migração para produção: **Supabase** (Postgres + Auth) + **Next.js Route Handlers**
para servir os 81 endpoints (reaproveitando a lógica de agregação existente).

O frontend já está pronto: cada serviço chama um endpoint REST com um *fetcher* mock.
Quando `NEXT_PUBLIC_API_URL` estiver definido, esses fetchers deixam de correr e os pedidos
vão às Route Handlers reais — **módulo a módulo**.

## O que precisas de fazer (uma vez)

1. **Criar o projeto Supabase** em https://supabase.com (plano free chega para começar).
2. **Correr as migrações** — no painel do Supabase → *SQL Editor* → executa por ordem:
   [`0001_init.sql`](supabase/migrations/0001_init.sql) (`staff, categories, customers, technicians, services` + vistas `*_enriched` + RLS)
   [`0002_employees_tax_campaigns.sql`](supabase/migrations/0002_employees_tax_campaigns.sql) (`employees, tax_obligations, campaigns` + RLS)
   e [`0003_team.sql`](supabase/migrations/0003_team.sql) (`team_messages, team_meetings` + RLS).
3. **Copiar as chaves** — *Project Settings → API* — para `.env.local` (ver `.env.example`):
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...        # secreta — só servidor, nunca no browser
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...    # pública
   ```
4. **Semear os dados** (migra os dados mock atuais para a BD, idempotente):
   ```
   npm run seed
   ```
5. **Criar o teu utilizador de staff** — no painel → *Authentication → Users → Add user*
   (email + password). Depois, no *SQL Editor*, liga-o à tabela `staff`:
   ```sql
   insert into public.staff (id, name, email, role)
   select id, 'André Lacerda', email, 'ceo' from auth.users where email = 'tu@piquet.pt';
   ```

## Ativar (Fase 1 — Serviços/Reservas — já implementada)

O código já está pronto. Para ligar o módulo de Serviços a dados reais, junta ao `.env.local`:

```
NEXT_PUBLIC_API_URL=/api
```

O que isto faz (ver `src/services/api.ts` → `isLiveEndpoint`): **só** os endpoints já migrados
(`/services`, `/services/:id`, `/dashboard/recent-services`) vão ao backend real; **todos os
outros continuam mock**. Assim liga-se um módulo de cada vez sem partir o resto.

- **Auth**: com as chaves Supabase presentes, a página de login passa a pedir email+password
  (Supabase Auth); o token é enviado como Bearer e validado nas Route Handlers contra a tabela
  `staff` (`src/app/api/_lib/handler.ts` → `withStaff`).
- **Route Handlers**: `src/app/api/services/*` e `src/app/api/dashboard/recent-services`.

## Fases seguintes (eu continuo)

Clientes & Técnicos → Financeiro/Faturação → Marketing. Para cada módulo: Route Handlers novas +
acrescentar os endpoints ao allowlist `isLiveEndpoint`. Migração tabela a tabela, sem downtime.

## Segurança

- A `service_role` key **só** é usada no servidor (`src/lib/supabase/server.ts`, marcado `server-only`).
- O browser usa apenas a `anon` key; o acesso é limitado por **RLS** (leitura só para autenticados).
- As escritas passam pelas Route Handlers (service role), nunca diretamente do browser.
