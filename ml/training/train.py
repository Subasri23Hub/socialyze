"""
Socialyze — Model Training
===========================
Project Stage   : STAGE 5 — Train the Model
Project Goal    : Fine-tune DistilBERT for 5-class tone classification.
                  Target: 90%+ accuracy via data augmentation + class balancing.

Tech used:
  Training       — HuggingFace Transformers, Datasets, PyTorch
  Model          — distilbert-base-uncased
  Evaluation     — Scikit-learn accuracy_score, classification_report
  Data Handling  — Pandas, NumPy

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    python ml/training/train.py
"""

import os
import json
import random
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
from sklearn.utils import resample

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    DataCollatorWithPadding,
)
from datasets import Dataset

# ── Reproducibility ────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

# ── Paths ──────────────────────────────────────────────────────────
# ml/training/train.py → go up 3 levels to reach project root
BASE      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROC      = os.path.join(BASE, "data", "processed", "text")
MODEL_DIR = os.path.join(BASE, "data", "models")
EVAL_DIR  = os.path.join(BASE, "data", "evaluation")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(EVAL_DIR,  exist_ok=True)

# ── Hyperparameters ────────────────────────────────────────────────
MODEL_NAME    = "distilbert-base-uncased"
LABEL_COLUMN  = "tone"
MAX_LENGTH    = 128
BATCH_SIZE    = 16
EPOCHS        = 5
LEARNING_RATE = 3e-5
WEIGHT_DECAY  = 0.01
WARMUP_RATIO  = 0.1

# Fixed tone list — plain Python strings, always same order
VALID_TONES = ["Casual", "Humorous", "Inspirational", "Professional", "Urgent"]

print("=" * 65)
print("  Socialyze — Model Training (Target: 90%+ Accuracy)")
print(f"  Model : {MODEL_NAME}")
print(f"  Task  : 5-class tone classification")
print("=" * 65)


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {"accuracy": float(accuracy_score(labels, preds))}


def augment_caption(text: str) -> str:
    """Word-dropout: randomly drops ~10% of words."""
    words = str(text).split()
    if len(words) <= 4:
        return text
    kept = [w for w in words if random.random() > 0.10]
    return " ".join(kept) if kept else text


def balance_and_augment(df: pd.DataFrame, target_per_class: int = 600) -> pd.DataFrame:
    """Oversample minority classes + augment so every class = target_per_class rows."""
    frames = []
    for tone in VALID_TONES:
        subset = df[df[LABEL_COLUMN] == tone].copy().reset_index(drop=True)
        if len(subset) == 0:
            print(f"   ⚠️  No rows for tone: {tone} — skipping")
            continue
        if len(subset) >= target_per_class:
            frames.append(subset.sample(target_per_class, random_state=SEED))
        else:
            oversampled = resample(
                subset, replace=True,
                n_samples=target_per_class, random_state=SEED
            ).reset_index(drop=True)
            for i in range(len(subset), len(oversampled)):
                oversampled.at[i, "caption"] = augment_caption(oversampled.at[i, "caption"])
            frames.append(oversampled)

    balanced = pd.concat(frames, ignore_index=True).sample(frac=1, random_state=SEED)
    print(f"   ✓ Balanced dataset: {len(balanced)} rows  "
          f"({target_per_class} per class × {len(frames)} classes)")
    return balanced.reset_index(drop=True)


