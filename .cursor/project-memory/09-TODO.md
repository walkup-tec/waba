# TODO

Próximas tarefas e melhorias planejadas. Não registrar histórico.

## Próximas tarefas

- [ ] **Redeploy EasyPanel** `waba_disparador` e validar marker `DEPLOY-2026-08-19-device-cloud-lingueta-tab`
- [ ] Pós-redeploy: lingueta visível em Dispositivos; HTML sem `device-cloud-warm-btn`, **Aquecer** e **Início**
- [ ] Manter `dist/` sincronizado em todo push de produção que altere UI/runtime (`npm run build` antes do commit)

## Melhorias futuras

- Checklist automático ou CI que falhe se `index.html` divergir de `dist/index.html` no `master`
- Falhar CI se `src/deploy-marker.ts` / build não atualizar `dist/deploy-marker.js`

## Itens planejados

- Completar memória (arquitetura detalhada, schema) sob demanda
