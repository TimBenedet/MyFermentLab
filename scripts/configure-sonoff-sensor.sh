#!/bin/bash
# Configure a Sonoff SNZB-02LD sensor with optimal reporting settings
# Usage: ./configure-sonoff-sensor.sh <sensor-name>
# Example: ./configure-sonoff-sensor.sh Sonde-Sonoff-3

SENSOR_NAME="$1"
MQTT_HOST="mosquitto"
SSH_HOST="192.168.1.51"
SSH_USER="homelab"
SSH_PASS="berlin"

# Reporting settings (optimized for fermentation monitoring)
MIN_INTERVAL=60      # Minimum 60 seconds between reports
MAX_INTERVAL=120     # Maximum 120 seconds between reports
CHANGE_THRESHOLD=10  # Report on 0.1°C change (10 = 0.1°C in Zigbee units)

if [ -z "$SENSOR_NAME" ]; then
    echo "Usage: $0 <sensor-name>"
    echo "Example: $0 Sonde-Sonoff-3"
    echo ""
    echo "This script configures a Sonoff SNZB-02LD temperature sensor with:"
    echo "  - Min report interval: ${MIN_INTERVAL}s"
    echo "  - Max report interval: ${MAX_INTERVAL}s"
    echo "  - Temperature change threshold: 0.1°C"
    echo ""
    echo "IMPORTANT: Run this script while removing/replacing the sensor battery"
    echo "           to ensure the sensor receives the configuration."
    exit 1
fi

echo "========================================"
echo "Configuring Sonoff Sensor: $SENSOR_NAME"
echo "========================================"
echo ""
echo "Settings:"
echo "  - Min interval: ${MIN_INTERVAL}s"
echo "  - Max interval: ${MAX_INTERVAL}s"
echo "  - Change threshold: 0.1°C"
echo ""
echo "IMPORTANT: Remove the battery from the sensor NOW,"
echo "           then press Enter to continue..."
read -p ""

echo ""
echo "Sending configuration request..."
echo "Replace the battery NOW and wait..."
echo ""

# Send configure_reporting request via MQTT
# We'll send it multiple times to catch the sensor wake-up window
for i in {1..10}; do
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SSH_HOST} \
        "docker exec mosquitto mosquitto_pub -h localhost \
        -t 'zigbee2mqtt/bridge/request/device/configure_reporting' \
        -m '{
            \"id\": \"${SENSOR_NAME}\",
            \"cluster\": \"msTemperatureMeasurement\",
            \"attribute\": \"measuredValue\",
            \"minimum_report_interval\": ${MIN_INTERVAL},
            \"maximum_report_interval\": ${MAX_INTERVAL},
            \"reportable_change\": ${CHANGE_THRESHOLD}
        }'" 2>/dev/null

    echo "  Attempt $i/10 sent..."
    sleep 2
done

echo ""
echo "Checking configuration result..."
sleep 5

# Check the logs for success
RESULT=$(sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SSH_HOST} \
    "docker logs zigbee2mqtt --tail 50 2>&1 | grep -E 'Configured reporting.*${SENSOR_NAME}|configure_reporting.*${SENSOR_NAME}.*ok'" 2>/dev/null)

if echo "$RESULT" | grep -q "Configured reporting\|status.*ok"; then
    echo "========================================"
    echo "SUCCESS! Sensor configured correctly."
    echo "========================================"
    echo ""
    echo "Verifying database entry..."

    # Get sensor IEEE address and show config
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SSH_HOST} \
        "grep '${SENSOR_NAME}' /home/homelab/zigbee2mqtt/zigbee2mqtt-data/database.db 2>/dev/null | \
         grep -o 'configuredReportings[^]]*]' | head -1" 2>/dev/null

    echo ""
    echo "The sensor will now report every ${MIN_INTERVAL}-${MAX_INTERVAL}s"
    echo "or when temperature changes by 0.1°C."
else
    echo "========================================"
    echo "Configuration may have failed or timed out."
    echo "========================================"
    echo ""
    echo "Try again and make sure to:"
    echo "1. Remove the battery BEFORE running the script"
    echo "2. Replace the battery RIGHT AFTER pressing Enter"
    echo ""
    echo "Recent logs:"
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SSH_HOST} \
        "docker logs zigbee2mqtt --tail 10 2>&1 | grep -i '${SENSOR_NAME}'" 2>/dev/null
fi
