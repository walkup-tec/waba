# Política de unidades — WABA

## Drive principal (padrão)

| Unidade | Papel |
|---------|--------|
| **E:** | **Workspace principal de trabalho** (código, terminal, venv, crawlers, builds pesados) |
| **H:** | Espelho Google Drive / sync cloud (evitar `node_modules`, venv e jobs longos) |
| **C:** | Apenas caches locais pontuais (npm cache, deps auxiliares) — **não** root do projeto |
| **D:** | Origens legadas / backup conforme script de espelho |

## Caminhos canônicos

```
E:\Waba
E:\Meu Drive\Drive Profissional\Waba   # espelho Drive Profissional em E:
```

Abrir no Cursor: **File → Open Folder** → `E:\Waba`

## Motivo

- `H:` (Google Drive File Stream) provoca travamentos de shell, I/O lento e problemas com `node_modules`/venv.
- `E:` é NTFS local — adequado para Python venv, npm, crawlers e git operacional.

## Sincronização

- Backup espelho: `C:\Scripts\backup-d-para-e.ps1` (diário 12:00) e sob demanda em “Atualize tudo”.
- Ao desenvolver no `E:\Waba`, commits/push a partir de `E:\Waba` quando for o clone git ativo.

## Traefik crawler

```
E:\Waba\traefik-crawler
```

```powershell
cd E:\Waba\traefik-crawler
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```
