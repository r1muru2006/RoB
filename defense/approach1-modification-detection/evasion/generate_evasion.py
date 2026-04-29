#!/usr/bin/env python3
"""
Generate evasion technique samples based on Appendix D of the paper.

Techniques:
1. Partial encryption (25% of file content)
2. Low-entropy data padding (null bytes after encryption)
3. Post-encryption encoding (Base64, Base32, Hexadecimal)
4. Custom evasion (partial encryption + padding to match benign entropy/size)
"""

import sys
import random
import csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "features"))

from shared.crypto_utils import (
    aes_encrypt_partial,
    aes_encrypt_with_padding,
    aes_encrypt_with_encoding,
    aes_encrypt_custom_evasion,
)
from entropy import shannon_entropy

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "dataset" / "samples"
EVASION_DIR = Path(__file__).resolve().parent / "evasion_samples"
OUTPUT_CSV = Path(__file__).resolve().parent / "evasion_features.csv"

FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]
EXT_MAP = {"txt": ".txt", "pdf": ".pdf", "docx": ".docx", "xlsx": ".xlsx", "jpeg": ".jpeg"}
SAMPLES_PER_TYPE = 100

TECHNIQUES = [
    "partial_encryption",
    "low_entropy_padding",
    "encoding_base64",
    "encoding_base32",
    "encoding_hex",
    "custom_evasion",
]


def main():
    random.seed(42)

    EVASION_DIR.mkdir(parents=True, exist_ok=True)
    for tech in TECHNIQUES:
        for ft in FILE_TYPES:
            (EVASION_DIR / tech / ft).mkdir(parents=True, exist_ok=True)

    rows = []

    for ft in FILE_TYPES:
        ext = EXT_MAP[ft]
        orig_dir = SAMPLES_DIR / "originals" / ft
        originals = sorted(orig_dir.iterdir())[:SAMPLES_PER_TYPE]

        print(f"[*] Generating evasion samples for {ft} ({len(originals)} files)...")

        for orig_path in originals:
            orig_data = orig_path.read_bytes()
            orig_entropy = shannon_entropy(orig_data)
            orig_size = len(orig_data)
            fid = orig_path.stem

            for tech in TECHNIQUES:
                if tech == "partial_encryption":
                    ev_data = aes_encrypt_partial(orig_data, ratio=0.25)
                elif tech == "low_entropy_padding":
                    ev_data = aes_encrypt_with_padding(orig_data, 10000, 20000)
                elif tech == "encoding_base64":
                    ev_data = aes_encrypt_with_encoding(orig_data, 'base64')
                elif tech == "encoding_base32":
                    ev_data = aes_encrypt_with_encoding(orig_data, 'base32')
                elif tech == "encoding_hex":
                    ev_data = aes_encrypt_with_encoding(orig_data, 'hex')
                elif tech == "custom_evasion":
                    target_entropy = orig_entropy + 0.05 * random.choice([-1, 1])
                    target_size = int(orig_size * (1 + 0.15 * random.random()))
                    ev_data = aes_encrypt_custom_evasion(orig_data, target_entropy, target_size)

                ev_path = EVASION_DIR / tech / ft / f"{fid}_ev{ext}"
                ev_path.write_bytes(ev_data)

                ev_entropy = shannon_entropy(ev_data)
                ev_size = len(ev_data)
                ent_change = ev_entropy - orig_entropy
                size_change = abs(ev_size - orig_size) / orig_size if orig_size > 0 else 0

                rows.append([
                    tech, ft, orig_entropy, ev_entropy, ent_change,
                    orig_size, ev_size, size_change, "malicious"
                ])

    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["technique", "file_type", "entropy_original", "entropy_modified",
                          "entropy_change", "size_original", "size_modified", "size_change", "label"])
        writer.writerows(rows)

    print(f"\n[+] Generated {len(rows)} evasion samples")
    print(f"[+] Features saved to {OUTPUT_CSV}")

    for tech in TECHNIQUES:
        tech_rows = [r for r in rows if r[0] == tech]
        avg_ent = sum(r[4] for r in tech_rows) / len(tech_rows)
        avg_size = sum(r[7] for r in tech_rows) / len(tech_rows)
        print(f"    {tech}: avg_entropy_change={avg_ent:.4f}, avg_size_change={avg_size:.4f}")


if __name__ == "__main__":
    main()
