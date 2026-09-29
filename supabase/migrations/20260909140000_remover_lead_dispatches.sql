/*
  A difusão de pedidos por WhatsApp saiu (09/09/2026).

  Foi construída quando o backoffice não via os pedidos da app: perguntava-se
  aos técnicos por WhatsApp porque não havia outro caminho. Entretanto ligou-se
  a ponte com o Laravel, que já tem matching próprio (ServiceCandidate:
  notified, accepted, declined, expired, selected) -- e perguntar também por
  WhatsApp era perguntar duas vezes às mesmas pessoas, por dois canais, sem
  saber qual conta.

  A tabela nunca chegou a ter uma linha: o modelo `pedido_tecnico_piquet` que a
  Meta tinha de aprovar nunca foi submetido, portanto nenhuma difusão saiu.
*/
drop table if exists lead_dispatches;
