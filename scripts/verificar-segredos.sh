#!/usr/bin/env bash
# Procura segredos acidentalmente versionados (chaves de API, tokens, chaves privadas, URLs de banco
# com senha real). Roda no CI (.github/workflows/seguranca.yml) e na mao: bash scripts/verificar-segredos.sh
# Considera so' arquivos rastreados pelo git. Modelos (.example) e textos com "troque" sao ignorados.
set -u
cd "$(git rev-parse --show-toplevel)"

achou=0

aviso() {
  echo "ATENCAO: $1"
  achou=1
}

# 1) Arquivos de ambiente reais nao podem estar versionados (so' os .example).
if git ls-files | grep -E '(^|/)\.env(\..+)?$' | grep -vE '\.example$'; then
  aviso "arquivo .env versionado (acima). Remova do git e troque as chaves que estavam nele."
fi

# 2) Padroes de chaves conhecidas.
PADROES='re_[A-Za-z0-9]{20,}|cfat_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{32,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
if git grep -nIE "$PADROES" -- . ':(exclude)*.example' | grep -vi 'troque'; then
  aviso "possivel chave/token no codigo (linhas acima)."
fi

# 3) URLs de banco com usuario:senha reais (ignora placeholders e exemplos de teste/CI).
if git grep -nIE 'postgres(ql)?://[^:@/[:space:]]+:[^@[:space:]]{8,}@' -- . ':(exclude)*.example' ':(exclude).github/workflows/*' \
   | grep -viE 'troque|senha|exemplo|password|teste|localhost|\$\{'; then
  aviso "URL de banco com senha aparente (linhas acima)."
fi

if [ "$achou" -eq 0 ]; then
  echo "Nenhum segredo encontrado nos arquivos versionados."
fi
exit "$achou"
