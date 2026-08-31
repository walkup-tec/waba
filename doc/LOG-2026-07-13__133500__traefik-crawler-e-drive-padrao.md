# LOG — Traefik crawler + drive E: como principal

**Data:** 2026-07-13 ~13:35 BRT  
**Slug:** `traefik-crawler-e-drive-padrao`

## Contexto

1. Pedido: crawler profissional Python para coletar até 50k URLs Traefik → `urls.txt` (RAG/Cursor).
2. Pedido seguinte: usar **unidade E:** como drive principal de trabalho (H: travava shells).

## Ações

- Criado projeto `traefik-crawler/` (modular: config, http_client, extractors, search, checkpoint).
- Espelhado para `E:\Waba\traefik-crawler` via robocopy.
- venv + `pip install -r requirements.txt` em **E:** (Python 3.14.2).
- Crawler iniciado: `E:\Waba\traefik-crawler\.venv\Scripts\python.exe main.py --concurrency 20`
- Doc: `doc/SETUP-E-DRIVE.md`; `doc/SETUP-H-DRIVE.md` atualizado (E: = principal).

## Estado na primeira verificação

- `urls.txt`: ~665 URLs
- Fase: DuckDuckGo search (~15% de 367 queries)
- Checkpoint a cada 500 URLs; retomável via `data/`

## Como retomar / validar

```powershell
cd E:\Waba\traefik-crawler
.\.venv\Scripts\python.exe main.py
# progresso:
(Get-Content urls.txt | Measure-Object -Line).Lines
Get-Content data\checkpoint.json
```

## Cursor

Abrir pasta: `E:\Waba` (não H: para jobs longos).

## Palavras-chave

`traefik-crawler`, `urls.txt`, `RAG`, `E:\Waba`, `SETUP-E-DRIVE`, `drive-principal`
