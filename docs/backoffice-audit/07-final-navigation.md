# Navegação final

```
Backoffice Piquet
│
├── Hoje                        ← ecrã inicial
│     Requer atenção · O dia · O mês
│
├── Pedidos
│     filtro: Novos · À procura · Com técnico · Concluídos · Perdidos
│     detalhe: pedido · conversa · técnicos · cronologia
│
├── Técnicos
│     ├── Lista
│     ├── Por aprovar
│     └── Desempenho
│
├── Clientes
│     ├── Lista
│     └── Reclamações
│
├── Dinheiro
│     ├── Resumo
│     ├── Pagamentos
│     ├── A pagar
│     ├── Custos
│     └── Fiscal
│
├── Crescimento
│     ├── Campanhas
│     ├── Origem dos pedidos
│     └── Apps
│
└── Definições                  ← fundo da barra
      ├── Catálogo e preços
      ├── Zonas
      ├── Documentos exigidos
      ├── Integrações
      └── Acessos
```

## Barra do topo

**Pesquisa global** (⌘K) — por nome, telefone, email, NIF, id de serviço ou
referência de pagamento. Tem de procurar no Laravel e nos pedidos, não só em
Supabase. É a ferramenta de quem tem um cliente ao telefone.

**Bolinha de alertas** — o total do que está à espera, ligado a Hoje.

## Bolinhas por área

Só onde há trabalho parado do nosso lado: Pedidos (por responder, técnicos à
espera de decisão), Técnicos (documentos por aprovar), Dinheiro (pagamentos
recusados, faturas vencidas). Nunca em Clientes nem em Crescimento.
