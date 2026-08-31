# LOG — Suporte assinante: áudio gravado + spinner

**Data:** 2026-06-18

## Problema
Após gravar áudio no modal de chamado (assinante), o arquivo não aparecia na lista de anexos.

## Causa
`MediaRecorder` sem timeslice + finalização no evento `stop` sem `requestData`/espera — em alguns navegadores os chunks ficavam vazios.

## Correção (`D:\Waba\index.html`)
- `recorder.start(250)` para chunks periódicos
- `requestData()` + espera antes de montar o `Blob`
- `appendWabaSupportRecordedAudio()` centraliza anexo
- Spinner `.waba-support-attachments-processing` durante gravação/anexo
- Lista com ícones por tipo (áudio verde, vídeo, imagem, etc.)

## Marker
`DEPLOY-2026-06-18-waba-support-audio-attach-processing`
