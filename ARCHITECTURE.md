# Piquet Dashboard — Arquitetura

Dashboard interno de gestão para a Piquet, plataforma de serviços ao domicílio.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** — design system com cor principal `#FABB5B`
- **Recharts** — gráficos
- **Zustand** — estado global (filtros, auth, settings)
- **Vitest** — testes unitários
- **date-fns** — manipulação de datas

## Estrutura

```
src/
├── app/                    # Rotas (App Router)
│   ├── (dashboard)/        # Páginas protegidas com layout
│   └── login/              # Autenticação demo
├── components/
│   ├── charts/             # Componentes de gráficos
│   ├── layout/             # Sidebar, Topbar, RouteGuard
│   └── ui/                 # MetricCard, DataTable, States, etc.
├── config/                 # Configuração (taxas, nav, categorias)
├── hooks/                  # useAsyncData, useFilters, usePagination
├── lib/                    # Cálculos, formatação, permissões, filtros
├── mocks/                  # Dados de demonstração (752 clientes, 382 técnicos)
├── services/               # Camada de dados (preparada para APIs reais)
├── stores/                 # Zustand stores
└── types/                  # Interfaces TypeScript
```

## Camada de serviços

Todos os serviços em `src/services/` seguem o padrão:

```typescript
// Atual (mock)
export async function getOverviewMetrics(filters) {
  return apiGet("/dashboard/overview", () => mockCalculation(filters)).then(r => r.data);
}

// Futuro (API real)
// Substituir apiGet por fetch real — interface permanece igual
```

Serviços: `dashboardService`, `financeService`, `employeesService`, `customersService`, `techniciansService`, `marketingService`, `supportService`, `settingsService`.

## Fórmulas financeiras

- `receitaPiquet = valorTotalPagoCliente - valorDevidoTecnico`
- `receitaPiquetSemIVA = receitaPiquet / (1 + taxaIVA)`
- Taxas configuráveis em `config/dashboard.ts` e página Definições

## Permissões

7 perfis: Administrador, CEO, Operações, Financeiro, RH, Marketing, Suporte.
Controlo em rotas (`RouteGuard`), ações (`PermissionGate`) e dados sensíveis (salários, custos).

## Integrações pendentes

| Sistema | Estado |
|---------|--------|
| API backend Piquet | Camada dual pronta — mock por defeito, HTTP real via `NEXT_PUBLIC_API_URL` |
| Software contabilidade | Placeholder |
| Faturação | Placeholder |
| Segurança Social Direta | Placeholder |
| Portal das Finanças | Placeholder |
| Meta Ads / Google Ads | Mock de campanhas |
| Importação CSV/Excel | Exportação implementada |

## Camada de dados — modo dual (mock ↔ API real)

`src/services/api.ts` funciona em dois modos, decididos por `NEXT_PUBLIC_API_URL`:

- **Vazio → modo demonstração:** cada função usa o `fetcher` (dados mock locais).
- **Definido → modo produção:** faz `fetch` real a `${NEXT_PUBLIC_API_URL}${endpoint}`
  com `Authorization: Bearer <token>` (token em `localStorage`, chave `piquet-auth-token`).

As funções de serviço **não mudam** — passam `endpoint`, `fetcher` e, opcionalmente,
`params` de query (ver `getServices` como referência de paginação/filtros server-side).

### Para ligar a um backend real

1. Copiar `.env.example` → `.env.local` e definir `NEXT_PUBLIC_API_URL`.
2. Implementar os endpoints REST no backend (mesmos caminhos usados nos serviços,
   ex.: `/dashboard/overview`, `/services`, `/finance/summary`, …), devolvendo
   `{ data, success, meta }` ou o payload cru.
3. Implementar `/auth/login`, `/auth/logout`, `/auth/me` — a página de login deve
   chamar `authService.login(email, password)` quando `USE_REAL_API` é `true`.
4. Implementar paginação/filtros server-side (os `params` já são enviados).
5. Interfaces de retorno mantêm-se — os componentes não precisam de alteração.

Autenticação: `getAuthToken` / `setAuthToken` / `clearAuthToken` em `services/api.ts`;
respostas `401` limpam o token automaticamente.

## Executar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Build produção
npm test         # Testes unitários
```

## Nota fiscal

Todos os valores fiscais são **estimativas de gestão**. Devem ser confirmados pelo contabilista antes de qualquer decisão fiscal.
