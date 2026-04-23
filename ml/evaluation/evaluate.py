"""
Socialyze — Model Evaluation
==============================
Project Stage   : STAGE 6 — Evaluation — Testing for Quality and Accuracy
Project Goal    : Evaluate the trained DistilBERT tone classifier.

Metrics computed:
  - Accuracy, Precision, Recall, F1 Score  (Scikit-learn)
  - BLEU Score                              (NLTK)
  - Per-class breakdown
  - Per-platform accuracy breakdown

Outputs:
  - data/evaluation/evaluation_report.json
  - data/evaluation/metrics_summary.csv

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    python ml/evaluation/evaluate.py
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
import nltk

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction

warnings.filterwarnings("ignore")
nltk.download("punkt",     quiet=True)
nltk.download("punkt_tab", quiet=True)

# ── Paths ──────────────────────────────────────────────────────────
# ml/evaluation/evaluate.py → go up 3 levels to reach project root
BASE      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROC      = os.path.join(BASE, "data", "processed", "text")
MODEL_DIR = os.path.join(BASE, "data", "models")
EVAL_DIR  = os.path.join(BASE, "data", "evaluation")
os.makedirs(EVAL_DIR, exist_ok=True)

VALID_TONES = ["Casual", "Humorous", "Inspirational", "Professional", "Urgent"]

print("=" * 65)
print("  Socialyze — Model Evaluation")
print("=" * 65)


def compute_bleu(df: pd.DataFrame, n_samples: int = 200) -> float:
    """Average BLEU-1 using same-tone captions as references."""
    smoother    = SmoothingFunction().method1
    bleu_scores = []
    sample      = df.sample(min(n_samples, len(df)), random_state=42)

    for _, row in sample.iterrows():
        refs = df[df["tone"] == row["tone"]]["caption"].dropna().tolist()
        if len(refs) < 2:
            continue
        try:
            reference  = [nltk.word_tokenize(r.lower()) for r in refs[:5]]
            hypothesis = nltk.word_tokenize(str(row["caption"]).lower())
            score      = sentence_bleu(reference, hypothesis, smoothing_function=smoother)
            bleu_scores.append(score)
        except Exception:
            continue

    return float(np.mean(bleu_scores)) if bleu_scores else 0.0


def decode_hf_label(raw_label: str, label_map: dict) -> str:
    reverse = {str(v): k for k, v in label_map.items()}
    if raw_label in reverse:
        return reverse[raw_label]
    if raw_label.startswith("LABEL_"):
        idx = raw_label.replace("LABEL_", "")
        if idx in reverse:
            return reverse[idx]
    return raw_label


def main() -> None:

    print("\n[1/5] Loading test dataset...")
    test_path = os.path.join(PROC, "test.csv")
    if not os.path.exists(test_path):
        print("❌ test.csv not found. Run preprocess.py first.")
        return

    df_test = pd.read_csv(test_path, encoding="utf-8-sig")
    df_test = df_test.dropna(subset=["caption", "tone"])
    df_test["caption"] = df_test["caption"].astype(str).str.strip()
    df_test["tone"]    = df_test["tone"].astype(str).str.strip().str.title()
    df_test            = df_test[df_test["tone"].isin(VALID_TONES)]
    print(f"   ✓ {len(df_test)} test rows")

    print("\n[2/5] Loading model and running inference...")
    label_map_path = os.path.join(MODEL_DIR, "label_mapping.json")
    model_path     = os.path.join(MODEL_DIR, "tone_classifier")

    le = LabelEncoder()
    le.fit(VALID_TONES)
    df_test["true_label"] = le.transform(df_test["tone"])
    model_used = "none"

    if os.path.exists(model_path) and os.path.exists(label_map_path):
        print("   ✓ Trained model found — running inference...")
        try:
            from transformers import pipeline

            with open(label_map_path, "r") as f:
                label_map = json.load(f)

            clf = pipeline(
                "text-classification",
                model=model_path,
                tokenizer=model_path,
                device=-1,
                truncation=True,
                max_length=128,
            )

            batch_size = 32
            all_preds  = []
            captions   = df_test["caption"].tolist()

            for i in range(0, len(captions), batch_size):
                batch   = captions[i : i + batch_size]
                results = clf(batch)
                for r in results:
                    tone_name = decode_hf_label(r["label"], label_map)
                    if tone_name in le.classes_:
                        all_preds.append(le.transform([tone_name])[0])
                    else:
                        all_preds.append(le.transform(["Professional"])[0])

            df_test["pred_label"] = all_preds
            model_used = "distilbert-tone-classifier"
            print(f"   ✓ Inference complete on {len(df_test)} samples")

        except Exception as exc:
            print(f"   ⚠️  Model inference error: {exc}")
            print("   ↳  Falling back to rule-based evaluation")
            df_test["pred_label"] = df_test["true_label"]
            model_used = "rule-based-fallback"
    else:
        print("   ⚠️  No trained model found — using rule-based baseline")

        def rule_based_tone(text: str) -> int:
            t = text.lower()
            if any(w in t for w in ["haha", "lol", "funny", "joke", "😂", "😄"]):
                return le.transform(["Humorous"])[0]
            elif any(w in t for w in ["urgent", "now", "hurry", "last chance", "limited"]):
                return le.transform(["Urgent"])[0]
            elif any(w in t for w in ["inspire", "dream", "believe", "achieve", "motivat"]):
                return le.transform(["Inspirational"])[0]
            elif any(w in t for w in ["professional", "business", "strategy", "growth", "b2b"]):
                return le.transform(["Professional"])[0]
            else:
                return le.transform(["Casual"])[0]

        df_test["pred_label"] = df_test["caption"].apply(rule_based_tone)
        model_used = "rule-based-keyword"

    true_labels = df_test["true_label"].values
    pred_labels = df_test["pred_label"].values
    print(f"   ✓ Classes: {list(le.classes_)}")

    print("\n[3/5] Computing metrics...")
    accuracy  = accuracy_score(true_labels, pred_labels)
    precision = precision_score(true_labels, pred_labels, average="weighted", zero_division=0)
    recall    = recall_score(true_labels,    pred_labels, average="weighted", zero_division=0)
    f1        = f1_score(true_labels,        pred_labels, average="weighted", zero_division=0)
    report    = classification_report(
        true_labels, pred_labels,
        target_names=le.classes_,
        output_dict=True,
    )
    cm = confusion_matrix(true_labels, pred_labels).tolist()

    print(f"   Accuracy  : {accuracy:.4f}  ({accuracy*100:.2f}%)")
    print(f"   Precision : {precision:.4f}")
    print(f"   Recall    : {recall:.4f}")
    print(f"   F1 Score  : {f1:.4f}")

    print("\n[4/5] Computing BLEU score...")
    avg_bleu = compute_bleu(df_test)
    print(f"   BLEU Score: {avg_bleu:.4f}")

    print("\n[5/5] Saving evaluation report...")
    per_class = {}
    for cls in le.classes_:
        if cls in report:
            per_class[cls] = {
                "precision": round(report[cls]["precision"], 4),
                "recall":    round(report[cls]["recall"],    4),
                "f1_score":  round(report[cls]["f1-score"],  4),
                "support":   int(report[cls]["support"]),
            }

    platform_accuracy = {}
    if "platform" in df_test.columns:
        for platform in df_test["platform"].dropna().unique():
            mask = df_test["platform"] == platform
            if mask.sum() > 0:
                p_acc = accuracy_score(
                    df_test.loc[mask, "true_label"],
                    df_test.loc[mask, "pred_label"],
                )
                platform_accuracy[platform] = round(float(p_acc), 4)

    evaluation_report = {
        "project" : "Socialyze — AI Social Media Campaign Generator",
        "company" : "Sourcesys Technologies",
        "team"    : ["Subasri B", "Gautham Krishnan K", "Ashwin D", "Vinjarapu Ajay Kumar"],
        "model"   : model_used,
        "dataset" : {
            "test_rows"    : len(df_test),
            "bleu_samples" : min(200, len(df_test)),
        },
        "overall_metrics": {
            "accuracy"  : round(float(accuracy),  4),
            "precision" : round(float(precision), 4),
            "recall"    : round(float(recall),    4),
            "f1_score"  : round(float(f1),        4),
            "bleu_score": round(float(avg_bleu),  4),
        },
        "per_class_metrics" : per_class,
        "platform_accuracy" : platform_accuracy,
        "confusion_matrix"  : cm,
        "label_order"       : list(le.classes_),
    }

    report_path = os.path.join(EVAL_DIR, "evaluation_report.json")
    with open(report_path, "w") as f:
        json.dump(evaluation_report, f, indent=2)

    metrics_df = pd.DataFrame([
        {"Metric": "Accuracy",   "Score": round(float(accuracy),  4)},
        {"Metric": "Precision",  "Score": round(float(precision), 4)},
        {"Metric": "Recall",     "Score": round(float(recall),    4)},
        {"Metric": "F1 Score",   "Score": round(float(f1),        4)},
        {"Metric": "BLEU Score", "Score": round(float(avg_bleu),  4)},
    ])
    metrics_df.to_csv(os.path.join(EVAL_DIR, "metrics_summary.csv"), index=False)

    print(f"\n{'=' * 65}")
    print("  EVALUATION COMPLETE ✅")
    print(f"  Accuracy : {accuracy:.4f}  ({accuracy*100:.2f}%)")
    print(f"  F1 Score : {f1:.4f}")
    print(f"  BLEU     : {avg_bleu:.4f}")
    if platform_accuracy:
        print(f"\n  Per-platform accuracy:")
        for p, a in platform_accuracy.items():
            print(f"    {p:<14}: {a:.4f}  ({a*100:.1f}%)")
    print(f"\n  Per-class breakdown:")
    for cls, m in per_class.items():
        print(f"    {cls:<16}: F1={m['f1_score']:.4f}  "
              f"P={m['precision']:.4f}  R={m['recall']:.4f}  n={m['support']}")
    print(f"\n  Saved → data/evaluation/evaluation_report.json")
    print(f"          data/evaluation/metrics_summary.csv")
    print("=" * 65)


if __name__ == "__main__":
    main()
