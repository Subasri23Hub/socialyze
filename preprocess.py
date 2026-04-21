"""
AI Social Media Campaign Generator — Data Preprocessing
=========================================================
Project Stage   : STAGE 3 — Data Preprocessing
Project Goal    : Generate post variations, captions, hashtags, and campaign
                  ideas for different target audiences.

What this script does (Stage 3):
  - Loads raw Kaggle + manual datasets collected in Stage 2
  - Cleans, tokenises and structures text data using Pandas, NumPy, NLTK
  - Encodes categorical labels (tone, platform, audience) with Scikit-learn
  - Produces 80/20 train/test splits ready for Stage 5 model training
  - Saves hashtag maps and label mappings for Stage 4 (LLM prompting) and
    Stage 6 (evaluation)

Tech used here:
  Data Handling  — Pandas, NumPy
  NLP            — NLTK (tokenisation, stopwords)
  Encoding       — Scikit-learn LabelEncoder, train_test_split

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    python preprocess.py
"""

import os
import re
import json
import pandas as pd
import numpy as np
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# ── NLTK resources ─────────────────────────────────────────────────
nltk.download("punkt",     quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)

# ── Paths ──────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
RAW       = os.path.join(BASE, "data", "raw",       "text")
PROCESSED = os.path.join(BASE, "data", "processed", "text")
os.makedirs(RAW,       exist_ok=True)
os.makedirs(PROCESSED, exist_ok=True)

COLS = ["caption", "tone", "platform", "audience", "hashtags", "topic", "cta", "engagement_label"]

# ── Helpers ────────────────────────────────────────────────────────

def _engagement_label(score: float) -> str:
    if score >= 200: return "high"
    if score >= 50:  return "medium"
    return "low"


def _add_missing_cols(df: pd.DataFrame, defaults: dict) -> pd.DataFrame:
    for col, val in defaults.items():
        if col not in df.columns:
            df[col] = val
    return df


def _save_csv(df: pd.DataFrame, filename: str) -> None:
    path = os.path.join(PROCESSED, filename)
    df.to_csv(path, index=False, encoding="utf-8-sig", errors="replace")
    print(f"   ✓ {filename}  ({len(df)} rows)")


# ══════════════════════════════════════════════════════════════════
# LOADERS
# ══════════════════════════════════════════════════════════════════

def load_enriched_posts() -> pd.DataFrame:
    """Kaggle 1 — enriched_posts.json (LinkedIn professional posts)."""
    path = os.path.join(RAW, "enriched_posts.json")
    if not os.path.exists(path):
        print("   ⚠️  enriched_posts.json not found — skipping")
        return pd.DataFrame()

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        raw_text = f.read()
    raw_text = raw_text.encode("utf-8", errors="replace").decode("utf-8", errors="replace")
    df = pd.DataFrame(json.loads(raw_text))

    df = df[df["language"] == "English"].copy()
    df["tags"] = df["tags"].apply(lambda x: ", ".join(x) if isinstance(x, list) else str(x))
    df["tone"] = df["tone"].str.strip().str.title()
    df = df.rename(columns={"text": "caption", "tags": "topic"})
    df["engagement_label"] = df["engagement"].apply(_engagement_label)
    df = _add_missing_cols(df, {"platform": "LinkedIn", "audience": "Professionals", "hashtags": "", "cta": ""})
    df = df.drop(columns=["engagement", "language"], errors="ignore")
    print(f"   ✓ enriched_posts.json — {len(df)} rows")
    return df[COLS]


def load_instagram_reels() -> tuple[pd.DataFrame, dict]:
    """Kaggle 2 — Instagram_Reels_Data_Cleaned.csv + hashtag map."""
    path = os.path.join(RAW, "Instagram_Reels_Data_Cleaned.csv")
    hashtags_by_topic: dict = {}
    if not os.path.exists(path):
        print("   ⚠️  Instagram_Reels_Data_Cleaned.csv not found — skipping")
        return pd.DataFrame(), hashtags_by_topic

    raw = pd.read_csv(path)[["hashtags", "topic"]].dropna()
    raw["hashtags"] = raw["hashtags"].str.strip()
    raw["topic"]    = raw["topic"].str.strip().str.title()

    for topic, group in raw.groupby("topic"):
        tags = []
        for tag_str in group["hashtags"]:
            tags.extend(["#" + t.strip() for t in str(tag_str).split() if t.strip()])
        hashtags_by_topic[topic] = list(dict.fromkeys(tags))[:20]

    df = raw.copy()
    df = _add_missing_cols(df, {
        "caption": "", "tone": "Casual", "platform": "Instagram",
        "audience": "Gen Z", "cta": "Follow for more!", "engagement_label": "medium",
    })
    print(f"   ✓ Instagram_Reels_Data_Cleaned.csv — {len(df)} rows | {len(hashtags_by_topic)} hashtag topics")
    return df[COLS], hashtags_by_topic


