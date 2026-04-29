#!/usr/bin/env python3
"""
Extract entropy_change and size_change features from original + modified file pairs.

Output: features.csv with columns:
  file_type, entropy_original, entropy_modified, entropy_change,
  size_original, size_modified, size_change, label
"""

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from entropy import shannon_entropy

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "dataset" / "samples"
OUTPUT_CSV = Path(__file__).resolve().parent / "features.csv"
FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]
EXT_MAP = {"txt": ".txt", "pdf": ".pdf", "docx": ".docx", "xlsx": ".xlsx", "jpeg": ".jpeg"}


def extract_file_id(filename: str) -> str:
    m = re.match(r'([a-z]+_\d{4})', filename)
    return m.group(1) if m else None


def main():
    rows = []

    for ft in FILE_TYPES:
        orig_dir = SAMPLES_DIR / "originals" / ft
        benign_dir = SAMPLES_DIR / "benign" / ft
        malicious_dir = SAMPLES_DIR / "malicious" / ft

        if not orig_dir.exists():
            print(f"[!] Missing originals for {ft}, skipping")
            continue

        originals = {}
        for f in sorted(orig_dir.iterdir()):
            fid = extract_file_id(f.name)
            if fid:
                data = f.read_bytes()
                originals[fid] = (shannon_entropy(data), len(data))

        if benign_dir.exists():
            for f in sorted(benign_dir.iterdir()):
                fid = extract_file_id(f.name)
                if fid and fid in originals:
                    orig_ent, orig_size = originals[fid]
                    mod_data = f.read_bytes()
                    mod_ent = shannon_entropy(mod_data)
                    mod_size = len(mod_data)
                    ent_change = mod_ent - orig_ent
                    size_change = abs(mod_size - orig_size) / orig_size if orig_size > 0 else 0
                    rows.append([ft, orig_ent, mod_ent, ent_change, orig_size, mod_size, size_change, "benign"])

        if malicious_dir.exists():
            for f in sorted(malicious_dir.iterdir()):
                fid = extract_file_id(f.name)
                if fid and fid in originals:
                    orig_ent, orig_size = originals[fid]
                    mod_data = f.read_bytes()
                    mod_ent = shannon_entropy(mod_data)
                    mod_size = len(mod_data)
                    ent_change = mod_ent - orig_ent
                    size_change = abs(mod_size - orig_size) / orig_size if orig_size > 0 else 0
                    rows.append([ft, orig_ent, mod_ent, ent_change, orig_size, mod_size, size_change, "malicious"])

    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["file_type", "entropy_original", "entropy_modified", "entropy_change",
                          "size_original", "size_modified", "size_change", "label"])
        writer.writerows(rows)

    benign_count = sum(1 for r in rows if r[7] == "benign")
    mal_count = sum(1 for r in rows if r[7] == "malicious")
    print(f"[+] Extracted {len(rows)} feature rows to {OUTPUT_CSV}")
    print(f"    Benign: {benign_count}, Malicious: {mal_count}")
    for ft in FILE_TYPES:
        ft_rows = [r for r in rows if r[0] == ft]
        b = sum(1 for r in ft_rows if r[7] == "benign")
        m = sum(1 for r in ft_rows if r[7] == "malicious")
        print(f"    {ft}: benign={b}, malicious={m}")


if __name__ == "__main__":
    main()
