# Contexto do pedido

Usuário enviou novo link do Google Drive com versão ajustada da logo Drax e pediu atualização no projeto.

# Comandos e ações executadas

1. Download da nova logo e substituição do asset local:
   - `Invoke-WebRequest -Uri "https://drive.google.com/uc?export=download&id=1f431Xz55iji0h-kuS0GZOa1tFbYYFQ_e" -OutFile "D:/Waba/media/Drax-logo-footer.png"`
2. Verificação dos diretórios de mídia:
   - `ls D:/Waba/media`
   - `ls D:/Waba/dist/media`
3. Build para propagar o novo arquivo para `dist`:
   - `npm run build`
4. Validação da cópia atualizada em `dist/media`:
   - `ls D:/Waba/dist/media`

# Solução implementada (passo a passo)

1. Substituído o arquivo `media/Drax-logo-footer.png` pela versão ajustada enviada no link.
2. Executado build para garantir atualização da versão publicada em `dist/media/Drax-logo-footer.png`.
3. Confirmado que `media` e `dist/media` estão com o mesmo arquivo atualizado.

# Arquivos criados/alterados

- `media/Drax-logo-footer.png` (atualizado)
- `dist/media/Drax-logo-footer.png` (atualizado via build)
- `doc/LOG-2026-03-27__114526__update-logo-drax-asset-ajustada-drive.md` (novo)

# Como validar

1. Recarregar aplicação no navegador com hard refresh (`Ctrl+F5`).
2. Confirmar que a logo exibida corresponde à versão ajustada.
3. Validar também no ambiente build/deploy usando o caminho `/media/Drax-logo-footer.png`.

# Observações de segurança

- Nenhuma credencial foi alterada ou exposta.
- Mudança limitada ao asset visual versionado no repositório.

# Itens para evitar duplicação no futuro (palavras-chave)

- logo-drax-ajustada
- update-asset-drive
- media-drax-logo
- dist-media-sync
