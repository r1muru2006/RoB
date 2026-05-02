#!/usr/bin/env python3
"""
Evaluate saved models and print a Table 3-style performance summary.
Uses the same SMOTE + scaling pipeline as training for fair CV evaluation.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, recall_score, precision_score, f1_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder, StandardScaler
from imblearn.over_sampling import SMOTE

FEATURES_CSV = Path(__file__).resolve().parent.parent / "features" / "features.csv"
MODELS_DIR = Path(__file__).resolve().parent / "models"
FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]
CLASSIFIER_NAMES = ["RF", "KNN", "DT", "XGB"]

FEATURE_COLS = ["entropy_change", "size_change", "entropy_modified",
                "chi2_uniformity", "header_preserved"]

CLF_FACTORIES = {
    "RF": lambda: __import__('sklearn.ensemble', fromlist=['RandomForestClassifier']).RandomForestClassifier(
        n_estimators=200, class_weight="balanced", random_state=42),
    "KNN": lambda: __import__('sklearn.neighbors', fromlist=['KNeighborsClassifier']).KNeighborsClassifier(n_neighbors=5),
    "DT": lambda: __import__('sklearn.tree', fromlist=['DecisionTreeClassifier']).DecisionTreeClassifier(
        class_weight="balanced", random_state=42),
    "XGB": lambda: __import__('xgboost', fromlist=['XGBClassifier']).XGBClassifier(
        n_estimators=200, random_state=42, eval_metric='logloss', verbosity=0, scale_pos_weight=50),
}


def evaluate_cv(clf_factory, X, y, n_splits=10):
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    all_y_true = []
    all_y_pred = []

    for train_idx, test_idx in skf.split(X, y):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        k = min(3, sum(y_train == 1) - 1)
        if k >= 1:
            smote = SMOTE(random_state=42, k_neighbors=k)
            X_res, y_res = smote.fit_resample(X_train, y_train)
        else:
            X_res, y_res = X_train, y_train

        scaler = StandardScaler()
        X_res = scaler.fit_transform(X_res)
        X_test_sc = scaler.transform(X_test)

        clf = clf_factory()
        clf.fit(X_res, y_res)
        preds = clf.predict(X_test_sc)
        all_y_true.extend(y_test)
        all_y_pred.extend(preds)

    all_y_true = np.array(all_y_true)
    all_y_pred = np.array(all_y_pred)

    acc = accuracy_score(all_y_true, all_y_pred)
    rec = recall_score(all_y_true, all_y_pred, zero_division=0)
    prec = precision_score(all_y_true, all_y_pred, zero_division=0)
    f1 = f1_score(all_y_true, all_y_pred, zero_division=0)
    tn, fp, fn, tp = confusion_matrix(all_y_true, all_y_pred, labels=[0, 1]).ravel()

    return {"acc": acc, "recall": rec, "prec": prec, "f1": f1,
            "tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn)}


def main():
    df = pd.read_csv(FEATURES_CSV)
    le = LabelEncoder()
    df["label_enc"] = le.fit_transform(df["label"])

    print(f"\nFeatures: {FEATURE_COLS}")
    print(f"Dataset: {len(df)} rows, benign={len(df[df.label=='benign'])}, malicious={len(df[df.label=='malicious'])}")

    print("\n" + "=" * 95)
    print("Table 3: Performance evaluation of different ML algorithms (10-fold CV)")
    print("=" * 95)
    print(f"{'Model':<8} {'Type':<8} {'Acc':>6} {'Recall':>8} {'Prec':>8} {'F1':>8} {'TP':>8} {'TN':>8} {'FN':>6} {'FP':>6}")
    print("-" * 95)

    for clf_name in CLASSIFIER_NAMES:
        clf_factory = CLF_FACTORIES[clf_name]
        for ft in FILE_TYPES:
            ft_df = df[df["file_type"] == ft]
            X = ft_df[FEATURE_COLS].values
            y = ft_df["label_enc"].values

            r = evaluate_cv(clf_factory, X, y)

            print(f"{clf_name:<8} {ft:<8} {r['acc']:>6.2f} {r['recall']:>8.2f} {r['prec']:>8.2f} {r['f1']:>8.2f} "
                  f"{r['tp']:>8} {r['tn']:>8} {r['fn']:>6} {r['fp']:>6}")

        print("-" * 95)

    print("\n[+] Combined evaluation (all file types together):")
    print(f"{'Model':<8} {'Acc':>6} {'Recall':>8} {'Prec':>8} {'F1':>8} {'TP':>8} {'TN':>8} {'FN':>6} {'FP':>6}")
    print("-" * 80)

    X_all = df[FEATURE_COLS].values
    y_all = df["label_enc"].values

    for clf_name in CLASSIFIER_NAMES:
        r = evaluate_cv(CLF_FACTORIES[clf_name], X_all, y_all)
        print(f"{clf_name:<8} {r['acc']:>6.2f} {r['recall']:>8.2f} {r['prec']:>8.2f} {r['f1']:>8.2f} "
              f"{r['tp']:>8} {r['tn']:>8} {r['fn']:>6} {r['fp']:>6}")


if __name__ == "__main__":
    main()
