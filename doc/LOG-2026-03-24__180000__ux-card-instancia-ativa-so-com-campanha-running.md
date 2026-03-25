# UX: Instância ativa só com campanha em execução

## Pedido

O card **Instância ativa** não deve mostrar nome de instância quando **nenhuma campanha** está com disparo em andamento (`running`); só reflete instâncias em uso no envio **naquele momento**.

## Implementação

- Flag `disparosHasRunningCampaign` atualizada em `loadDisparosTemplates` (`runningCount > 0`).
- `applyDisparosActiveInstanceCardDisplay` / `refreshDisparosActiveInstanceFromServer` / `refreshDisparosActiveInstanceCardLabelOnly`: sem campanha `running`, valor `—`, subtítulo vazio, sem chamar `next-instance`.
- `#disparos-instancia-ativa-sub`: texto "Instância da vez" só quando há campanha ativa; caso contrário vazio.
- Falhas no GET de campanhas ou `catch` do loader limpam o card.

## Arquivos

- `index.html` → `dist/index.html`
