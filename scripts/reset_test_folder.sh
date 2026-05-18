#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="$REPO_ROOT/test_folder"

case "$TARGET_DIR" in
  "$REPO_ROOT"/test_folder) ;;
  *)
    echo "Refusing to reset unexpected path: $TARGET_DIR" >&2
    exit 1
    ;;
esac

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/subdir"

make_repeated_file() {
  local path="$1"
  local line="$2"
  local count="$3"

  : > "$path"
  for _ in $(seq 1 "$count"); do
    printf '%s\n' "$line" >> "$path"
  done
}

for i in 01 02 03 04 05; do
  make_repeated_file \
    "$TARGET_DIR/document_$i.txt" \
    "RoB detector test file $i - repeated low entropy text for entropy delta." \
    260
done

for i in 01 02 03; do
  make_repeated_file \
    "$TARGET_DIR/report_$i.docx" \
    "DOCX-like lab sample $i. This is intentionally plain text content saved with a docx extension for detector testing." \
    220
done

for i in 01 02; do
  make_repeated_file \
    "$TARGET_DIR/manual_$i.pdf" \
    "PDF-like lab sample $i. Disposable test content only." \
    220
done

make_repeated_file \
  "$TARGET_DIR/subdir/nested_01.txt" \
  "nested test file for recursive scan" \
  180

python3 - "$TARGET_DIR/photo_01.jpeg" "$TARGET_DIR/image_01.png" <<'PY'
import random
import sys

for seed, path in enumerate(sys.argv[1:], start=1337):
    rng = random.Random(seed)
    with open(path, "wb") as f:
        f.write(bytes(rng.randrange(0, 256) for _ in range(8192)))
PY

cat > "$TARGET_DIR/README_TEST_FOLDER.txt" <<'EOF'
Disposable RoB test folder.

You can select this folder during the browser demo. Files here may be
overwritten/encrypted. To restore the clean test data, run:

  ./scripts/reset_test_folder.sh
EOF

find "$TARGET_DIR" -type f -printf '%P %s bytes\n' | sort
