#!/usr/bin/env bash
# =============================================================================
# Aiyedun Platform Health Check
# Checks: Docker containers, public endpoints, system resources
# Usage:  ./infra/scripts/health-check.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}[PASS]${RESET}"
FAIL="${RED}[FAIL]${RESET}"
WARN="${YELLOW}[WARN]${RESET}"

EXIT_CODE=0

print_section() {
    echo ""
    echo -e "${CYAN}${BOLD}══════════════════════════════════════════${RESET}"
    echo -e "${CYAN}${BOLD}  $1${RESET}"
    echo -e "${CYAN}${BOLD}══════════════════════════════════════════${RESET}"
}

# ── Docker containers ─────────────────────────────────────────────────────────
print_section "Docker Container Status"

CONTAINERS=(
    "aiyedun-postgres"
    "aiyedun-chromadb"
    "aiyedun-ollama"
    "aiyedun-backend"
    "aiyedun-frontend"
    "aiyedun-admin"
)

for container in "${CONTAINERS[@]}"; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    running=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")

    if [[ "$running" == "not_found" ]]; then
        echo -e "${FAIL} ${container} — container not found"
        EXIT_CODE=1
    elif [[ "$running" != "running" ]]; then
        echo -e "${FAIL} ${container} — state: ${running}"
        EXIT_CODE=1
    elif [[ "$status" == "healthy" ]]; then
        echo -e "${PASS} ${container} — running / healthy"
    elif [[ "$status" == "starting" ]]; then
        echo -e "${WARN} ${container} — running / health: starting"
    elif [[ "$status" == "unhealthy" ]]; then
        echo -e "${FAIL} ${container} — running / unhealthy"
        EXIT_CODE=1
    else
        # No healthcheck defined or status unknown — just confirm running
        echo -e "${PASS} ${container} — running (no healthcheck)"
    fi
done

# ── Public HTTPS endpoints ────────────────────────────────────────────────────
print_section "Public Endpoint Checks"

check_https() {
    local label="$1"
    local url="$2"
    local http_code
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    if [[ "$http_code" =~ ^(200|301|302|307|308)$ ]]; then
        echo -e "${PASS} ${label} — HTTP ${http_code}"
    else
        echo -e "${FAIL} ${label} — HTTP ${http_code} (${url})"
        EXIT_CODE=1
    fi
}

check_https "User Portal    https://aiyedun.online"        "https://aiyedun.online"
check_https "Admin Panel    https://admin.aiyedun.online"  "https://admin.aiyedun.online"
check_https "API Health     https://api.aiyedun.online"    "https://api.aiyedun.online/api/v1/health"

# ── System resources ──────────────────────────────────────────────────────────
print_section "System Resources"

# RAM
total_mem=$(free -m | awk '/^Mem:/ {print $2}')
used_mem=$(free -m | awk '/^Mem:/ {print $3}')
mem_pct=$(awk "BEGIN {printf \"%.0f\", ($used_mem/$total_mem)*100}")
if (( mem_pct < 80 )); then
    echo -e "${PASS} RAM — ${used_mem}MB / ${total_mem}MB (${mem_pct}%)"
elif (( mem_pct < 90 )); then
    echo -e "${WARN} RAM — ${used_mem}MB / ${total_mem}MB (${mem_pct}%) — high usage"
else
    echo -e "${FAIL} RAM — ${used_mem}MB / ${total_mem}MB (${mem_pct}%) — critical"
    EXIT_CODE=1
fi

# Disk (root)
disk_pct=$(df -h / | awk 'NR==2 {gsub(/%/,""); print $5}')
disk_avail=$(df -h / | awk 'NR==2 {print $4}')
if (( disk_pct < 80 )); then
    echo -e "${PASS} Disk (/) — ${disk_pct}% used, ${disk_avail} free"
elif (( disk_pct < 90 )); then
    echo -e "${WARN} Disk (/) — ${disk_pct}% used — consider cleanup"
else
    echo -e "${FAIL} Disk (/) — ${disk_pct}% used — critical"
    EXIT_CODE=1
fi

# CPU (1-minute load average vs core count)
cpu_cores=$(nproc)
load_avg=$(awk '{print $1}' /proc/loadavg)
load_int=$(awk "BEGIN {printf \"%.0f\", $load_avg}")
if (( load_int <= cpu_cores )); then
    echo -e "${PASS} CPU  — load avg ${load_avg} (${cpu_cores} cores)"
elif (( load_int <= cpu_cores * 2 )); then
    echo -e "${WARN} CPU  — load avg ${load_avg} — elevated (${cpu_cores} cores)"
else
    echo -e "${FAIL} CPU  — load avg ${load_avg} — overloaded (${cpu_cores} cores)"
    EXIT_CODE=1
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}══════════════════════════════════════════${RESET}"
if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}  ALL CHECKS PASSED${RESET}"
else
    echo -e "${RED}${BOLD}  ONE OR MORE CHECKS FAILED — review output above${RESET}"
fi
echo -e "${CYAN}${BOLD}══════════════════════════════════════════${RESET}"
echo ""

exit $EXIT_CODE