def load_sentiment_dataset() -> pd.DataFrame:
    """Kaggle 3 — sentimentdataset.csv."""
    path = os.path.join(RAW, "sentimentdataset.csv")
    if not os.path.exists(path):
        print("   ⚠️  sentimentdataset.csv not found — skipping")
        return pd.DataFrame()

    raw = pd.read_csv(path)
    raw.columns = raw.columns.str.strip()
    df = raw[["Text", "Sentiment", "Platform", "Hashtags"]].copy()
    df.columns = ["caption", "tone", "platform", "hashtags"]
    for col in df.columns:
        df[col] = df[col].astype(str).str.strip()

    tone_map = {
        "Positive":      "Inspirational",
        "Negative":      "Urgent",
        "Neutral":       "Professional",
        "Very Positive": "Humorous",
    }
    platform_map = {p: p for p in ["Twitter", "Instagram", "Facebook", "LinkedIn", "TikTok"]}

    df["tone"]     = df["tone"].map(tone_map).fillna("Casual")
    df["platform"] = df["platform"].map(platform_map).fillna("Twitter")
    df = _add_missing_cols(df, {"topic": "General", "audience": "Millennials", "cta": "Share your thoughts!", "engagement_label": "medium"})
    df = df[df["caption"].str.len() > 5]
    print(f"   ✓ sentimentdataset.csv — {len(df)} rows")
    return df[COLS]


def load_advertising_dataset() -> pd.DataFrame:
    """Kaggle 4 — Social_Media_Advertising.csv."""
    path = os.path.join(RAW, "Social_Media_Advertising.csv")
    if not os.path.exists(path):
        print("   ⚠️  Social_Media_Advertising.csv not found — skipping")
        return pd.DataFrame()

    raw = pd.read_csv(path)
    raw.columns = raw.columns.str.strip()
    df = raw[["Target_Audience", "Campaign_Goal", "Channel_Used", "Customer_Segment", "Company", "Engagement_Score"]].copy()
    df.columns = ["audience", "campaign_goal", "platform", "topic", "brand", "engagement"]
    df["engagement_label"] = df["engagement"].apply(lambda x: "high" if x >= 7 else ("medium" if x >= 4 else "low"))
    df["caption"] = df["brand"] + " — " + df["campaign_goal"]
    df["tone"]    = "Professional"
    df["hashtags"] = ""
    df["cta"]      = "Learn more!"
    df = df.drop(columns=["engagement", "brand"])
    print(f"   ✓ Social_Media_Advertising.csv — {len(df)} rows")
    return df[COLS]


