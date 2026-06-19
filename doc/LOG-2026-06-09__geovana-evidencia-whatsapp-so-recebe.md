# LOG — Geovana só recebe (evidência WhatsApp vs logs)

**Data:** 2026-06-09  
**Evidência:** prints do chat Walkup → `+55 62 98257-8262` (Geovana) e mesmo padrão com Marcelo.

## Conclusão revisada

**No WhatsApp, a Geovana só recebe — não envia de volta.** A análise anterior (só `logs_envios`) estava **incompleta**: o backend registra 41 envios como sucesso, mas **essas mensagens não aparecem** nos chats com Walkup nem Marcelo.

## Cruzamento print × logs (09/06)

| Print (Walkup → Geovana) | Log servidor Walkup → Geovana | Log servidor Geovana → Walkup (não visto no print) |
|--------------------------|-------------------------------|-----------------------------------------------------|
| 08:43 | 08:43:27 ✓ | 08:56:29 (logado, ausente no WhatsApp) |
| 09:16 | 09:16:27 ✓ | 09:26:27 |
| 10:03 | 10:03:28 ✓ | 10:15:29 |
| 10:39 | 10:39:29 ✓ | 10:51:31 |
| 11:28 | 11:28:28 ✓ | — |
| 12:20 | 12:20:29 ✓ | 12:33:29 |
| 13:01 | 13:01:27 ✓ | 13:15:29 |

Textos do print (frases acadêmicas + código tipo `fwvayk`) = mensagens da **fila aquecedor** enviadas **pela instância de origem** (Walkup) **para** Geovana.

## Matriz completa (logs — não reflete WhatsApp na Geovana)

| Par | Envios logados |
|-----|---------------:|
| Walkup → Geovana | 22 |
| Geovana → Walkup | 21 |
| Marcelo → Geovana | 22 |
| Geovana → Marcelo | 20 |
| Walkup ↔ Marcelo | 24 / 23 (bidirecional OK no par) |

Walkup e Marcelo trocam entre si; **Geovana só aparece como destinatária no aparelho**.

## Causa provável

1. **Evolution `sendText` da instância `Geovana novo` retorna HTTP 2xx** → código grava `logs_envios`.
2. **WhatsApp não entrega** (ou não exibe) a mensagem no chat do destinatário.
3. Código só valida `response.ok` — **não exige `message.id` / confirmação real** no JSON da EVO.

Hipóteses operacionais: restrição de envio em conta nova/recém-integrada; sessão EVO degradada só no outbound; limite Meta/WhatsApp no DDD 62.

## Próximos passos sugeridos

1. No **celular da Geovana**: abrir chats com Walkup e Marcelo — confirmar se há **saídas** (deveria estar vazio).
2. **Evolution API**: inspecionar resposta bruta de `POST .../message/sendText/Geovana%20novo` (body JSON, não só status).
3. **Teste manual** controlado: um único `sendText` Geovana → Walkup com aquecedor parado.
4. Se falhar: **reconectar** instância Geovana (QR) ou recriar na EVO.
5. **Fix código** (futuro): só gravar `logs_envios` se resposta EVO trouxer ID de mensagem válido.
