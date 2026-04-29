#!/usr/bin/env python3
"""
Compute Euclidean distance similarity matrices between all app pairs.

Uses 10% quantile ranges for normalization as described in the paper.
Outputs distance matrices as CSV and numpy arrays.
"""

import json
import csv
import numpy as np
from pathlib import Path

NGRAM_DIR = Path(__file__).resolve().parent / "ngram_features"
OUTPUT_DIR = Path(__file__).resolve().parent / "similarity_matrices"


def build_feature_vector(freq_dict, all_keys):
    return np.array([freq_dict.get(k, 0.0) for k in all_keys])


def euclidean_distance_matrix(vectors):
    n = len(vectors)
    matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            matrix[i][j] = np.linalg.norm(vectors[i] - vectors[j])
    return matrix


def normalize_quantile(matrix, quantile=0.1):
    flat = matrix.flatten()
    flat_nonzero = flat[flat > 0]
    if len(flat_nonzero) == 0:
        return matrix
    q_low = np.quantile(flat_nonzero, quantile)
    q_high = np.quantile(flat_nonzero, 1 - quantile)
    if q_high <= q_low:
        return matrix / (matrix.max() + 1e-10)
    normalized = np.clip((matrix - q_low) / (q_high - q_low), 0, 1)
    np.fill_diagonal(normalized, 0)
    return normalized


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    features_path = NGRAM_DIR / "all_ngram_features.json"
    if not features_path.exists():
        print("[!] N-gram features not found. Run ngram.py first.")
        return

    all_features = json.loads(features_path.read_text())
    app_names = list(all_features.keys())
    n = len(app_names)

    feature_types = [
        ("fsa_2gram", "FSA API Function Calls (2-gram)"),
        ("syscall_4gram", "System Calls (4-gram)"),
        ("fs_1gram", "File System Activities (1-gram)"),
    ]

    for feat_key, feat_name in feature_types:
        all_keys = set()
        for name in app_names:
            all_keys.update(all_features[name][feat_key].keys())
        all_keys = sorted(all_keys)

        vectors = []
        for name in app_names:
            vec = build_feature_vector(all_features[name][feat_key], all_keys)
            vectors.append(vec)

        dist_matrix = euclidean_distance_matrix(vectors)
        norm_matrix = normalize_quantile(dist_matrix)

        csv_path = OUTPUT_DIR / f"{feat_key}_distance.csv"
        with open(csv_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([""] + app_names)
            for i, name in enumerate(app_names):
                writer.writerow([name] + [f"{norm_matrix[i][j]:.6f}" for j in range(n)])

        npy_path = OUTPUT_DIR / f"{feat_key}_distance.npy"
        np.save(npy_path, norm_matrix)

        print(f"[+] {feat_name}:")
        print(f"    Distance matrix: {csv_path}")
        print(f"    Numpy array: {npy_path}")
        print(f"    Shape: {norm_matrix.shape}, Unique n-grams: {len(all_keys)}")

    names_path = OUTPUT_DIR / "app_names.json"
    names_path.write_text(json.dumps(app_names, indent=2))
    print(f"\n[+] App name order saved to {names_path}")


if __name__ == "__main__":
    main()
