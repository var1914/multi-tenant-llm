#!/bin/bash
# TokenTrail Watchdog Service
# Monitors container health and auto-restarts failed containers

set -e

LOG_FILE="/var/log/tokentrail/watchdog.log"
CHECK_INTERVAL=30
MAX_RESTART_ATTEMPTS=3
RESTART_COOLDOWN=300  # 5 minutes between restart attempts

# Containers to monitor
CONTAINERS=(
    "tokentrail-api"
    "tokentrail-litellm"
    "tokentrail-redis"
    "tokentrail-nginx"
)

# Track restart attempts
declare -A RESTART_COUNTS
declare -A LAST_RESTART_TIME

mkdir -p /var/log/tokentrail

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

send_alert() {
    local message="$1"
    local severity="$2"

    # Log to file
    log "$severity" "$message"

    # Send to Slack if configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local emoji="⚠️"
        [ "$severity" = "CRITICAL" ] && emoji="🚨"
        [ "$severity" = "INFO" ] && emoji="ℹ️"
        [ "$severity" = "SUCCESS" ] && emoji="✅"

        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji *TokenTrail Watchdog*: $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    # Log to CloudWatch (if AWS CLI available)
    if command -v aws &> /dev/null; then
        aws logs put-log-events \
            --log-group-name "/tokentrail/watchdog" \
            --log-stream-name "$(hostname)" \
            --log-events timestamp=$(date +%s000),message="[$severity] $message" \
            2>/dev/null || true
    fi
}

check_container() {
    local container="$1"

    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "not_found"
        return
    fi

    # Check container status
    local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
    local health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null)

    if [ "$status" != "running" ]; then
        echo "stopped"
    elif [ "$health" = "unhealthy" ]; then
        echo "unhealthy"
    else
        echo "healthy"
    fi
}

get_container_logs() {
    local container="$1"
    local lines="${2:-20}"
    docker logs --tail "$lines" "$container" 2>&1
}

restart_container() {
    local container="$1"
    local current_time=$(date +%s)

    # Check cooldown
    local last_restart=${LAST_RESTART_TIME[$container]:-0}
    local time_since_restart=$((current_time - last_restart))

    if [ $time_since_restart -lt $RESTART_COOLDOWN ]; then
        log "WARN" "Container $container in cooldown period ($time_since_restart/${RESTART_COOLDOWN}s)"
        return 1
    fi

    # Check restart count
    local restart_count=${RESTART_COUNTS[$container]:-0}
    if [ $restart_count -ge $MAX_RESTART_ATTEMPTS ]; then
        send_alert "Container $container exceeded max restart attempts ($MAX_RESTART_ATTEMPTS). Manual intervention required!" "CRITICAL"
        return 1
    fi

    # Attempt restart
    log "INFO" "Restarting container $container (attempt $((restart_count + 1))/$MAX_RESTART_ATTEMPTS)"

    if docker restart "$container" 2>/dev/null; then
        RESTART_COUNTS[$container]=$((restart_count + 1))
        LAST_RESTART_TIME[$container]=$current_time
        send_alert "Container $container restarted successfully" "INFO"
        return 0
    else
        send_alert "Failed to restart container $container" "CRITICAL"
        return 1
    fi
}

reset_restart_count() {
    local container="$1"
    if [ "${RESTART_COUNTS[$container]:-0}" -gt 0 ]; then
        log "INFO" "Container $container stable, resetting restart count"
        RESTART_COUNTS[$container]=0
    fi
}

main() {
    log "INFO" "TokenTrail Watchdog starting..."
    log "INFO" "Monitoring containers: ${CONTAINERS[*]}"
    log "INFO" "Check interval: ${CHECK_INTERVAL}s"

    send_alert "Watchdog service started on $(hostname)" "INFO"

    # Initialize restart tracking
    for container in "${CONTAINERS[@]}"; do
        RESTART_COUNTS[$container]=0
        LAST_RESTART_TIME[$container]=0
    done

    # Main monitoring loop
    while true; do
        for container in "${CONTAINERS[@]}"; do
            status=$(check_container "$container")

            case "$status" in
                "healthy")
                    reset_restart_count "$container"
                    ;;
                "unhealthy")
                    log "WARN" "Container $container is unhealthy"
                    logs=$(get_container_logs "$container" 10)
                    send_alert "Container $container is UNHEALTHY\nLogs:\n$logs" "WARNING"
                    restart_container "$container"
                    ;;
                "stopped")
                    log "ERROR" "Container $container is stopped"
                    logs=$(get_container_logs "$container" 20)
                    send_alert "Container $container is STOPPED\nLogs:\n$logs" "CRITICAL"
                    restart_container "$container"
                    ;;
                "not_found")
                    log "ERROR" "Container $container not found!"
                    send_alert "Container $container NOT FOUND - may need full stack restart" "CRITICAL"
                    ;;
            esac
        done

        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals for graceful shutdown
trap 'log "INFO" "Watchdog shutting down..."; exit 0' SIGTERM SIGINT

main
