"""
AI Social Media Campaign Generator — Model Training
=====================================================
Project Stage   : STAGE 5 — Train the Model
Project Goal    : Generate post variations, captions, hashtags, and campaign
                  ideas for different target audiences.

What this script does (Stage 5):
  - Loads the preprocessed master dataset from Stage 3
  - Fine-tunes DistilBERT for 5-class tone classification
    (Casual / Humorous / Inspirational / Professional / Urgent)
  - Uses HuggingFace Trainer API with early stopping
  - Saves the trained model for Stage 6 evaluation

Tech used here:
  Training       — HuggingFace Transformers, Datasets, PyTorch
  Model          — distilbert-base-uncased
  Evaluation     — Scikit-learn accuracy_score, classification_report
  Data Handling  — Pandas, NumPy

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    python training/train.py
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from datasets import Dataset

# ── Paths ──────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC      = os.path.join(BASE, "data", "processed", "text")
MODEL_DIR = os.path.join(BASE, "data", "models")
EVAL_DIR  = os.path.join(BASE, "data", "evaluation")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(EVAL_DIR,  exist_ok=True)

# ── Hyper-parameters ───────────────────────────────────────────────
MODEL_NAME     = "distilbert-base-uncased"
LABEL_COLUMN   = "tone"
MAX_LENGTH     = 128
BATCH_SIZE     = 8
EPOCHS         = 3
LEARNING_RATE  = 2e-5
WEIGHT_DECAY   = 0.01

print("=" * 65)
print("  AI Social Media Campaign Generator — Model Training")
print(f"  Model: {MODEL_NAME}  |  Task: tone classification")
print("=" * 65)


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {"accuracy": accuracy_score(labels, preds)}


def main() -> None:
    # ── Load dataset ───────────────────────────────────────────────
    print("\n[1/5] Loading dataset...")
    data_path = os.path.join(PROC, "master_dataset_final.csv")
    if not os.path.exists(data_path):
        data_path = os.path.join(PROC, "master_dataset.csv")
    if not os.path.exists(data_path):
        print("❌ No dataset found. Run preprocess.py first.")
        return

    df = pd.read_csv(data_path, encoding="utf-8-sig")
    df = df.dropna(subset=["caption", LABEL_COLUMN])
    df = df[df["caption"].str.len() > 5]
    print(f"   ✓ {len(df)} rows loaded")

    # ── Encode labels ──────────────────────────────────────────────
    print("\n[2/5] Encoding labels...")
    le = LabelEncoder()
    df["label"] = le.fit_transform(df[LABEL_COLUMN].str.strip().str.title())
    print(f"   ✓ {len(le.classes_)} classes: {list(le.classes_)}")

    label_map = dict(zip(le.classes_.tolist(), le.transform(le.classes_).tolist()))
    with open(os.path.join(MODEL_DIR, "label_mapping.json"), "w") as f:
        json.dump(label_map, f, indent=2)

    # ── Train / test split ─────────────────────────────────────────
    print("\n[3/5] Train/test split (80/20)...")
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df["label"])
    print(f"   ✓ Train: {len(train_df)}  |  Test: {len(test_df)}")

    train_ds = Dataset.from_pandas(train_df[["caption", "label"]].reset_index(drop=True))
    test_ds  = Dataset.from_pandas(test_df[["caption",  "label"]].reset_index(drop=True))

    # ── Tokenise ───────────────────────────────────────────────────
    print(f"\n[4/5] Loading tokeniser: {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def tokenize(batch):
        return tokenizer(batch["caption"], padding="max_length", truncation=True, max_length=MAX_LENGTH)

    train_ds = train_ds.map(tokenize, batched=True).rename_column("label", "labels")
    test_ds  = test_ds.map(tokenize,  batched=True).rename_column("label", "labels")
    for ds in [train_ds, test_ds]:
        ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
    print("   ✓ Tokenisation complete")

    # ── Train ──────────────────────────────────────────────────────
    print("\n[5/5] Training model...")
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=len(le.classes_))

    args = TrainingArguments(
        output_dir                  = MODEL_DIR,
        num_train_epochs            = EPOCHS,
        per_device_train_batch_size = BATCH_SIZE,
        per_device_eval_batch_size  = BATCH_SIZE,
        learning_rate               = LEARNING_RATE,
        weight_decay                = WEIGHT_DECAY,
        evaluation_strategy         = "epoch",
        save_strategy               = "epoch",
        load_best_model_at_end      = True,
        metric_for_best_model       = "accuracy",
        logging_dir                 = os.path.join(EVAL_DIR, "logs"),
        logging_steps               = 50,
        report_to                   = "none",
    )

    trainer = Trainer(
        model           = model,
        args            = args,
        train_dataset   = train_ds,
        eval_dataset    = test_ds,
        compute_metrics = compute_metrics,
        callbacks       = [EarlyStoppingCallback(early_stopping_patience=2)],
    )
    trainer.train()

    # ── Save model ─────────────────────────────────────────────────
    save_path = os.path.join(MODEL_DIR, "tone_classifier")
    trainer.save_model(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"\n  ✓ Model saved → data/models/tone_classifier/")

    # ── Evaluate ───────────────────────────────────────────────────
    preds      = trainer.predict(test_ds)
    pred_labels = np.argmax(preds.predictions, axis=-1)
    true_labels = preds.label_ids
    acc         = accuracy_score(true_labels, pred_labels)
    report      = classification_report(true_labels, pred_labels, target_names=le.classes_, output_dict=True)

    results = {
        "model":                  MODEL_NAME,
        "task":                   f"Tone classification ({len(le.classes_)} classes)",
        "train_rows":             len(train_df),
        "test_rows":              len(test_df),
        "accuracy":               round(acc, 4),
        "classification_report":  report,
        "label_mapping":          label_map,
    }
    with open(os.path.join(EVAL_DIR, "training_results.json"), "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'=' * 65}")
    print(f"  TRAINING COMPLETE ✅  —  Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"  Saved: data/models/tone_classifier/")
    print(f"         data/evaluation/training_results.json")
    print("=" * 65)


if __name__ == "__main__":
    main()
