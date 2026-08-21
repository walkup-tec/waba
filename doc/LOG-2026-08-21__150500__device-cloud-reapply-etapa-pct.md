# Device Cloud — reaplicar gates etapa-a-etapa + coords %

## Contexto

Após merge `master`→`v02`, o Device Cloud voltou, mas os gates etapa-a-etapa e coords `%` da sessão de pairing tinham sido perdidos.

## Solução

- `DEVICE_CLOUD_PAIRING_NAV_MAX_STEP = 2` (só WA + menu ⋮; sem EVO)
- `DEVICE_CLOUD_PAIRING_PCT` + `sendDeviceCloudTapPct` + `ensureDeviceCloudScreenMetrics`
- Digitação 1 char/caixa via %
- Rota `tap-overflow-item` + `waba-device-cloud-adb-menu.ts` + `tap-menu-label.sh`
- Lingueta com `navMax < 6` só navega (sem pairingCode)

## Arquivos

- `index.html`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-21-dc-etapa-2-pct`
- `src/device-cloud/waba-device-cloud.routes.ts`
- `src/device-cloud/waba-device-cloud-adb-menu.ts`
- `scripts/device-cloud/tap-menu-label.sh`
- `doc/DEVICE-CLOUD-PAIRING-ETAPAS.md`

## Como validar

1. Ctrl+F5 em `http://localhost:3012/version-02/`
2. Health: marker `DEPLOY-2026-08-21-dc-etapa-2-pct`
3. Dispositivos → lingueta «Adicionar ao Aquecedor»
4. Esperado etapa 2: WA abre + menu ⋮; **sem** gerar código EVO

## Keywords

pairing, etapa, DEVICE_CLOUD_PAIRING_PCT, MAX_STEP, EM-6034, tap-overflow-item
