# Análise ecrã a ecrã

## Visão Geral → **Hoje**

**Hoje:** 12 KPIs de leitura, nenhuma acção. GMV e comissão em mês e ano,
serviços executados e agendados em mês e ano, downloads, avaliação, CAC, LTV,
LTV/CAC.

**Problemas:** oito números para duas perguntas; unit economics (CAC, LTV) são
métricas de reunião mensal, não de manhã; não diz o que precisa de atenção.

**Manter:** GMV e comissão do mês; serviços concluídos.
**Remover do ecrã:** GMV/comissão do ano, executados/agendados do ano, CAC,
LTV, LTV/CAC, downloads, avaliação nas lojas → passam para Dinheiro e
Crescimento.
**Adicionar:** bloco **Requer atenção** no topo; pedidos de hoje; serviços a
decorrer; taxa de preenchimento; tempo até um técnico aceitar.

**Prioridade: P0.**

## Alertas → topo de Hoje

**Hoje:** ecrã próprio com as mesmas regras que alimentam as bolinhas.
**Problema:** um ecrã de alertas é um sítio onde se vai; um bloco no ecrã
inicial é uma coisa que se vê.
**Recomendação:** fundir em Hoje, manter o adiar.
**P0.**

## Pedidos

**Hoje:** funciona e é o ecrã mais completo. Estados novos, difusão a técnicos,
conversa de WhatsApp, atribuição, motivos de perda, detecção de duplicados.

**Problemas:** o ciclo acaba em "Com técnico"; não há data, preço nem execução.
Marcar como Concluído exige valor cobrado e valor do técnico, o que faz do
estado final um acto de contabilidade.

**Manter:** tudo o que existe.
**Adicionar:** agendamento e preço acordado no detalhe; cronologia visual;
"Pedidos personalizados" como filtro.
**P0** (a continuidade), **P1** (cronologia).

## Operações → absorvido por Pedidos

**Hoje:** serviços do Laravel, reservas do Express, incidentes, SLA, pedidos
personalizados. Cinco separadores.

**Problema:** é a segunda lista de pedidos de serviço, com outro vocabulário e
outra fonte. Ninguém sabe qual abrir.

**Recomendação:** um serviço é um pedido depois de ter técnico. A lista de
Pedidos com filtro "Com técnico" e "Concluído" faz este trabalho. Incidentes e
SLA passam para Técnicos → Desempenho. Reservas da app: decidir se o backend
Express continua a existir.
**P1** (depende da continuidade do ciclo estar feita).

## Qualidade → Técnicos → Desempenho

14 KPIs, parcialmente mock, sobre técnicos. Não é um domínio, é uma vista.
**P1.**

## Clientes

**Manter:** lista, detalhe, bloquear/reativar, métodos de pagamento.
**Simplificar:** quatro filtros de estado para dois; três separadores de
gráficos (origem, localização) para um bloco no detalhe da lista.
**Adicionar:** no detalhe — histórico de serviços, pagamentos e reclamações
numa só vista. Hoje um cliente não mostra o que já lhe foi feito.
**P1.**

## Técnicos

**Manter:** lista, perfil completo, suspender/reativar, KYC, workspace de
faturação.
**Problema:** 13 KPIs à frente da lista; quatro filtros de AT misturados com
filtros de negócio; aprovar um técnico obriga a saltar entre separadores.
**Adicionar:** ecrã **Por aprovar** — dados e documentos lado a lado, aprovar,
pedir correções ou recusar sem sair.
**Adicionar:** zonas geográficas no perfil (hoje a API não as expõe; sem elas
não há proximidade no despacho).
**P0** (a fila de aprovação), **P1** (o resto).

## Financeiro → **Dinheiro**

**Manter:** GMV, comissão, pagamentos da app com reembolso e cativo, faturas
de custos, pagamentos a técnicos.
**Problema:** 23 KPIs num ecrã; sete separadores; "Lucro do sistema" não se
percebe pelo nome; o selo de demonstração aparece sobre números reais.
**Simplificar:** cinco separadores — Resumo, Pagamentos, A pagar, Custos,
Fiscal. Absorve `/impostos-rh`.
**Corrigir:** a lista `REAL_DATA` — 13 endpoints reais estão marcados como
demonstração.
**P0** (o selo), **P1** (a arrumação).

## Marketing → **Crescimento**

**Manter:** ROAS real por canal e campanha, criação de campanhas, atribuição.
**Remover:** Push (métricas inventadas), códigos de desconto, guiões.
**P1** — a parte de ROAS é recente e funciona.

## Produto

**Manter:** Integrações (estado dos crons, WhatsApp, modelos) → passa para
Definições. Funil e downloads → Crescimento.
**Remover:** Bugs e Logs.
**P2.**

## Suporte

Zero tickets. **Recomendação:** caixa de entrada dentro de Hoje; se em três
meses continuar vazia, remover.
**P2.**

## Equipa · Desenvolvimento · Tarefas · Recrutamento · Objetivos · Relatórios

Ferramentas de gestão de empresa num backoffice de operação. Nenhuma tem uso
diário: 0 reuniões, 15 mensagens, 14 tarefas pessoais, 55 tarefas de
desenvolvimento que são o registo deste trabalho.

**Recomendação:** remover as seis. Se alguma fizer falta, existe fora daqui.
**P1** — não urgente, mas é metade da desarrumação do menu.

## Configurações → **Definições**

**Manter:** catálogo, preços, zonas, documentos exigidos, taxas.
**Mover para cá:** integrações e chaves.
**Simplificar:** Atividade, Notificações enviadas e Códigos SMS são registos
técnicos — juntar num separador "Registos".
**P2.**
