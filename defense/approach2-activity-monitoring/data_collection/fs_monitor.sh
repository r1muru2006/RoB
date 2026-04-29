#!/bin/bash
# File system activity monitor using inotifywait.
# Monitors a directory for file system events triggered by web apps via FSA API.
#
# Usage: ./fs_monitor.sh <directory_to_watch> [output_file] [duration_seconds]

WATCH_DIR="${1:-.}"
OUTPUT_FILE="${2:-fs_activity_log.txt}"
DURATION="${3:-60}"

if ! command -v inotifywait &>/dev/null; then
    echo "[!] inotifywait not found. Install with: sudo apt install inotify-tools"
    exit 1
fi

if [ ! -d "$WATCH_DIR" ]; then
    echo "[!] Directory not found: $WATCH_DIR"
    exit 1
fi

echo "[*] Monitoring file system activities in: $WATCH_DIR"
echo "[*] Duration: ${DURATION}s"
echo "[*] Output: $OUTPUT_FILE"
echo ""

inotifywait -m -r \
    --timefmt '%Y-%m-%d %H:%M:%S' \
    --format '%T %e %w%f' \
    -e create,modify,delete,moved_from,moved_to,attrib,close_write,close_nowrite,open,access \
    "$WATCH_DIR" \
    > "$OUTPUT_FILE" 2>/dev/null &

INOTIFY_PID=$!
echo "[*] inotifywait running (PID: $INOTIFY_PID)"

sleep "$DURATION"
kill "$INOTIFY_PID" 2>/dev/null
wait "$INOTIFY_PID" 2>/dev/null

echo ""
echo "[+] Monitoring complete."
echo "[+] Events captured: $(wc -l < "$OUTPUT_FILE")"

echo ""
echo "[*] Extracting event types..."
awk '{print $3}' "$OUTPUT_FILE" | sort | uniq -c | sort -rn > "${OUTPUT_FILE%.txt}_summary.txt"
echo "[+] Event summary saved to ${OUTPUT_FILE%.txt}_summary.txt"

echo ""
echo "[*] Extracting event sequence..."
awk '{print $3}' "$OUTPUT_FILE" > "${OUTPUT_FILE%.txt}_sequence.txt"
echo "[+] Event sequence saved to ${OUTPUT_FILE%.txt}_sequence.txt"
