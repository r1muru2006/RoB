#!/usr/bin/env python3
"""
Extract features from original + modified file pairs for ML classification.

Features (per paper §6.1 + enhanced for better compressed-format detection):
  - entropy_change:  modified_entropy - original_entropy
  - size_change:     |modified_size - original_size| / original_size
  - entropy_modified: absolute entropy of modified file (near 8.0 = random)
  - byte_uniformity: chi-squared statistic of byte distribution (low = uniform = encrypted)
  - header_preserved: 1 if file magic bytes match expected format, 0 if destroyed
"""

import csv
import math
import re
import struct
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from entropy import shannon_entropy

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "dataset" / "samples"
OUTPUT_CSV = Path(__file__).resolve().parent / "features.csv"
FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]

MAGIC_BYTES = {
    "txt":  None,
    "pdf":  b"%PDF",
    "docx": b"PK\x03\x04",
    "xlsx": b"PK\x03\x04",
    "jpeg": b"\xff\xd8\xff",
}


def chi_squared_uniformity(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    n = len(data)
    expected = n / 256.0
    chi2 = sum((counts.get(b, 0) - expected) ** 2 / expected for b in range(256))
    return chi2


def header_matches(data: bytes, file_type: str) -> int:
    magic = MAGIC_BYTES.get(file_type)
    if magic is None:
        return 1
    if len(data) < len(magic):
        return 0
    return 1 if data[:len(magic)] == magic else 0


def extract_file_id(filename: str) -> str:
    m = re.match(r'([a-z]+_\d{4})', filename)
    return m.group(1) if m else None


def extract_features(orig_data: bytes, mod_data: bytes, file_type: str):
    orig_ent = shannon_entropy(orig_data)
    mod_ent = shannon_entropy(mod_data)
    orig_size = len(orig_data)
    mod_size = len(mod_data)

    ent_change = mod_ent - orig_ent
    size_change = abs(mod_size - orig_size) / orig_size if orig_size > 0 else 0
    chi2 = chi_squared_uniformity(mod_data)
    chi2_norm = chi2 / max(len(mod_data), 1) * 256
    header_ok = header_matches(mod_data, file_type)

    return {
        "entropy_original": orig_ent,
        "entropy_modified": mod_ent,
        "entropy_change": ent_change,
        "size_original": orig_size,
        "size_modified": mod_size,
        "size_change": size_change,
        "chi2_uniformity": chi2_norm,
        "header_preserved": header_ok,
    }


COLUMNS = [
    "file_type", "entropy_original", "entropy_modified", "entropy_change",
    "size_original", "size_modified", "size_change",
    "chi2_uniformity", "header_preserved", "label",
]

FEATURE_COLS = ["entropy_change", "size_change", "entropy_modified",
                "chi2_uniformity", "header_preserved"]


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
                originals[fid] = f.read_bytes()

        if benign_dir.exists():
            for f in sorted(benign_dir.iterdir()):
                fid = extract_file_id(f.name)
                if fid and fid in originals:
                    feats = extract_features(originals[fid], f.read_bytes(), ft)
                    rows.append([ft] + [feats[c] for c in COLUMNS[1:-1]] + ["benign"])

        if malicious_dir.exists():
            for f in sorted(malicious_dir.iterdir()):
                fid = extract_file_id(f.name)
                if fid and fid in originals:
                    feats = extract_features(originals[fid], f.read_bytes(), ft)
                    rows.append([ft] + [feats[c] for c in COLUMNS[1:-1]] + ["malicious"])

    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(COLUMNS)
        writer.writerows(rows)

    benign_count = sum(1 for r in rows if r[-1] == "benign")
    mal_count = sum(1 for r in rows if r[-1] == "malicious")
    print(f"[+] Extracted {len(rows)} feature rows ({len(COLUMNS)-2} features) to {OUTPUT_CSV}")
    print(f"    Benign: {benign_count}, Malicious: {mal_count}")
    for ft in FILE_TYPES:
        ft_rows = [r for r in rows if r[0] == ft]
        b = sum(1 for r in ft_rows if r[-1] == "benign")
        m = sum(1 for r in ft_rows if r[-1] == "malicious")
        print(f"    {ft}: benign={b}, malicious={m}")


if __name__ == "__main__":
    main()
