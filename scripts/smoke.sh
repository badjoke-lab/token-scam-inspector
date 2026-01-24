#!/usr/bin/env bash
set -euo pipefail

if ! command -v curl >/dev/null 2>&1; then
  echo "[smoke] curl is required but not installed."
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[smoke] jq is required but not installed."
  echo "[smoke] install hint: https://jqlang.github.io/jq/download/"
  exit 2
fi

BASE_URL_DEFAULT="https://token-scam-inspector.pages.dev"
BASE_URL="${BASE_URL:-$BASE_URL_DEFAULT}"
API_BASE="${API_BASE:-}"

api_url() {
  local path="$1"
  if [[ -n "$API_BASE" ]]; then
    printf "%s%s" "$API_BASE" "$path"
  else
    printf "%s/api%s" "$BASE_URL" "$path"
  fi
}

fail() {
  local message="$1"
  echo "[FAIL] $message"
  exit 1
}

bool_or_fail() {
  local value="$1"
  local context="$2"
  if [[ "$value" != "true" && "$value" != "false" ]]; then
    fail "$context expected boolean but got: $value"
  fi
}

extract_cache_header() {
  local headers_file="$1"
  local cache_header
  cache_header=$(awk -F': ' 'BEGIN{IGNORECASE=1} /^x-tsi-cache:/ {gsub(/\r/, "", $2); print $2}' "$headers_file" | tail -n1)
  if [[ -n "$cache_header" ]]; then
    case "$cache_header" in
      HIT|MISS|STALE) ;;
      *) fail "x-tsi-cache header has unexpected value: $cache_header" ;;
    esac
    printf "%s" "$cache_header"
  else
    printf "-"
  fi
}

call_endpoint() {
  local url="$1"
  local headers_file body_file http_code
  headers_file=$(mktemp)
  body_file=$(mktemp)
  http_code=$(curl -sS -D "$headers_file" -o "$body_file" -w "%{http_code}" "$url")
  echo "$headers_file|$body_file|$http_code"
}

print_summary() {
  local endpoint="$1"
  local status="$2"
  local cache="$3"
  local ok_value="$4"
  local error_code="$5"
  printf "[smoke] %s status=%s cache=%s ok=%s" "$endpoint" "$status" "$cache" "$ok_value"
  if [[ "$error_code" != "-" ]]; then
    printf " error.code=%s" "$error_code"
  fi
  printf "\n"
}

check_hello() {
  local endpoint="/api/hello"
  local url result headers_file body_file status cache ok_value error_code
  url=$(api_url "/hello")
  result=$(call_endpoint "$url")
  IFS='|' read -r headers_file body_file status <<<"$result"

  [[ "$status" == "200" ]] || fail "$endpoint expected HTTP 200 but got $status"

  ok_value=$(jq -r '.ok // empty' "$body_file")
  [[ "$ok_value" == "true" ]] || fail "$endpoint expected .ok == true"

  cache=$(extract_cache_header "$headers_file")
  error_code="-"
  print_summary "$endpoint" "$status" "$cache" "$ok_value" "$error_code"

  rm -f "$headers_file" "$body_file"
}

check_inspect_success() {
  local chain="$1"
  local address="$2"
  local endpoint="/api/inspect?chain=${chain}&address=${address}"
  local url result headers_file body_file status cache ok_value error_code checks_kind checks_count
  url=$(api_url "/inspect?chain=${chain}&address=${address}")
  result=$(call_endpoint "$url")
  IFS='|' read -r headers_file body_file status <<<"$result"

  [[ "$status" == "200" ]] || fail "$endpoint expected HTTP 200 but got $status"

  ok_value=$(jq -r 'if (.ok|type)=="boolean" then .ok else "" end' "$body_file")
  bool_or_fail "$ok_value" "$endpoint .ok"

  if [[ "$ok_value" == "true" ]]; then
    jq -e '.result.overallRisk' "$body_file" >/dev/null ||
      fail "$endpoint missing .result.overallRisk"

    checks_kind=$(jq -r 'if (.result.checks|type)=="array" then "array" elif (.result.checks|type)=="object" then "object" else "" end' "$body_file")
    [[ -n "$checks_kind" ]] || fail "$endpoint .result.checks must be array or object"

    if [[ "$checks_kind" == "array" ]]; then
      checks_count=$(jq -r '.result.checks | length' "$body_file")
    else
      checks_count=$(jq -r '.result.checks | keys | length' "$body_file")
    fi

    if (( checks_count < 7 )); then
      fail "$endpoint expected at least 7 checks but got $checks_count"
    fi
    error_code="-"
  else
    jq -e '.error.code and .error.message' "$body_file" >/dev/null ||
      fail "$endpoint expected .error.code and .error.message when ok=false"
    error_code=$(jq -r '.error.code' "$body_file")
  fi

  cache=$(extract_cache_header "$headers_file")
  print_summary "$endpoint" "$status" "$cache" "$ok_value" "$error_code"

  rm -f "$headers_file" "$body_file"
}

check_negative_validation() {
  local endpoint="/api/inspect?chain=eth&address=0x123"
  local url result headers_file body_file status cache ok_value error_code
  url=$(api_url "/inspect?chain=eth&address=0x123")
  result=$(call_endpoint "$url")
  IFS='|' read -r headers_file body_file status <<<"$result"

  [[ "$status" == "400" || "$status" == "200" ]] ||
    fail "$endpoint expected HTTP 400 or 200 but got $status"

  ok_value=$(jq -r 'if (.ok|type)=="boolean" then .ok else "" end' "$body_file")
  [[ "$ok_value" == "false" ]] || fail "$endpoint expected .ok == false"

  error_code=$(jq -r '.error.code // empty' "$body_file")
  case "$error_code" in
    invalid_address|missing_params) ;;
    *) fail "$endpoint expected error.code invalid_address or missing_params but got: ${error_code:-<empty>}" ;;
  esac

  cache=$(extract_cache_header "$headers_file")
  print_summary "$endpoint" "$status" "$cache" "$ok_value" "$error_code"

  rm -f "$headers_file" "$body_file"
}

main() {
  echo "[smoke] BASE_URL=${BASE_URL}"
  if [[ -n "$API_BASE" ]]; then
    echo "[smoke] API_BASE=${API_BASE}"
  fi

  check_hello
  check_inspect_success "eth" "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  check_inspect_success "bsc" "0x55d398326f99059fF775485246999027B3197955"
  check_negative_validation

  echo "[PASS] smoke checks completed"
}

main "$@"
