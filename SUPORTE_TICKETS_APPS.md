# Tickets de suporte a partir das apps

O backoffice recebe tickets das **duas** apps na aba **Suporte → Tickets**.
Endpoint público (sem autenticação, tal como o formulário de leads):

```
POST https://backoffice.piquetapp.com/api/tickets
Content-Type: application/json
```

## Corpo do pedido

```json
{
  "channel": "app_cliente",        // ou "app_tecnico" — é isto que separa as origens
  "name": "Maria Silva",
  "email": "maria@exemplo.pt",
  "phone": "+351912345678",
  "subject": "Técnico não apareceu",
  "message": "Estava marcado para as 14h e ninguém veio.",
  "serviceId": "SRV-123",          // opcional, liga o ticket ao serviço
  "category": "servico"            // opcional
}
```

`channel` é o único campo que decide a origem:

| valor enviado | aparece no backoffice como | `requester_type` |
|---|---|---|
| `app_tecnico` | App · Técnico | `tecnico` |
| qualquer outro (ou ausente) | App · Cliente | `cliente` |

## Resposta

```json
{ "ok": true, "id": "TK-1102", "accessToken": "uuid-…" }
```

O `accessToken` é devolvido **uma só vez**. A app deve guardá-lo: é com ele que
lê as respostas do suporte e continua a conversa, sem precisar de login.

```
GET  /api/tickets?token=<accessToken>     → estado + mensagens
POST /api/tickets/<id>/messages           → resposta do utilizador
```

## Notas

- Campos são truncados no servidor; `name`/`email`/`phone` — pelo menos um é
  obrigatório.
- Há proteção anti-bot (campo `website` invisível: se vier preenchido, o
  pedido é aceite mas ignorado).
- Não há limitação de taxa por IP — se as apps entrarem em produção com
  volume, convém acrescentar.
