#!/usr/bin/env python3
"""
Test classifiers against evasion techniques.
Matches paper Table 5 format — evaluation against adaptive attackers.

For each evasion technique, uses saved models + scalers and selects the best
classifier per file type. Reports Accuracy, Recall, Precision, F1, TP, TN, FN, FP.
"""

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

FEATURES_CSV = Path(__file__).resolve().parent.parent / "features" / "features.csv"
EVASION_CSV = Path(__file__).resolve().parent / "evasion_features.csv"
MODELS_DIR = Path(__file__).resolve().parent.parent / "classifier" / "models"

FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]
CLASSIFIER_NAMES = ["RF", "KNN", "DT", "XGB"]

FEATURE_COLS = ["entropy_change", "size_change", "entropy_modified",
                "chi2_uniformity", "header_preserved"]

TECHNIQUE_DISPLAY = {
    "partial_encryption": "Partial Encryption",
    "low_entropy_padding": "Low-entropy Data Padding",
    "encoding_base64": "Post-encryption Encoding (Base64)",
    "encoding_base32": "Post-encryption Encoding (Base32)",
    "encoding_hex": "Post-encryption Encoding (Hexadecimal)",
    "custom_evasion": "Custom Evasion",
}


def main():
    train_df = pd.read_csv(FEATURES_CSV)
    evasion_df = pd.read_csv(EVASION_CSV)

    le = LabelEncoder()
    le.fit(["benign", "malicious"])
    train_df["label_enc"] = le.transform(train_df["label"])

    print("\n" + "=" * 110)
    print("Table 5: Evaluation against adaptive attackers")
    print("=" * 110)
    print(f"{'Technique':<38} {'Type':<8} {'Best':<6} {'Acc':>6} {'Recall':>8} {'Prec':>8} "
          f"{'F1':>8} {'TP':>6} {'TN':>6} {'FN':>6} {'FP':>6}")
    print("-" * 110)

    techniques = evasion_df["technique"].unique()

    for tech in techniques:
        tech_display = TECHNIQUE_DISPLAY.get(tech, tech)

        for ft in FILE_TYPES:
            train_ft = train_df[train_df["file_type"] == ft]

            ev_ft = evasion_df[(evasion_df["technique"] == tech) & (evasion_df["file_type"] == ft)]
            X_evasion = ev_ft[FEATURE_COLS].values

            benign_test = train_ft[train_ft["label"] == "benign"].sample(
                n=min(len(ev_ft), len(train_ft[train_ft["label"] == "benign"])),
                random_state=42
            )
            X_benign = benign_test[FEATURE_COLS].values
            X_test = np.vstack([X_benign, X_evasion])
            y_test = np.array([0] * len(benign_test) + [1] * len(ev_ft))

            best_f1 = -1
            best_result = None
            best_clf_name = None

            for clf_name in CLASSIFIER_NAMES:
                model_path = MODELS_DIR / f"{clf_name}_{ft}.joblib"
                scaler_path = MODELS_DIR / f"{clf_name}_{ft}_scaler.joblib"
                if not model_path.exists() or not scaler_path.exists():
                    continue

                clf = joblib.load(model_path)
                scaler = joblib.load(scaler_path)
                X_test_sc = scaler.transform(X_test)
                y_pred = clf.predict(X_test_sc)

                tp = int(np.sum((y_test == 1) & (y_pred == 1)))
                tn = int(np.sum((y_test == 0) & (y_pred == 0)))
                fp = int(np.sum((y_test == 0) & (y_pred == 1)))
                fn = int(np.sum((y_test == 1) & (y_pred == 0)))

                total = tp + tn + fp + fn
                acc = (tp + tn) / total if total > 0 else 0
                rec = tp / (tp + fn) if (tp + fn) > 0 else 0
                prec = tp / (tp + fp) if (tp + fp) > 0 else 0
                f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0

                if f1 > best_f1:
                    best_f1 = f1
                    best_clf_name = clf_name
                    best_result = {
                        "acc": acc, "recall": rec, "prec": prec, "f1": f1,
                        "tp": tp, "tn": tn, "fn": fn, "fp": fp
                    }

            if best_result:
                r = best_result
                print(f"{tech_display:<38} {ft:<8} {best_clf_name:<6} {r['acc']:>6.2f} {r['recall']:>8.2f} "
                      f"{r['prec']:>8.2f} {r['f1']:>8.2f} {r['tp']:>6} {r['tn']:>6} "
                      f"{r['fn']:>6} {r['fp']:>6}")

        print("-" * 110)

    print("\n[+] Note: Best classifier per file type selected automatically (as in paper Appendix D)")


if __name__ == "__main__":
    main()
