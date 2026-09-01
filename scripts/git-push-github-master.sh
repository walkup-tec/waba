#!/usr/bin/env bash
# Empurra a ref local para github.com/walkup-tec/waba (master) usando GITHUB_TOKEN.
# Uso:
#   scripts/git-push-github-master.sh           # empurra HEAD
#   scripts/git-push-github-master.sh abc123    # empurra commit/ref
#
# Requisitos: env GITHUB_TOKEN = Fine-grained PAT com Contents: Read and write
# no repositório walkup-tec/waba. Nunca imprime o token.

set -euo pipefail

REPO_URL="https://github.com/walkup-tec/waba.git"
TARGET_REF="${1:-HEAD}"
BRANCH="${GITHUB_PUSH_BRANCH:-master}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERRO: GITHUB_TOKEN ausente. Grave o Fine-grained PAT em Cursor Secrets (Contents: Read and write)." >&2
  exit 2
fi

# Limpa extraheader injetado por sessões anteriores (Duplicate Authorization → 400)
unset GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 || true

probe="$(curl -sS -o /tmp/waba-gh-blob.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/walkup-tec/waba/git/blobs \
  -d '{"content":"cHJvYmU=","encoding":"base64"}' || true)"

if [[ "$probe" != "201" ]]; then
  msg="$(python3 -c 'import json;print(json.load(open("/tmp/waba-gh-blob.json")).get("message",""))' 2>/dev/null || true)"
  echo "ERRO: GITHUB_TOKEN sem Contents Write (HTTP ${probe}). ${msg}" >&2
  echo "Ajuste o Fine-grained PAT: Contents = Read and write no repo walkup-tec/waba." >&2
  exit 3
fi

ASKPASS="$(mktemp)"
trap 'rm -f "$ASKPASS"' EXIT
python3 - "$ASKPASS" <<'PY'
import os, sys, shlex
path = sys.argv[1]
token = os.environ["GITHUB_TOKEN"]
body = (
    "#!/bin/sh\n"
    "case \"$1\" in\n"
    "*Username*) printf '%s\\n' \"walkup-tec\" ;;\n"
    "*Password*) printf '%s\\n' " + shlex.quote(token) + " ;;\n"
    "*) printf '\\n' ;;\n"
    "esac\n"
)
with open(path, "w", encoding="utf-8") as f:
    f.write(body)
os.chmod(path, 0o700)
PY

SHA="$(git rev-parse "$TARGET_REF")"
echo "Push ${SHA} → ${REPO_URL} (${BRANCH})"

GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0 \
  git -c credential.helper= push "$REPO_URL" "${SHA}:refs/heads/${BRANCH}"

echo "OK. Tip remoto:"
GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0 \
  git -c credential.helper= ls-remote "$REPO_URL" "refs/heads/${BRANCH}"
