"""
AI Social Media Campaign Generator — Centralised Python Configuration
======================================================================
Import from any script:
    from config.settings import PLATFORMS, TONES, DATA_PATHS, ...
"""

import os

# ── Project root ───────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Data paths ─────────────────────────────────────────────────────
DATA_PATHS = {
    "raw_text":        os.path.join(ROOT, "data", "raw",       "text"),
    "processed_text":  os.path.join(ROOT, "data", "processed", "text"),
    "models":          os.path.join(ROOT, "data", "models"),
    "evaluation":      os.path.join(ROOT, "data", "evaluation"),
}

# ── Campaign options ───────────────────────────────────────────────
PLATFORMS = ["Instagram", "Twitter", "LinkedIn", "Facebook", "TikTok"]

TONES = ["Casual", "Professional", "Inspirational", "Humorous", "Urgent"]

AUDIENCES = ["Gen Z", "Millennials", "Professionals", "Students", "Parents", "Entrepreneurs"]

CAMPAIGN_TYPES = [
    "product launch",
    "brand awareness",
    "lead generation",
    "engagement boost",
    "content promotion",
]

# ── Engagement thresholds ──────────────────────────────────────────
ENGAGEMENT_HIGH   = 200   # score >= HIGH  → "high"
ENGAGEMENT_MEDIUM = 50    # score >= MED   → "medium"
                          # score < MED    → "low"

# ── ML training defaults ───────────────────────────────────────────
ML = {
    "model_name":    "distilbert-base-uncased",
    "label_column":  "tone",
    "max_length":    128,
    "batch_size":    8,
    "epochs":        3,
    "learning_rate": 2e-5,
    "weight_decay":  0.01,
    "test_size":     0.2,
    "random_state":  42,
}

# ── Groq generation defaults ───────────────────────────────────────
GROQ = {
    "model":             "llama-3.1-8b-instant",
    "temperature":       0.9,
    "max_output_tokens": 4000,
}
