#!/usr/bin/env python3
"""
N-gram feature extraction for activity monitoring.

Based on Section 6.2:
- FSA API calls: 2-gram
- System calls: 4-gram
- File system activities: 1-gram

Outputs feature vectors as JSON for each app.
"""

import json
from collections import Counter
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "sample_data"
OUTPUT_DIR = Path(__file__).resolve().parent / "ngram_features"


def extract_ngrams(sequence, n):
    if n == 1:
        return list(sequence)
    return [tuple(sequence[i:i+n]) for i in range(len(sequence) - n + 1)]


def ngram_frequency(sequence, n):
    ngrams = extract_ngrams(sequence, n)
    counts = Counter(ngrams)
    total = sum(counts.values())
    if total == 0:
        return {}
    freq = {}
    for ngram, count in counts.items():
        key = ngram if isinstance(ngram, str) else " -> ".join(ngram)
        freq[key] = count / total
    return freq


def load_all_samples():
    samples = []
    for subdir in ["benign", "malicious"]:
        d = DATA_DIR / subdir
        if not d.exists():
            continue
        for f in sorted(d.glob("*.json")):
            data = json.loads(f.read_text())
            samples.append(data)
    return samples


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    samples = load_all_samples()

    if not samples:
        print("[!] No sample data found. Run generate_sample_data.py first.")
        return

    all_features = {}

    for sample in samples:
        name = sample["app_name"]

        fsa_freq = ngram_frequency(sample.get("fsa_calls", []), n=2)
        sys_freq = ngram_frequency(sample.get("syscalls", []), n=4)
        fs_freq = ngram_frequency(sample.get("fs_activities", []), n=1)

        all_features[name] = {
            "type": sample["type"],
            "fsa_2gram": fsa_freq,
            "syscall_4gram": sys_freq,
            "fs_1gram": fs_freq,
        }

        print(f"[+] {name}: FSA 2-grams={len(fsa_freq)}, "
              f"Syscall 4-grams={len(sys_freq)}, FS 1-grams={len(fs_freq)}")

    output_path = OUTPUT_DIR / "all_ngram_features.json"
    output_path.write_text(json.dumps(all_features, indent=2))
    print(f"\n[+] All n-gram features saved to {output_path}")

    print("\n[+] Top 5 FSA 2-grams per app:")
    for name, feats in all_features.items():
        top = sorted(feats["fsa_2gram"].items(), key=lambda x: -x[1])[:5]
        top_str = ", ".join(f"{k}:{v:.3f}" for k, v in top)
        print(f"    {name}: {top_str}")


if __name__ == "__main__":
    main()