def load_manual_dataset() -> pd.DataFrame:
    """Manual curated dataset."""
    path = os.path.join(RAW, "manual_dataset.csv")
    if not os.path.exists(path):
        print("   ⚠️  manual_dataset.csv not found — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path, encoding="utf-8-sig")
    print(f"   ✓ manual_dataset.csv — {len(df)} rows")
    return df


def load_image_dataset() -> None:
    """Copy image_dataset.csv to processed/ folder."""
    path = os.path.join(RAW, "image_dataset.csv")
    if not os.path.exists(path):
        print("   ⚠️  image_dataset.csv not found — skipping")
        return
    df = pd.read_csv(path, encoding="utf-8-sig")
    df.to_csv(os.path.join(PROCESSED, "image_dataset_processed.csv"), index=False, encoding="utf-8-sig", errors="replace")
    print(f"   ✓ image_dataset.csv — {len(df)} rows → image_dataset_processed.csv")


# ══════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 65)
    print("  AI Social Media Campaign Generator — Data Preprocessing")
    print("=" * 65)

    # ── Load datasets ──────────────────────────────────────────────
    print("\n[LOAD] Reading raw datasets...")
    df1             = load_enriched_posts()
    df2, hashtags_by_topic = load_instagram_reels()
    df3             = load_sentiment_dataset()
    df4             = load_advertising_dataset()
    df_manual       = load_manual_dataset()
    load_image_dataset()

    # ── Merge ──────────────────────────────────────────────────────
    print("\n[MERGE] Combining all datasets...")
    frames = []
    for df in [df1, df2, df3, df4, df_manual]:
        if df is not None and len(df) > 0:
            for col in COLS:
                if col not in df.columns:
                    df[col] = ""
            frames.append(df[COLS])

    if not frames:
        print("❌ No data found! Copy your datasets to data/raw/text/ first.")
        return

    master = pd.concat(frames, ignore_index=True)

    # ── Global cleaning ────────────────────────────────────────────
    before = len(master)
    master = master.drop_duplicates(subset=["caption"])
    master = master.dropna(subset=["caption", "tone", "platform"])
    master["caption"]  = master["caption"].str.strip()
    master["tone"]     = master["tone"].str.strip().str.title()
    master["platform"] = master["platform"].str.strip().str.title()
    master["hashtags"] = master["hashtags"].fillna("").str.strip()
    master["audience"] = master["audience"].fillna("General").str.strip()
    master = master[master["caption"].str.len() >= 5]
    print(f"   Removed {before - len(master)} duplicates/empty rows")
    print(f"   ✓ Master dataset: {len(master)} rows")

    # ── NLTK tokenisation ──────────────────────────────────────────
    print("\n[NLTK] Tokenising and removing stopwords...")
    stop_words = set(stopwords.words("english"))

    def clean_text(text: str) -> str:
        text   = re.sub(r"[^a-zA-Z0-9\s#@]", "", str(text).lower())
        tokens = [t for t in word_tokenize(text) if t not in stop_words and len(t) > 1]
        return " ".join(tokens)

    master["caption_cleaned"] = master["caption"].apply(clean_text)
    print("   ✓ caption_cleaned column added")

    # ── Label encoding ─────────────────────────────────────────────
    print("\n[ENCODE] Label-encoding categorical columns...")
    le_tone     = LabelEncoder().fit(master["tone"])
    le_platform = LabelEncoder().fit(master["platform"])
    le_audience = LabelEncoder().fit(master["audience"])
    le_label    = LabelEncoder().fit(master["engagement_label"])

    master["tone_id"]             = le_tone.transform(master["tone"])
    master["platform_id"]         = le_platform.transform(master["platform"])
    master["audience_id"]         = le_audience.transform(master["audience"])
    master["engagement_label_id"] = le_label.transform(master["engagement_label"])

    print(f"   Tones     : {list(le_tone.classes_)}")
    print(f"   Platforms : {list(le_platform.classes_)}")

    # ── Train / test split ─────────────────────────────────────────
    print("\n[SPLIT] 80/20 train-test split...")
    train_df, test_df = train_test_split(master, test_size=0.2, random_state=42)
    print(f"   ✓ Train: {len(train_df)}  |  Test: {len(test_df)}")

    # ── Save outputs ───────────────────────────────────────────────
    print("\n[SAVE] Writing processed files...")
    _save_csv(master,   "master_dataset.csv")
    _save_csv(train_df, "train.csv")
    _save_csv(test_df,  "test.csv")

    posts_cols = ["caption", "caption_cleaned", "tone", "platform", "audience", "hashtags", "cta", "engagement_label"]
    _save_csv(master[posts_cols], "posts_cleaned.csv")

    if len(df4) > 0 and "campaign_goal" in df4.columns:
        camp_cols = [c for c in ["caption", "campaign_goal", "platform", "audience", "topic", "engagement_label"] if c in df4.columns]
        _save_csv(df4[camp_cols], "campaigns_cleaned.csv")

    with open(os.path.join(PROCESSED, "hashtags_by_topic.json"), "w", encoding="utf-8") as f:
        json.dump(hashtags_by_topic, f, indent=2, ensure_ascii=False)
    print("   ✓ hashtags_by_topic.json")

    label_mappings = {
        "tone":             dict(zip(le_tone.classes_.tolist(),     le_tone.transform(le_tone.classes_).tolist())),
        "platform":         dict(zip(le_platform.classes_.tolist(), le_platform.transform(le_platform.classes_).tolist())),
        "audience":         dict(zip(le_audience.classes_.tolist(), le_audience.transform(le_audience.classes_).tolist())),
        "engagement_label": dict(zip(le_label.classes_.tolist(),    le_label.transform(le_label.classes_).tolist())),
    }
    with open(os.path.join(PROCESSED, "label_mappings.json"), "w") as f:
        json.dump(label_mappings, f, indent=2)
    print("   ✓ label_mappings.json")

    # ── Summary ────────────────────────────────────────────────────
    print(f"\n{'=' * 65}")
    print("  PREPROCESSING COMPLETE ✅")
    print(f"  Master rows : {len(master)}  |  Train: {len(train_df)}  |  Test: {len(test_df)}")
    print(f"  Platforms   : {master['platform'].nunique()}  |  Tones: {master['tone'].nunique()}")
    print(f"  Hashtag topics: {len(hashtags_by_topic)}")
    print(f"  Output: data/processed/text/")
    print("=" * 65)


if __name__ == "__main__":
    main()
