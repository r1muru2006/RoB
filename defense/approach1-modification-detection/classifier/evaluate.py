#!/usr/bin/env python3
"""
Evaluate saved models and print a Table 3-style performance summary.
Also generates a combined evaluation across all file types.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, recall_score, precision_score, f1_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder

FEATURES_CSV = Path(__file__).resolve().parent.parent / "features" / "features.csv"
MODELS_DIR = Path(__file__).resolve().parent / "models"
FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]
CLASSIFIER_NAMES = ["RF", "KNN", "DT", "XGB"]


def main():
    df = pd.read_csv(FEATURES_CSV)
    le = LabelEncoder()
    df["label_enc"] = le.fit_transform(df["label"])

    print("\n" + "=" * 95)
    print("Table 3: Performance evaluation of different ML algorithms (10-fold CV)")
    print("=" * 95)
    print(f"{'Model':<8} {'Type':<8} {'Acc':>6} {'Recall':>8} {'Prec':>8} {'F1':>8} {'TP':>8} {'TN':>8} {'FN':>6} {'FP':>6}")
    print("-" * 95)

    for clf_name in CLASSIFIER_NAMES:
        for ft in FILE_TYPES:
            model_path = MODELS_DIR / f"{clf_name}_{ft}.joblib"
            if not model_path.exists():
                print(f"{clf_name:<8} {ft:<8} MODEL NOT FOUND")
                continue

            ft_df = df[df["file_type"] == ft]
            X = ft_df[["entropy_change", "size_change"]].values
            y = ft_df["label_enc"].values

            skf = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
            all_y_true = []
            all_y_pred = []

            clf_class = joblib.load(model_path).__class__

            for train_idx, test_idx in skf.split(X, y):
                clf = clf_class() if clf_name != "XGB" else clf_class(eval_metric='logloss', verbosity=0)
                clf.fit(X[train_idx], y[train_idx])
                preds = clf.predict(X[test_idx])
                all_y_true.extend(y[test_idx])
                all_y_pred.extend(preds)

            all_y_true = np.array(all_y_true)
            all_y_pred = np.array(all_y_pred)

            acc = accuracy_score(all_y_true, all_y_pred)
            rec = recall_score(all_y_true, all_y_pred, zero_division=0)
            prec = precision_score(all_y_true, all_y_pred, zero_division=0)
            f1 = f1_score(all_y_true, all_y_pred, zero_division=0)
            tn, fp, fn, tp = confusion_matrix(all_y_true, all_y_pred, labels=[0, 1]).ravel()

            print(f"{clf_name:<8} {ft:<8} {acc:>6.2f} {rec:>8.2f} {prec:>8.2f} {f1:>8.2f} "
                  f"{tp:>8} {tn:>8} {fn:>6} {fp:>6}")

        print("-" * 95)

    print("\n[+] Combined evaluation (all file types together):")
    print(f"{'Model':<8} {'Acc':>6} {'Recall':>8} {'Prec':>8} {'F1':>8} {'TP':>8} {'TN':>8} {'FN':>6} {'FP':>6}")
    print("-" * 80)

    X_all = df[["entropy_change", "size_change"]].values
    y_all = df["label_enc"].values

    for clf_name in CLASSIFIER_NAMES:
        model_path = MODELS_DIR / f"{clf_name}_{FILE_TYPES[0]}.joblib"
        if not model_path.exists():
            continue

        clf_class = joblib.load(model_path).__class__
        skf = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
        all_y_true = []
        all_y_pred = []

        for train_idx, test_idx in skf.split(X_all, y_all):
            clf = clf_class() if clf_name != "XGB" else clf_class(eval_metric='logloss', verbosity=0)
            clf.fit(X_all[train_idx], y_all[train_idx])
            preds = clf.predict(X_all[test_idx])
            all_y_true.extend(y_all[test_idx])
            all_y_pred.extend(preds)

        all_y_true = np.array(all_y_true)
        all_y_pred = np.array(all_y_pred)

        acc = accuracy_score(all_y_true, all_y_pred)
        rec = recall_score(all_y_true, all_y_pred, zero_division=0)
        prec = precision_score(all_y_true, all_y_pred, zero_division=0)
        f1 = f1_score(all_y_true, all_y_pred, zero_division=0)
        tn, fp, fn, tp = confusion_matrix(all_y_true, all_y_pred, labels=[0, 1]).ravel()

        print(f"{clf_name:<8} {acc:>6.2f} {rec:>8.2f} {prec:>8.2f} {f1:>8.2f} "
              f"{tp:>8} {tn:>8} {fn:>6} {fp:>6}")


if __name__ == "__main__":
    main()
