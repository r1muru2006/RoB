#!/usr/bin/env python3
"""
Generate heatmap visualizations matching Figure 3 in the paper.

Three heatmaps:
(a) FSA API Function Calls (2-gram)
(b) System Calls (4-gram)
(c) File System Activities (1-gram)

Darker marking = more differentiable (greater distance).
"""

import json
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

SIMILARITY_DIR = Path(__file__).resolve().parent / "similarity_matrices"
OUTPUT_DIR = Path(__file__).resolve().parent / "heatmaps"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    names_path = SIMILARITY_DIR / "app_names.json"
    if not names_path.exists():
        print("[!] Similarity matrices not found. Run similarity.py first.")
        return

    app_names = json.loads(names_path.read_text())

    short_names = []
    for name in app_names:
        if name.startswith("RoB"):
            short_names.append(name)
        else:
            short_names.append(name[:12])

    feature_configs = [
        ("fsa_2gram", "(a) The FSA API Function Calls (2-gram)"),
        ("syscall_4gram", "(b) System Calls (4-gram)"),
        ("fs_1gram", "(c) File System Activities (1-gram)"),
    ]

    fig, axes = plt.subplots(1, 3, figsize=(24, 8))

    for idx, (feat_key, title) in enumerate(feature_configs):
        npy_path = SIMILARITY_DIR / f"{feat_key}_distance.npy"
        if not npy_path.exists():
            print(f"[!] Missing {npy_path}")
            continue

        matrix = np.load(npy_path)
        ax = axes[idx]

        sns.heatmap(
            matrix,
            xticklabels=short_names,
            yticklabels=short_names,
            cmap="YlOrRd",
            vmin=0,
            vmax=1,
            square=True,
            linewidths=0.5,
            linecolor='white',
            cbar_kws={"shrink": 0.8},
            ax=ax,
        )

        ax.set_title(title, fontsize=12, fontweight='bold')
        ax.tick_params(axis='both', labelsize=7)
        plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
        plt.setp(ax.get_yticklabels(), rotation=0)

    plt.suptitle(
        "Figure 3: Similarity matrices of features used in local activity monitoring\n"
        "(darker marking = more differentiable)",
        fontsize=14, fontweight='bold', y=1.02,
    )
    plt.tight_layout()

    combined_path = OUTPUT_DIR / "figure3_heatmaps.png"
    plt.savefig(combined_path, dpi=150, bbox_inches='tight')
    print(f"[+] Combined heatmap saved to {combined_path}")

    for idx, (feat_key, title) in enumerate(feature_configs):
        npy_path = SIMILARITY_DIR / f"{feat_key}_distance.npy"
        if not npy_path.exists():
            continue

        matrix = np.load(npy_path)
        fig_single, ax_single = plt.subplots(figsize=(10, 8))

        sns.heatmap(
            matrix,
            xticklabels=short_names,
            yticklabels=short_names,
            cmap="YlOrRd",
            vmin=0,
            vmax=1,
            square=True,
            linewidths=0.5,
            linecolor='white',
            cbar_kws={"shrink": 0.8},
            ax=ax_single,
            annot=False,
        )

        ax_single.set_title(title, fontsize=14, fontweight='bold')
        ax_single.tick_params(axis='both', labelsize=9)
        plt.setp(ax_single.get_xticklabels(), rotation=45, ha='right')
        plt.setp(ax_single.get_yticklabels(), rotation=0)
        plt.tight_layout()

        single_path = OUTPUT_DIR / f"{feat_key}_heatmap.png"
        fig_single.savefig(single_path, dpi=150, bbox_inches='tight')
        plt.close(fig_single)
        print(f"[+] Individual heatmap saved to {single_path}")

    plt.close('all')
    print(f"\n[+] All heatmaps saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
