#!/bin/sh
# TokenTrail Health Monitor
# Monitors container health and sends alerts on failures

set -e

# Install dependencies
apk add --no-cache curl jq docker-cli 2>/dev/null || true

CHECK_INTERVAL=${CHECK_INTERVAL:-60}
CONTAINERS="tokentrail-api tokentrail-litellm tokentrail-redis tokentrail-nginx"
ALERT_SENT_FILE="/tmp/alert_sent"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_slack_alert() {
    local message="$1"
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 TokenTrail Alert: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
        log "Slack alert sent: $message"
    fi
}

send_email_alert() {
    local subject="$1"
    local body="$2"
    if [ -n "$ALERT_EMAIL" ]; then
        # Use AWS SES or configure sendmail
        log "Email alert would be sent to $ALERT_EMAIL: $subject"
    fi
}

check_container_health() {
    local container="$1"
    local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")

    if [ "$status" != "running" ]; then
        return 1
    fi

    if [ "$health" = "unhealthy" ]; then
        return 2
    fi

    return 0
}

get_container_logs() {
    local container="$1"
    docker logs --tail 50 "$container" 2>&1 || echo "Could not retrieve logs"
}

main() {
    log "Starting TokenTrail Health Monitor"
    log "Check interval: ${CHECK_INTERVAL}s"
    log "Monitoring containers: $CONTAINERS"

    while true; do
        for container in $CONTAINERS; do
            check_container_health "$container"
            result=$?

            alert_file="${ALERT_SENT_FILE}_${container}"

            if [ $result -eq 1 ]; then
                # Container not running
                if [ ! -f "$alert_file" ]; then
                    message="Container $container is NOT RUNNING!"
                    log "CRITICAL: $message"
                    send_slack_alert "$message"

                    # Try to restart
                    log "Attempting to restart $container..."
                    docker start "$container" 2>/dev/null || true

                    touch "$alert_file"
                fi
            elif [ $result -eq 2 ]; then
                # Container unhealthy
                if [ ! -f "$alert_file" ]; then
                    message="Container $container is UNHEALTHY!"
                    log "WARNING: $message"

                    # Get recent logs
                    logs=$(get_container_logs "$container")
                    send_slack_alert "$message\n\nRecent logs:\n\`\`\`$logs\`\`\`"

                    touch "$alert_file"
                fi
            else
                # Container healthy - clear alert state
                if [ -f "$alert_file" ]; then
                    log "Container $container recovered"
                    send_slack_alert "✅ Container $container has recovered"
                    rm -f "$alert_file"
                fi
            fi
        done

        sleep "$CHECK_INTERVAL"
    done
}

main
