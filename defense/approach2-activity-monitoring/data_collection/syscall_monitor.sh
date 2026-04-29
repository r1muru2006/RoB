#!/bin/bash
# System call monitor for browser processes using strace.
# Captures syscalls made by Chrome/Chromium processes.
#
# Usage: ./syscall_monitor.sh [output_file] [duration_seconds]

OUTPUT_FILE="${1:-syscall_log.txt}"
DURATION="${2:-60}"

echo "[*] Finding Chrome/Chromium browser PID..."

BROWSER_PID=$(pgrep -f "chrome|chromium" | head -1)

if [ -z "$BROWSER_PID" ]; then
    echo "[!] No Chrome/Chromium process found. Please start the browser first."
    exit 1
fi

echo "[*] Attaching strace to PID $BROWSER_PID"
echo "[*] Duration: ${DURATION}s"
echo "[*] Output: $OUTPUT_FILE"

timeout "$DURATION" strace -p "$BROWSER_PID" \
    -e trace=read,write,open,close,stat,fstat,lseek,mmap,mprotect,munmap,brk,ioctl,access,pipe,poll,nanosleep,sendto,recvfrom,socket,connect,bind,listen,clone,execve,fcntl,flock,fsync,fdatasync,rename,unlink,mkdir,getcwd,chmod,readlink,getdents,epoll_wait,epoll_ctl,futex,clock_gettime,getrandom \
    -c -S calls \
    -o "$OUTPUT_FILE" \
    2>/dev/null

echo ""
echo "[+] strace capture complete. Output saved to $OUTPUT_FILE"

strace -p "$BROWSER_PID" \
    -e trace=read,write,open,close,stat,fstat,lseek,mmap,brk,ioctl,access,poll,nanosleep,sendto,recvfrom,socket,connect,clone,fcntl,fsync,fdatasync,rename,unlink,getcwd,getdents,epoll_wait,futex,clock_gettime,getrandom \
    -f -tt -o "${OUTPUT_FILE%.txt}_raw.txt" &
STRACE_PID=$!

echo "[*] Raw syscall trace running in background (PID: $STRACE_PID)"
echo "[*] Collecting for ${DURATION}s..."

sleep "$DURATION"
kill "$STRACE_PID" 2>/dev/null
wait "$STRACE_PID" 2>/dev/null

echo "[+] Raw trace saved to ${OUTPUT_FILE%.txt}_raw.txt"

echo ""
echo "[*] Extracting syscall sequence..."
grep -oP '(?<=\d\d:\d\d:\d\d\.\d{6} )\w+(?=\()' "${OUTPUT_FILE%.txt}_raw.txt" > "${OUTPUT_FILE%.txt}_sequence.txt" 2>/dev/null
echo "[+] Syscall sequence saved to ${OUTPUT_FILE%.txt}_sequence.txt"
