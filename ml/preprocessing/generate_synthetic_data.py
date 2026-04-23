"""
AI Social Media Campaign Generator — Synthetic Data Generation
===============================================================
Project Stage   : STAGE 2 (extension) + STAGE 4 — Data Collection via LLM
Project Goal    : Generate post variations, captions, hashtags, and campaign
                  ideas for different target audiences.

What this script does:
  - Uses Gemini 2.0 Flash (Stage 4 LLM) to generate 300 synthetic posts
  - Covers all platform × tone × audience combinations systematically
  - Merges synthetic data with the Kaggle master dataset from Stage 3
  - Enriches training data for Stage 5 (HuggingFace fine-tuning)

Tech used here:
  Generative AI  — Google Gemini 2.0 Flash (`google-genai`)
  Data Handling  — Pandas
  Environment    — python-dotenv

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    python ml/preprocessing/generate_synthetic_data.py
"""

import os
import re
import json
import time
import pandas as pd
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ── API key — read from environment only (never hard-code) ─────────
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", "")

# ── Paths ──────────────────────────────────────────────────────────
# ml/preprocessing/generate_synthetic_data.py → go up 3 levels to reach project root
BASE     = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROC     = os.path.join(BASE, "data", "processed", "text")
MASTER   = os.path.join(PROC, "master_dataset.csv")
OUT_FILE = os.path.join(PROC, "gemini_synthetic_posts.csv")
FINAL    = os.path.join(PROC, "master_dataset_final.csv")
os.makedirs(PROC, exist_ok=True)

# ── Combinations ───────────────────────────────────────────────────
PLATFORMS       = ["Instagram", "Twitter", "LinkedIn", "Facebook", "TikTok"]
TONES           = ["Casual", "Professional", "Inspirational", "Humorous", "Urgent"]
AUDIENCES       = ["Gen Z", "Millennials", "Professionals", "Students"]
POSTS_PER_CALL  = 3   # 5 × 5 × 4 × 3 = 300 posts total
RATE_LIMIT_WAIT = 2   # seconds between API calls (free tier)


def build_prompt(platform: str, tone: str, audience: str) -> str:
    return f"""You are a professional social media content creator.
Generate exactly {POSTS_PER_CALL} unique social media posts for {platform}.

Requirements:
- Target audience : {audience}
- Tone            : {tone}
- Platform        : {platform} (follow platform style and character limits)
- Each post must feel authentic and human-written
- Include relevant emojis where appropriate

Return ONLY a valid JSON array. No explanation. No markdown. No extra text.
Format:
[
  {{
    "caption": "post text here",
    "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
    "cta": "call to action text",
    "content_type": "Single Photo | Reel | Carousel | Story | Tweet",
    "engagement_label": "high | medium | low"
  }}
]"""


def main() -> None:
    print("=" * 65)
    print("  AI Social Media Campaign Generator — Synthetic Data Generation")
    print("=" * 65)

    if not GEMINI_API_KEY:
        print("\n❌ API key not found!")
        print("   Add GOOGLE_API_KEY=your_key to a .env file in the project root.")
        print("   Get a free key at: https://aistudio.google.com")
        return

    client = genai.Client(api_key=GEMINI_API_KEY)
    total  = len(PLATFORMS) * len(TONES) * len(AUDIENCES)
    print(f"\n  Model: gemini-2.0-flash  |  Total combinations: {total}  |  Target posts: {total * POSTS_PER_CALL}\n")

    all_posts = []
    failed    = 0
    current   = 0

    print(f"  {'#':<5} {'Platform':<12} {'Tone':<16} {'Audience':<14} Status")
    print(f"  {'-'*5} {'-'*12} {'-'*16} {'-'*14} {'-'*20}")

    for platform in PLATFORMS:
        for tone in TONES:
            for audience in AUDIENCES:
                current += 1
                print(f"  [{current:>3}/{total}] {platform:<12} {tone:<16} {audience:<14}", end=" ", flush=True)

                try:
                    response = client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=build_prompt(platform, tone, audience),
                        config=types.GenerateContentConfig(temperature=0.9, max_output_tokens=1000),
                    )
                    raw   = re.sub(r"```json|```", "", response.text.strip()).strip()
                    posts = json.loads(raw)

                    for post in posts:
                        all_posts.append({
                            "platform":         platform,
                            "tone":             tone,
                            "audience":         audience,
                            "caption":          post.get("caption",          ""),
                            "hashtags":         post.get("hashtags",         ""),
                            "cta":              post.get("cta",              ""),
                            "content_type":     post.get("content_type",     ""),
                            "engagement_label": post.get("engagement_label", "medium"),
                            "source":           "gemini_synthetic",
                        })
                    print(f"✓ {len(posts)} posts")

                except json.JSONDecodeError:
                    print("⚠️  JSON parse error — skipping")
                    failed += 1
                except Exception as exc:
                    print(f"⚠️  {str(exc)[:50]} — skipping")
                    failed += 1

                time.sleep(RATE_LIMIT_WAIT)

    print(f"\n{'=' * 65}")
    print(f"  Posts generated: {len(all_posts)}  |  Failed calls: {failed}")
    print(f"{'=' * 65}")

    if not all_posts:
        print("\n❌ No posts generated. Check your API key and try again.")
        return

    df_synthetic = pd.DataFrame(all_posts)
    df_synthetic.to_csv(OUT_FILE, index=False, encoding="utf-8-sig", errors="replace")
    print(f"\n✓ Saved: {OUT_FILE}")

    common_cols = ["platform", "tone", "audience", "caption", "hashtags", "cta", "engagement_label", "source", "content_type"]
    for col in common_cols:
        if col not in df_synthetic.columns:
            df_synthetic[col] = ""

    if os.path.exists(MASTER):
        df_master = pd.read_csv(MASTER, encoding="utf-8-sig")
        if "source"       not in df_master.columns: df_master["source"]       = "kaggle"
        if "content_type" not in df_master.columns: df_master["content_type"] = ""
        for col in common_cols:
            if col not in df_master.columns: df_master[col] = ""

        df_combined = pd.concat([df_master[common_cols], df_synthetic[common_cols]], ignore_index=True)
        before      = len(df_combined)
        df_combined = df_combined.drop_duplicates(subset=["caption"])
        print(f"   Removed {before - len(df_combined)} duplicate rows after merge")
        df_combined.to_csv(FINAL, index=False, encoding="utf-8-sig", errors="replace")
    else:
        df_synthetic.to_csv(FINAL, index=False, encoding="utf-8-sig", errors="replace")
        print("   master_dataset.csv not found — saved synthetic data as final dataset")

    print(f"✓ Saved: {FINAL}")
    print(f"\n  Synthetic posts : {len(df_synthetic)}")
    print(f"  Platforms       : {df_synthetic['platform'].nunique()}")
    print(f"  Tones           : {df_synthetic['tone'].nunique()}")
    print(f"  Audiences       : {df_synthetic['audience'].nunique()}")
    print("=" * 65)


if __name__ == "__main__":
    main()
