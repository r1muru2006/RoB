#!/usr/bin/env python3
"""
Train 4 ML classifiers with 10-fold stratified cross-validation.
Classifiers: Random Forest, KNN, Decision Tree, XGBoost.

Uses 5 features: entropy_change, size_change, entropy_modified,
chi2_uniformity, header_preserved.

Handles class imbalance via SMOTE oversampling on the training folds.
"""

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, recall_score, precision_score, f1_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder, StandardScaler
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

FEATURES_CSV = Path(__file__).resolve().parent.parent / "features" / "features.csv"
MODELS_DIR = Path(__file__).resolve().parent / "models"
FILE_TYPES = ["txt", "pdf", "docx", "xlsx", "jpeg"]

FEATURE_COLS = ["entropy_change", "size_change", "entropy_modified",
                "chi2_uniformity", "header_preserved"]

CLASSIFIERS = {
    "RF": lambda: RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=42),
    "KNN": lambda: KNeighborsClassifier(n_neighbors=5),
    "DT": lambda: DecisionTreeClassifier(class_weight="balanced", random_state=42),
    "XGB": lambda: XGBClassifier(n_estimators=200, random_state=42, eval_metric='logloss',
                                  verbosity=0, scale_pos_weight=50),
}


def evaluate_cv(clf_factory, X, y, n_splits=10):
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    metrics = {"acc": [], "recall": [], "prec": [], "f1": [], "tp": 0, "tn": 0, "fp": 0, "fn": 0}

    for train_idx, test_idx in skf.split(X, y):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        smote = SMOTE(random_state=42, k_neighbors=min(3, sum(y_train == 1) - 1))
        X_res, y_res = smote.fit_resample(X_train, y_train)

        scaler = StandardScaler()
        X_res = scaler.fit_transform(X_res)
        X_test_sc = scaler.transform(X_test)

        clf = clf_factory()
        clf.fit(X_res, y_res)
        y_pred = clf.predict(X_test_sc)

        metrics["acc"].append(accuracy_score(y_test, y_pred))
        metrics["recall"].append(recall_score(y_test, y_pred, zero_division=0))
        metrics["prec"].append(precision_score(y_test, y_pred, zero_division=0))
        metrics["f1"].append(f1_score(y_test, y_pred, zero_division=0))

        tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()
        metrics["tp"] += tp
        metrics["tn"] += tn
        metrics["fp"] += fp
        metrics["fn"] += fn

    return {
        "acc": np.mean(metrics["acc"]),
        "recall": np.mean(metrics["recall"]),
        "prec": np.mean(metrics["prec"]),
        "f1": np.mean(metrics["f1"]),
        "tp": metrics["tp"],
        "tn": metrics["tn"],
        "fp": metrics["fp"],
        "fn": metrics["fn"],
    }


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(FEATURES_CSV)

    le = LabelEncoder()
    df["label_enc"] = le.fit_transform(df["label"])

    print(f"Features used: {FEATURE_COLS}")
    print(f"Dataset: {len(df)} rows, benign={len(df[df.label=='benign'])}, malicious={len(df[df.label=='malicious'])}")
    print()
    print("=" * 90)
    print(f"{'Model':<8} {'Type':<8} {'Acc':>6} {'Recall':>8} {'Prec':>8} {'F1':>8} {'TP':>8} {'TN':>8} {'FN':>6} {'FP':>6}")
    print("=" * 90)

    best_models = {}

    for clf_name, clf_factory in CLASSIFIERS.items():
        for ft in FILE_TYPES:
            ft_df = df[df["file_type"] == ft]
            X = ft_df[FEATURE_COLS].values
            y = ft_df["label_enc"].values

            results = evaluate_cv(clf_factory, X, y)

            print(f"{clf_name:<8} {ft:<8} {results['acc']:>6.2f} {results['recall']:>8.2f} "
                  f"{results['prec']:>8.2f} {results['f1']:>8.2f} {results['tp']:>8} "
                  f"{results['tn']:>8} {results['fn']:>6} {results['fp']:>6}")

            key = (clf_name, ft)
            best_models[key] = results["f1"]

            smote = SMOTE(random_state=42, k_neighbors=min(3, sum(y == 1) - 1))
            X_res, y_res = smote.fit_resample(X, y)
            scaler = StandardScaler()
            X_res = scaler.fit_transform(X_res)

            final_clf = clf_factory()
            final_clf.fit(X_res, y_res)

            model_path = MODELS_DIR / f"{clf_name}_{ft}.joblib"
            scaler_path = MODELS_DIR / f"{clf_name}_{ft}_scaler.joblib"
            joblib.dump(final_clf, model_path)
            joblib.dump(scaler, scaler_path)

        print("-" * 90)

    print("\n[+] All models saved to", MODELS_DIR)

    print("\n[+] Best classifier per file type:")
    for ft in FILE_TYPES:
        best_clf = max(CLASSIFIERS.keys(), key=lambda c: best_models.get((c, ft), 0))
        print(f"    {ft}: {best_clf} (F1={best_models[(best_clf, ft)]:.4f})")


if __name__ == "__main__":
    main()
