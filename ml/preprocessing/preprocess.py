"""
Socialyze — Data Preprocessing Pipeline
=========================================
Project Stage   : STAGE 3 — Data Preprocessing
Project Goal    : Generate post variations, captions, hashtags, and campaign
                  ideas for different target audiences.

What this script does:
  - Loads 6 raw datasets (LinkedIn posts, Instagram Reels, Sentiment,
    Advertising, Manual curation, Image dataset)
  - Cleans, normalises, and unifies them into a single master schema
  - Applies NLTK tokenisation and stopword removal
  - Encodes categorical labels (tone, platform, audience, engagement)
  - Outputs: master_dataset.csv, train.csv, test.csv, hashtag_map.json

Output schema (COLS):
  caption | tone | platform | audience | hashtags | topic | cta |
  engagement_label | caption_cleaned | tone_id | source

Tech   : Pandas, NumPy, NLTK, Scikit-learn
Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    python ml/preprocessing/preprocess.py
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

# ── NLTK downloads ─────────────────────────────────────────────────
nltk.download("punkt",      quiet=True)
nltk.download("punkt_tab",  quiet=True)
nltk.download("stopwords",  quiet=True)

# ── Paths ──────────────────────────────────────────────────────────
# ml/preprocessing/preprocess.py → go up 3 levels to reach project root
BASE      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW       = os.path.join(BASE, "data", "raw", "text")
PROCESSED = os.path.join(BASE, "data", "processed", "text")
MODELS    = os.path.join(BASE, "data", "models")

os.makedirs(RAW,       exist_ok=True)
os.makedirs(PROCESSED, exist_ok=True)
os.makedirs(MODELS,    exist_ok=True)

# ── Master schema ──────────────────────────────────────────────────
COLS = ["caption", "tone", "platform", "audience",
        "hashtags", "topic", "cta", "engagement_label", "source"]

# ── Valid domain values ────────────────────────────────────────────
VALID_TONES     = {"Casual", "Professional", "Inspirational", "Humorous", "Urgent"}
VALID_PLATFORMS = {"Instagram", "Twitter", "LinkedIn", "Facebook", "TikTok", "Pinterest"}
VALID_AUDIENCES = {"Gen Z", "Millennials", "Professionals", "Students", "Parents", "Entrepreneurs"}
VALID_ENG       = {"high", "medium", "low"}

# ══════════════════════════════════════════════════════════════════
#  UTILITY HELPERS
# ══════════════════════════════════════════════════════════════════

def _clean_unicode(text: str) -> str:
    """Strip bad bytes while keeping valid UTF-8."""
    return text.encode("utf-8", "ignore").decode("utf-8", "ignore")


def _safe_str_clean(df: pd.DataFrame) -> pd.DataFrame:
    """Apply unicode clean to every string column in-place."""
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].apply(
                lambda x: _clean_unicode(x) if isinstance(x, str) else x
            )
    return df


def _engagement_label(score) -> str:
    """Map a numeric engagement score → high / medium / low."""
    try:
        score = float(score)
    except (TypeError, ValueError):
        return "medium"
    if score >= 200:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


def _normalise_tone(tone: str) -> str:
    """Title-case and fall back to 'Casual' if tone is unrecognised."""
    t = str(tone).strip().title()
    return t if t in VALID_TONES else "Casual"


def _normalise_platform(platform: str) -> str:
    """Title-case and fall back to 'Instagram' if platform is unrecognised."""
    p = str(platform).strip().title()
    return p if p in VALID_PLATFORMS else "Instagram"


def _add_defaults(df: pd.DataFrame, defaults: dict) -> pd.DataFrame:
    """Add columns with default values only when they are missing."""
    for col, val in defaults.items():
        if col not in df.columns:
            df[col] = val
    return df


def _save_csv(df: pd.DataFrame, filename: str) -> None:
    path = os.path.join(PROCESSED, filename)
    df.to_csv(path, index=False, encoding="utf-8-sig", errors="replace")
    print(f"  ✓ {filename:<35} {len(df):>6} rows")


# ══════════════════════════════════════════════════════════════════
#  DATASET LOADERS
# ══════════════════════════════════════════════════════════════════

def load_enriched_posts() -> pd.DataFrame:
    path = os.path.join(RAW, "enriched_posts.json")
    if not os.path.exists(path):
        print("  ⚠  enriched_posts.json not found — skipping")
        return pd.DataFrame()

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        raw = _clean_unicode(f.read())

    records = json.loads(raw)
    cleaned = []
    for item in records:
        cleaned.append({
            k: (_clean_unicode(v) if isinstance(v, str) else v)
            for k, v in item.items()
        })

    df = pd.DataFrame(cleaned)

    if "language" in df.columns:
        df = df[df["language"].str.strip().str.lower() == "english"].copy()

    df["topic"] = df["tags"].apply(
        lambda x: ", ".join(x) if isinstance(x, list) else str(x)
    )

    df = df.rename(columns={"text": "caption"})
    df["tone"]             = df["tone"].apply(_normalise_tone)
    df["engagement_label"] = df["engagement"].apply(_engagement_label)

    df = _add_defaults(df, {
        "platform": "LinkedIn",
        "audience": "Professionals",
        "hashtags": "",
        "cta":      "",
        "source":   "kaggle_linkedin",
    })

    df = df.drop(columns=["engagement", "language", "line_count", "tags"],
                 errors="ignore")
    print(f"  ✓ enriched_posts.json loaded         {len(df):>6} rows")
    return df[COLS]


def load_instagram_reels() -> tuple[pd.DataFrame, dict]:
    path = os.path.join(RAW, "Instagram_Reels_Data_Cleaned.csv")
    hashtag_map: dict = {}

    if not os.path.exists(path):
        print("  ⚠  Instagram_Reels_Data_Cleaned.csv not found — skipping")
        return pd.DataFrame(), hashtag_map

    df = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip")
    df = _safe_str_clean(df)

    df["hashtags"] = df["hashtags"].fillna("").astype(str)
    df["topic"]    = df["topic"].fillna("General").astype(str)

    for topic, group in df.groupby("topic"):
        tags = []
        for tag_str in group["hashtags"]:
            tags.extend(["#" + t.strip() for t in tag_str.split() if t.strip()])
        hashtag_map[topic] = sorted(set(tags))[:20]

    df["caption"] = df["hashtags"].apply(
        lambda h: " ".join(h.split()[:10]) if h else ""
    )
    df["caption"] = df["caption"].replace("", pd.NA)
    df = df.dropna(subset=["caption"])

    df = _add_defaults(df, {
        "tone":             "Casual",
        "platform":         "Instagram",
        "audience":         "Gen Z",
        "cta":              "Follow for more!",
        "engagement_label": "medium",
        "source":           "kaggle_instagram",
    })

    print(f"  ✓ Instagram_Reels_Data_Cleaned.csv    {len(df):>6} rows  "
          f"| hashtag_map: {len(hashtag_map)} topics")
    return df[COLS], hashtag_map


def load_sentiment_dataset() -> pd.DataFrame:
    path = os.path.join(RAW, "sentimentdataset.csv")
    if not os.path.exists(path):
        print("  ⚠  sentimentdataset.csv not found — skipping")
        return pd.DataFrame()

    df = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip")
    df = _safe_str_clean(df)
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df.columns = df.columns.str.strip()
    for col in df.select_dtypes("object").columns:
        df[col] = df[col].str.strip()

    sentiment_to_tone = {
        "positive": "Inspirational",
        "negative": "Urgent",
        "neutral":  "Casual",
    }
    df["tone"] = (
        df["Sentiment"]
        .str.lower()
        .map(sentiment_to_tone)
        .fillna("Casual")
    )

    df["platform"]         = df["Platform"].apply(_normalise_platform)
    df["engagement_label"] = df["Likes"].apply(_engagement_label)
    df = df.rename(columns={"Text": "caption", "Hashtags": "hashtags"})

    df = _add_defaults(df, {
        "topic":    "General",
        "audience": "Millennials",
        "cta":      "Share your thoughts!",
        "source":   "kaggle_sentiment",
    })

    print(f"  ✓ sentimentdataset.csv loaded         {len(df):>6} rows")
    return df[COLS]


def load_advertising_dataset() -> pd.DataFrame:
    path = os.path.join(RAW, "Social_Media_Advertising.csv")
    if not os.path.exists(path):
        print("  ⚠  Social_Media_Advertising.csv not found — skipping")
        return pd.DataFrame()

    chunks = []
    for chunk in pd.read_csv(path, encoding="utf-8", on_bad_lines="skip",
                              chunksize=50_000):
        chunks.append(chunk)
    df = pd.concat(chunks, ignore_index=True)
    df = _safe_str_clean(df)
    df.columns = df.columns.str.strip()

    df["caption"] = (
        df["Company"].fillna("Brand")
        + " — "
        + df["Campaign_Goal"].fillna("campaign")
        + ". Duration: "
        + df["Duration"].fillna("").astype(str)
    )

    channel_map = {
        "instagram": "Instagram",
        "facebook":  "Facebook",
        "twitter":   "Twitter",
        "linkedin":  "LinkedIn",
        "tiktok":    "TikTok",
        "pinterest": "Pinterest",
    }
    df["platform"] = (
        df["Channel_Used"]
        .str.lower()
        .map(channel_map)
        .fillna("Instagram")
    )

    def _map_audience(raw: str) -> str:
        raw = str(raw).lower()
        if "18-24" in raw or "gen z" in raw:
            return "Gen Z"
        if "25-34" in raw or "millennial" in raw:
            return "Millennials"
        if "35-44" in raw or "45-60" in raw or "men" in raw or "women" in raw:
            return "Professionals"
        return "Millennials"

    df["audience"]         = df["Target_Audience"].apply(_map_audience)
    df["tone"]             = "Professional"
    df["hashtags"]         = ""
    df["cta"]              = "Learn more!"
    df["topic"]            = df["Customer_Segment"].fillna("General")
    df["engagement_label"] = df["Engagement_Score"].apply(_engagement_label)
    df["source"]           = "kaggle_ads"

    print(f"  ✓ Social_Media_Advertising.csv        {len(df):>6} rows")
    return df[COLS]


def load_manual_dataset() -> pd.DataFrame:
    path = os.path.join(RAW, "manual_dataset.csv")
    if not os.path.exists(path):
        print("  ⚠  manual_dataset.csv not found — skipping")
        return pd.DataFrame()

    df = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip")
    df = _safe_str_clean(df)
    df.columns = df.columns.str.strip()

    df["tone"]     = df["tone"].apply(_normalise_tone)
    df["platform"] = df["platform"].apply(_normalise_platform)

    df = _add_defaults(df, {
        "topic":            "General",
        "source":           "manual",
        "hashtags":         "",
        "cta":              "",
        "engagement_label": "medium",
    })

    print(f"  ✓ manual_dataset.csv loaded           {len(df):>6} rows")
    return df[COLS]


def load_image_dataset() -> pd.DataFrame:
    path = os.path.join(RAW, "image_dataset.csv")
    if not os.path.exists(path):
        print("  ⚠  image_dataset.csv not found — skipping")
        return pd.DataFrame()

    df = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip")
    df = _safe_str_clean(df)
    df.columns = df.columns.str.strip()

    df = df.rename(columns={
        "caption_suggestion": "caption",
        "hashtag_suggestion": "hashtags",
        "cta_type":           "cta",
    })

    mood_to_tone = {
        "happy":     "Casual",
        "energetic": "Casual",
        "calm":      "Inspirational",
        "exciting":  "Urgent",
    }
    df["tone"]     = df["mood"].str.lower().map(mood_to_tone).fillna("Casual")
    df["platform"] = df["platform"].apply(_normalise_platform)
    df["topic"]    = df.get("campaign_goal", pd.Series("General", index=df.index))
    df["source"]   = "image_metadata"

    df = _add_defaults(df, {
        "audience":         "Millennials",
        "engagement_label": "medium",
    })

    print(f"  ✓ image_dataset.csv loaded            {len(df):>6} rows")
    return df[COLS]


# ══════════════════════════════════════════════════════════════════
#  CLEANING & NLP
# ══════════════════════════════════════════════════════════════════

def clean_text(text: str, stop_words: set) -> str:
    text   = re.sub(r"[^a-zA-Z0-9\s#@]", " ", str(text).lower())
    text   = re.sub(r"\s+", " ", text).strip()
    tokens = [t for t in word_tokenize(text) if t not in stop_words and len(t) > 1]
    return " ".join(tokens)


# ══════════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════

def main() -> None:
    print("\n" + "=" * 65)
    print("  Socialyze — Preprocessing Pipeline  (Stage 3)")
    print("=" * 65)

    print("\n[1/6] Loading raw datasets...")
    df_linkedin              = load_enriched_posts()
    df_reels, hashtag_map    = load_instagram_reels()
    df_sentiment             = load_sentiment_dataset()
    df_ads                   = load_advertising_dataset()
    df_manual                = load_manual_dataset()
    df_images                = load_image_dataset()

    print("\n[2/6] Merging datasets...")
    frames = [
        df for df in [df_linkedin, df_reels, df_sentiment,
                      df_ads, df_manual, df_images]
        if not df.empty
    ]
    master = pd.concat(frames, ignore_index=True)
    print(f"  Combined rows before dedup: {len(master):,}")

    print("\n[3/6] Cleaning master dataset...")
    master["caption"] = master["caption"].astype(str).str.strip()
    master = master[master["caption"].str.len() > 5].copy()

    before = len(master)
    master = master.drop_duplicates(subset=["caption"])
    print(f"  Removed {before - len(master):,} duplicate rows")

    master["tone"]             = master["tone"].apply(_normalise_tone)
    master["platform"]         = master["platform"].apply(_normalise_platform)
    master["engagement_label"] = master["engagement_label"].str.lower().where(
        master["engagement_label"].str.lower().isin(VALID_ENG), "medium"
    )

    master["hashtags"] = master["hashtags"].fillna("")
    master["topic"]    = master["topic"].fillna("General")
    master["cta"]      = master["cta"].fillna("")
    master["audience"] = master["audience"].fillna("Millennials")
    master["source"]   = master["source"].fillna("unknown")
    print(f"  Rows after cleaning: {len(master):,}")

    print("\n[4/6] NLTK tokenisation & stopword removal...")
    stop_words = set(stopwords.words("english"))
    master["caption_cleaned"] = master["caption"].apply(
        lambda t: clean_text(t, stop_words)
    )
    empty_cleaned = (master["caption_cleaned"].str.len() == 0).sum()
    if empty_cleaned:
        print(f"  ⚠  {empty_cleaned} rows produced empty cleaned captions (retained for generation)")

    print("\n[5/6] Encoding categorical labels...")
    le_tone = LabelEncoder()
    master["tone_id"] = le_tone.fit_transform(master["tone"])
    print(f"  tone classes    : {list(le_tone.classes_)}")

    le_platform = LabelEncoder()
    master["platform_id"] = le_platform.fit_transform(master["platform"])

    le_audience = LabelEncoder()
    master["audience_id"] = le_audience.fit_transform(master["audience"])

    le_eng = LabelEncoder()
    master["engagement_id"] = le_eng.fit_transform(master["engagement_label"])

    label_mapping = {
        "tone":             dict(zip(le_tone.classes_.tolist(),
                                     le_tone.transform(le_tone.classes_).tolist())),
        "platform":         dict(zip(le_platform.classes_.tolist(),
                                     le_platform.transform(le_platform.classes_).tolist())),
        "audience":         dict(zip(le_audience.classes_.tolist(),
                                     le_audience.transform(le_audience.classes_).tolist())),
        "engagement_label": dict(zip(le_eng.classes_.tolist(),
                                     le_eng.transform(le_eng.classes_).tolist())),
    }
    with open(os.path.join(MODELS, "label_mapping.json"), "w", encoding="utf-8") as f:
        json.dump(label_mapping, f, indent=2)
    print(f"  ✓ label_mapping.json saved → data/models/")

    print("\n[6/6] Splitting and saving outputs...")
    train, test = train_test_split(master, test_size=0.2, random_state=42,
                                   stratify=master["tone"])

    _save_csv(master, "master_dataset.csv")
    _save_csv(train,  "train.csv")
    _save_csv(test,   "test.csv")

    hashtag_map_path = os.path.join(PROCESSED, "hashtag_map.json")
    with open(hashtag_map_path, "w", encoding="utf-8") as f:
        json.dump(hashtag_map, f, indent=2, ensure_ascii=False)
    print(f"  ✓ hashtag_map.json              {len(hashtag_map):>6} topics")

    print(f"\n{'=' * 65}")
    print("  PREPROCESSING COMPLETE ✅")
    print(f"  Total rows   : {len(master):,}")
    print(f"  Train / Test : {len(train):,} / {len(test):,}")
    print(f"\n  Platform distribution:")
    for p, n in master["platform"].value_counts().items():
        print(f"    {p:<12} {n:>6}")
    print(f"\n  Tone distribution:")
    for t, n in master["tone"].value_counts().items():
        print(f"    {t:<15} {n:>6}")
    print(f"\n  Engagement distribution:")
    for e, n in master["engagement_label"].value_counts().items():
        print(f"    {e:<8} {n:>6}")
    print(f"\n  Source breakdown:")
    for s, n in master["source"].value_counts().items():
        print(f"    {s:<25} {n:>6}")
    print("=" * 65)


if __name__ == "__main__":
    main()
