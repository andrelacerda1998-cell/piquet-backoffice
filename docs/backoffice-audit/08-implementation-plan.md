# Plano de implementação

Cinco fases. Cada uma deixa o backoffice utilizável no fim — nada de meses de
obra com o produto partido pelo meio. Nenhuma foi executada: isto é a proposta.

## Fase 0 — verdade nos números (meio dia)

Antes de mexer em estrutura, corrigir o que faz duvidar do que se lê.

1. Rever `REAL_DATA` em `src/services/api.ts`: os 13 endpoints reais marcados
   como demonstração.
2. Remover o separador **Push** do Marketing (métricas com `Math.random()`).
3. Marcar claramente o que fica mock: Qualidade e Pedidos personalizados.
4. Apagar as tabelas `_seed_backup_*`.

**Risco:** nenhum. Só apaga e corrige rótulos.

## Fase 1 — Hoje (2 a 3 dias)

5. Novo ecrã inicial: **Requer atenção** (regras dos Alertas, já existem) + O
   dia + O mês.
6. Remover o ecrã Alertas; manter o adiar.
7. Retirar da Visão Geral os oito números que passam para Dinheiro e
   Crescimento.

**Risco:** baixo. As regras e os endpoints já existem.

## Fase 2 — o ciclo completo do serviço (1 semana)

A fase que muda o negócio, e a única que mexe em dados.

8. Campos no pedido: data e hora combinadas, preço acordado, valor do técnico.
9. Dois estados novos: **Agendado**, **Em execução** — a seguir a "Com
   técnico". Migração dos existentes como a de 08/09 (traduzir na leitura,
   converter as linhas, manter o legado).
10. Cronologia no detalhe do pedido.
11. Métricas de despacho em Hoje.

**Risco:** médio — mexe em estados. Mitigação: `leadStages.ts` continua a ser
fonte única e o mapa de legados garante que nada se perde.

## Fase 3 — arrumar o menu (3 a 4 dias)

12. Financeiro → **Dinheiro**, cinco separadores, absorve `/impostos-rh`.
13. Marketing + Produto → **Crescimento**.
14. Qualidade → Técnicos → Desempenho. Operações → filtro em Pedidos.
15. Remover Equipa, Desenvolvimento, Tarefas, Recrutamento, Objetivos,
    Relatórios.
16. Menu de 14 para 6 entradas.

**Risco:** baixo tecnicamente, alto em hábito — é o teu backoffice a mudar de
sítio de um dia para o outro. Fazer numa sexta-feira.

## Fase 4 — suporte a sério (3 a 4 dias)

17. Pesquisa global sobre Laravel + pedidos, por telefone, nome, NIF e
    referência de pagamento.
18. Pagamentos ligados ao cliente e ao serviço.
19. Fila de aprovação de técnicos num ecrã.
20. Cancelamentos e reclamações num sítio.

**Risco:** baixo. Depende de endpoints do Laravel que já existem.

## Fora deste plano, mas a decidir

- **Zonas geográficas dos técnicos** — exige o `VendorController` expor
  `allowedZones`. Sem isso não há proximidade no despacho, e é a maior lacuna
  que o backoffice sozinho não resolve.
- **Reservas da app (Express)** — decidir se o backend em `~/dev/piquet/backend`
  continua a existir ou se as reservas passam pelo Laravel.
- **Suporte** — três meses a zero tickets decidem se fica ou sai.

## Ordem sugerida

Fase 0 esta semana. Fase 1 a seguir. **Fase 2 é a que vale mais** e devia
começar antes da 3: arrumar o menu de um backoffice que não sabe o que se está
a passar é arrumar a casa errada.