def main():

    print("\n[1/6] Loading datasets...")
    frames = []

    for fname in ["master_dataset_final.csv", "master_dataset.csv"]:
        fpath = os.path.join(PROC, fname)
        if os.path.exists(fpath):
            tmp = pd.read_csv(fpath, encoding="utf-8-sig")
            frames.append(tmp)
            print(f"   ✓ {fname} — {len(tmp)} rows")
            break

    for fname, label in [
        ("gemini_synthetic_posts.csv", "gemini_synthetic_posts.csv"),
        ("posts_cleaned.csv",          "posts_cleaned.csv"),
    ]:
        fpath = os.path.join(PROC, fname)
        if os.path.exists(fpath):
            tmp = pd.read_csv(fpath, encoding="utf-8-sig")
            frames.append(tmp)
            print(f"   ✓ {label} — {len(tmp)} rows")

    if not frames:
        print("❌ No data found. Run preprocess.py first.")
        return

    df = pd.concat(frames, ignore_index=True)

    print("\n[2/6] Cleaning data...")
    df = df.dropna(subset=["caption", LABEL_COLUMN])
    df["caption"]    = df["caption"].astype(str).str.strip()
    df[LABEL_COLUMN] = df[LABEL_COLUMN].astype(str).str.strip().str.title()
    df               = df[df["caption"].str.len() > 5]
    df               = df[df[LABEL_COLUMN].isin(VALID_TONES)]
    df               = df.drop_duplicates(subset=["caption"])
    df               = df.reset_index(drop=True)

    print(f"   ✓ {len(df)} clean rows")
    print(f"   Class distribution:")
    for tone in VALID_TONES:
        print(f"     {tone:<16}: {len(df[df[LABEL_COLUMN] == tone])}")

    print("\n[3/6] Balancing classes + augmenting...")
    df = balance_and_augment(df, target_per_class=600)

    print("\n[4/6] Encoding labels...")
    label2id = {tone: idx for idx, tone in enumerate(VALID_TONES)}
    id2label = {idx: tone for tone, idx in label2id.items()}
    df["label"] = df[LABEL_COLUMN].map(label2id).astype(int)
    print(f"   ✓ Classes: {VALID_TONES}")

    with open(os.path.join(MODEL_DIR, "label_mapping.json"), "w") as f:
        json.dump(label2id, f, indent=2)
    print(f"   ✓ label_mapping.json saved")

    print("\n[5/6] Tokenising...")
    train_df, test_df = train_test_split(
        df, test_size=0.15, random_state=SEED, stratify=df["label"]
    )
    train_df = train_df.reset_index(drop=True)
    test_df  = test_df.reset_index(drop=True)
    print(f"   ✓ Train: {len(train_df)}  |  Test: {len(test_df)}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def tokenize(batch):
        return tokenizer(batch["caption"], truncation=True, max_length=MAX_LENGTH)

    train_ds = Dataset.from_pandas(train_df[["caption", "label"]])
    test_ds  = Dataset.from_pandas(test_df[["caption",  "label"]])

    train_ds = train_ds.map(tokenize, batched=True, remove_columns=["caption"])
    test_ds  = test_ds.map(tokenize,  batched=True, remove_columns=["caption"])

    train_ds = train_ds.rename_column("label", "labels")
    test_ds  = test_ds.rename_column("label",  "labels")

    train_ds.set_format("torch")
    test_ds.set_format("torch")

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
    print("   ✓ Tokenisation complete")

    print("\n[6/6] Training DistilBERT...")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(VALID_TONES),
        id2label=id2label,
        label2id=label2id,
        ignore_mismatched_sizes=True,
    )

    total_steps  = (len(train_ds) // BATCH_SIZE) * EPOCHS
    warmup_steps = int(total_steps * WARMUP_RATIO)

    args = TrainingArguments(
        output_dir                  = MODEL_DIR,
        num_train_epochs            = EPOCHS,
        per_device_train_batch_size = BATCH_SIZE,
        per_device_eval_batch_size  = BATCH_SIZE,
        learning_rate               = LEARNING_RATE,
        weight_decay                = WEIGHT_DECAY,
        warmup_steps                = warmup_steps,
        eval_strategy               = "steps",
        save_strategy               = "steps",
        eval_steps                  = 100,
        save_steps                  = 100,
        logging_steps               = 50,
        load_best_model_at_end      = True,
        metric_for_best_model       = "accuracy",
        greater_is_better           = True,
        report_to                   = "none",
        fp16                        = torch.cuda.is_available(),
        dataloader_num_workers      = 0,
    )

    trainer = Trainer(
        model           = model,
        args            = args,
        train_dataset   = train_ds,
        eval_dataset    = test_ds,
        data_collator   = data_collator,
        compute_metrics = compute_metrics,
        callbacks       = [EarlyStoppingCallback(early_stopping_patience=3)],
    )

    trainer.train()

    save_path = os.path.join(MODEL_DIR, "tone_classifier")
    trainer.save_model(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"\n   ✓ Model saved → {save_path}")

    preds       = trainer.predict(test_ds)
    pred_labels = np.argmax(preds.predictions, axis=-1)
    true_labels = preds.label_ids

    acc    = accuracy_score(true_labels, pred_labels)
    report = classification_report(
        true_labels, pred_labels,
        target_names=VALID_TONES,
        output_dict=True,
    )

    results = {
        "model"    : MODEL_NAME,
        "task"     : "Tone classification (5 classes)",
        "accuracy" : round(float(acc), 4),
        "report"   : report,
        "labels"   : label2id,
    }
    with open(os.path.join(EVAL_DIR, "training_results.json"), "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 65)
    print(f"  TRAINING COMPLETE ✅  |  Accuracy: {acc:.4f}  ({acc*100:.2f}%)")
    if acc >= 0.90:
        print("  🎯 TARGET ACHIEVED — 90%+ accuracy!")
    else:
        print(f"  ⚡ Current: {acc*100:.2f}% — run evaluate.py for full report")
    print("=" * 65)


if __name__ == "__main__":
    main()
