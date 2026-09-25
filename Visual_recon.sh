#!/usr/bin/env bash
#
# visual_recon.sh
# Wrapper de conveniencia para o visual_recon.js: valida dependencias,
# localiza o Chromium instalado, e roda a captura de screenshots +
# fingerprint de tecnologia contra uma lista de hosts.
#
# Uso:
#   ./visual_recon.sh -i hosts.txt [opcoes]
#
# Exemplos:
#   ./visual_recon.sh -i hosts.txt
#   ./visual_recon.sh -i httpx.jsonl -t exemplo.com -a
#   ./visual_recon.sh -i hosts.txt -c 10 -T 20000
#
# Requisitos: Node.js 18+, Chromium instalado (sudo apt install chromium),
# dependencias do package.json instaladas (npm install).

set -uo pipefail

C_RESET='\033[0m'; C_INFO='\033[1;34m'; C_OK='\033[1;32m'
C_WARN='\033[1;33m'; C_ERR='\033[1;31m'

log_info() { echo -e "${C_INFO}[*]${C_RESET} $*"; }
log_ok()   { echo -e "${C_OK}[+]${C_RESET} $*"; }
log_warn() { echo -e "${C_WARN}[!]${C_RESET} $*"; }
log_err()  { echo -e "${C_ERR}[x]${C_RESET} $*" >&2; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$SCRIPT_DIR/relatorios}"
INPUT=""
TARGET=""
CONCURRENCY=5
TIMEOUT=15000
CHROMIUM_PATH="${CHROMIUM_PATH:-}"
ABRIR_NAVEGADOR=0

usage() {
    cat <<EOF
Uso: $(basename "$0") -i ARQUIVO [opcoes]

Opcoes:
  -i ARQUIVO      Lista de hosts (texto, um por linha) OU JSONL do httpx (obrigatorio)
  -t ALVO         Nome do alvo, so para exibir no titulo do relatorio
  -o DIRETORIO    Diretorio de saida (padrao: ./relatorios)
  -c N            Concorrencia (paginas simultaneas, padrao: 5)
  -T MS           Timeout por host em milissegundos (padrao: 15000)
  -p CAMINHO      Caminho do binario do Chromium (padrao: autodetecta)
  -a              Abre o relatorio automaticamente no navegador
  -h              Ajuda

Exemplos:
  $(basename "$0") -i hosts.txt
  $(basename "$0") -i relatorios/exemplo_httpx.jsonl -t exemplo.com -a
  $(basename "$0") -i hosts.txt -c 10 -T 20000
EOF
}

while getopts ":i:t:o:c:T:p:ah" opt; do
    case "$opt" in
        i) INPUT="$OPTARG" ;;
        t) TARGET="$OPTARG" ;;
        o) OUTPUT_DIR="$OPTARG" ;;
        c) CONCURRENCY="$OPTARG" ;;
        T) TIMEOUT="$OPTARG" ;;
        p) CHROMIUM_PATH="$OPTARG" ;;
        a) ABRIR_NAVEGADOR=1 ;;
        h) usage; exit 0 ;;
        \?) log_err "Opcao invalida: -$OPTARG"; usage; exit 1 ;;
        :) log_err "A opcao -$OPTARG requer um argumento."; usage; exit 1 ;;
    esac
done

if [[ -z "$INPUT" ]]; then
    log_err "Voce precisa informar a lista de hosts com -i."
    usage
    exit 1
fi
if [[ ! -f "$INPUT" ]]; then
    log_err "Arquivo de entrada nao encontrado: $INPUT"
    exit 1
fi

if ! command -v node &>/dev/null; then
    log_err "node nao encontrado no PATH. Instale o Node.js 18+ antes de continuar."
    exit 1
fi

if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
    log_err "Dependencias nao instaladas. Rode 'npm install' neste diretorio primeiro."
    exit 1
fi

if [[ -z "$CHROMIUM_PATH" ]]; then
    for candidate in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
        if [[ -x "$candidate" ]]; then
            CHROMIUM_PATH="$candidate"
            break
        fi
    done
fi
if [[ -z "$CHROMIUM_PATH" ]]; then
    log_err "Nao encontrei um Chromium instalado."
    log_err "No Kali/Debian: sudo apt install chromium"
    log_err "Ou informe o caminho manualmente com -p /caminho/para/chromium"
    exit 1
fi
log_info "Usando Chromium em: $CHROMIUM_PATH"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SAFE_NAME="$(printf '%s' "${TARGET:-recon}" | tr -c 'A-Za-z0-9._-' '_')"
HTML_FILE="$OUTPUT_DIR/${SAFE_NAME}_${TIMESTAMP}.html"

log_info "Entrada: $INPUT"
log_info "Concorrencia: $CONCURRENCY | Timeout: ${TIMEOUT}ms"
echo ""

node "$SCRIPT_DIR/Visual_recon.js" \
    --input "$INPUT" \
    --output "$HTML_FILE" \
    --chromium-path "$CHROMIUM_PATH" \
    --concurrency "$CONCURRENCY" \
    --timeout "$TIMEOUT" \
    --target "$TARGET"
STATUS=$?

if [[ $STATUS -ne 0 ]]; then
    log_err "O Visual_recon.js terminou com erro (codigo $STATUS)."
    exit "$STATUS"
fi

log_ok "Relatorio gerado: $HTML_FILE"

if [[ $ABRIR_NAVEGADOR -eq 1 ]]; then
    if command -v xdg-open &>/dev/null; then
        xdg-open "$HTML_FILE" &>/dev/null &
    elif command -v sensible-browser &>/dev/null; then
        sensible-browser "$HTML_FILE" &>/dev/null &
    else
        log_warn "Nao encontrei xdg-open nem sensible-browser."
    fi
fi