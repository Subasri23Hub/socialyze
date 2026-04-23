# Stage 3 — Data Preprocessing

**Script:** `preprocess.py`  
**Output directory:** `data/processed/text/`  
**Team:** Subasri B · Gautham Krishnan K · Ashwin D · Vinjarapu Ajay Kumar  
**Company:** Sourcesys Technologies

---

## What this stage does

`preprocess.py` is the data backbone of the Socialyze pipeline. It reads 6 raw datasets from `data/raw/text/`, unifies them under a single schema, cleans and normalises all text, applies NLTK tokenisation and stopword removal, encodes categorical labels, and writes train/test splits ready for model training (Stage 5) and evaluation (Stage 6).

---

## Datasets processed

| # | File | Source | Rows loaded | Key fields used |
|---|------|---------|------------|-----------------|
| 1 | `enriched_posts.json` | Kaggle — LinkedIn enriched posts | ~20 (full dataset: ~500) | text → caption, engagement → label, tags → topic, tone |
| 2 | `Instagram_Reels_Data_Cleaned.csv` | Kaggle — Instagram Reels | 3,036 | hashtags → topic map + synthetic caption |
| 3 | `sentimentdataset.csv` | Kaggle — Multi-platform sentiment | 732 | Text → caption, Sentiment → tone, Platform, Hashtags, Likes |
| 4 | `Social_Media_Advertising.csv` | Kaggle — Social media advertising | 300,000 (deduped to ~800) | Company + Campaign_Goal → caption, Channel_Used → platform, Engagement_Score |
| 5 | `manual_dataset.csv` | Sourcesys manual curation | 92 | All columns align directly with master schema |
| 6 | `image_dataset.csv` | Sourcesys visual annotations | 50 | caption_suggestion, hashtag_suggestion, mood → tone |

---

## Master schema (COLS)

Every dataset is normalised to these 9 columns before merging:

| Column | Type | Description |
|--------|------|-------------|
| `caption` | str | Raw post text |
| `tone` | str | One of: Casual, Professional, Inspirational, Humorous, Urgent |
| `platform` | str | One of: Instagram, Twitter, LinkedIn, Facebook, TikTok, Pinterest |
| `audience` | str | One of: Gen Z, Millennials, Professionals, Students, Parents, Entrepreneurs |
| `hashtags` | str | Space-separated hashtag string |
| `topic` | str | Content topic or product category |
| `cta` | str | Call-to-action text |
| `engagement_label` | str | high / medium / low |
| `source` | str | Dataset origin identifier |

**Derived columns added during processing:**

| Column | Description |
|--------|-------------|
| `caption_cleaned` | Lowercased, stopwords removed, tokenised |
| `tone_id` | Integer label from LabelEncoder (used by train.py) |
| `platform_id` | Integer label for platform |
| `audience_id` | Integer label for audience |
| `engagement_id` | Integer label for engagement_label |

---

## Pipeline steps

```
[1] Load        →  6 dataset-specific loaders, each normalises to COLS
[2] Merge       →  pd.concat of all non-empty DataFrames
[3] Clean       →  drop len<5 captions, deduplicate on caption text,
                   normalise tone/platform/engagement values, fill NaNs
[4] NLTK        →  regex clean → word_tokenize → drop stopwords
                   → write caption_cleaned
[5] Encode      →  LabelEncoder for tone, platform, audience, engagement_label
                   → save label_mapping.json
[6] Split/Save  →  80/20 stratified split on tone
                   → master_dataset.csv, train.csv, test.csv, hashtag_map.json
```

---

## Output files

| File | Rows | Description |
|------|------|-------------|
| `data/processed/text/master_dataset.csv` | 4,566 | Full cleaned and encoded dataset |
| `data/processed/text/train.csv` | 3,652 | 80% split — used by training/train.py |
| `data/processed/text/test.csv` | 914 | 20% split — used by evaluation/evaluate.py |
| `data/processed/text/hashtag_map.json` | 26 topics | Topic → top-20 hashtags from Instagram Reels |
| `data/models/label_mapping.json` | — | Tone, platform, audience, engagement encodings |

---

## Distribution summary (last run)

### Platform
| Platform | Count | % |
|----------|-------|---|
| Instagram | 3,443 | 75.4% |
| Facebook | 469 | 10.3% |
| Twitter | 449 | 9.8% |
| Pinterest | 205 | 4.5% |

> LinkedIn and TikTok are missing. This is because `enriched_posts.json` only contained 20 English posts in the current file. Place the full Kaggle dataset at `data/raw/text/enriched_posts.json` and re-run.

### Tone
| Tone | Count | % |
|------|-------|---|
| Casual | 3,625 | 79.4% |
| Professional | 832 | 18.2% |
| Inspirational | 75 | 1.6% |
| Humorous | 18 | 0.4% |
| Urgent | 16 | 0.4% |

> **Class imbalance warning.** Casual dominates heavily. The `generate_synthetic_data.py` step (Stage 4) targets all 5 tones × all platforms systematically, which will balance this before training.

### Engagement
| Label | Count | % |
|-------|-------|---|
| medium | 3,172 | 69.4% |
| low | 1,270 | 27.8% |
| high | 124 | 2.7% |

---

## Known issues and fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Only 20 LinkedIn rows | Truncated `enriched_posts.json` | Replace with full Kaggle file |
| No LinkedIn/TikTok in platform distribution | Same as above | Same fix |
| Tone imbalance (79% Casual) | Advertising dataset rows all assigned "Professional"; Instagram Reels defaulted to "Casual" | Run `generate_synthetic_data.py` to add 300 balanced synthetic posts before training |
| 299,297 rows deduplicated | Advertising dataset has many near-identical Company+Goal combos | Expected and correct — unique captions only |
| Pandas FutureWarning (select_dtypes) | Pandas 2.x deprecating `"object"` dtype selector | Cosmetic only; no impact on output. Will be updated to `include="str"` for Pandas 3 compatibility |

---

## How to run

```bash
# Ensure raw datasets are in data/raw/text/
python preprocess.py
```

Expected runtime: ~2–3 minutes (dominated by the 39MB advertising CSV).  
No GPU or API key required.

---

## Next steps after preprocessing

```bash
# Stage 4 — Generate 300 balanced synthetic posts via Gemini
python generate_synthetic_data.py

# Stage 5 — Fine-tune DistilBERT on the combined dataset
python training/train.py

# Stage 6 — Evaluate model quality
python evaluation/evaluate.py
```
