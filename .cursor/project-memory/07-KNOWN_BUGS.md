# Bugs Conhecidos

Registrar apenas bugs abertos. Remover quando resolvidos.

## Bugs

_Nenhum bug permanente aberto nesta memória._

### Notas (não são bugs abertos)

- Falso negativo aquecedor “só na origem” com mensagem recebida no WhatsApp: tratado em `2556946` (ACK `DELIVERY_ACK` + janela/`@lid`). Risco residual se a Evolution não emitir ACK nem indexar a tag.
- Instâncias com muitos chats `@lid` (ex.: 2477) continuam mais propensas a atraso/`findMessages` incompleto — a confirmação não deve depender só de JID telefone.
