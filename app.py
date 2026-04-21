"""
Socialyze
=========
Project Title   : Socialyze
Project Goal    : Generate post variations, captions, hashtags, and campaign
                  ideas for different target audiences across 5 platforms.

Stage 7 — Integration & Deployment (main Streamlit entry point)

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    pip install -r requirements.txt
    streamlit run app.py
"""

import os
import json
import pandas as pd
import streamlit as st
from google import genai
from google.genai import types

# ─────────────────────────────────────────────────────────────────────────────
# PAGE CONFIG  (must be first Streamlit call)
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Socialyze",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL CSS  — Premium SaaS Design System (Notion / Linear / Stripe style)
# Font    : Inter via Google Fonts
# Palette : #F8FAFC bg · #FFFFFF cards · #2563EB primary · #0F172A headings
# Spacing : 8-px grid · generous whitespace · subtle shadows only
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* ════════════════════════════════════════════════════════════════
   0. GOOGLE FONTS — Inter
   ════════════════════════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* ════════════════════════════════════════════════════════════════
   1. GLOBAL RESET & BASE
   ════════════════════════════════════════════════════════════════ */
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* Page background — very light cool grey */
[data-testid="stAppViewContainer"] {
    background: #F8FAFC !important;
}
[data-testid="stHeader"] { background: transparent !important; box-shadow: none !important; }
[data-testid="block-container"] { padding-top: 24px !important; padding-bottom: 48px !important; }

/* ════════════════════════════════════════════════════════════════
   2. SIDEBAR — clean white panel
   ════════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] {
    background: #FFFFFF !important;
    border-right: 1px solid #E2E8F0 !important;
    padding: 0 !important;
}
[data-testid="stSidebar"] > div:first-child { padding: 24px 20px !important; }

/* Brand mark */
.sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 24px;
    margin-bottom: 8px;
    border-bottom: 1px solid #F1F5F9;
}
.sidebar-brand-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #3B82F6, #0EA5E9);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px;
    box-shadow: 0 2px 8px rgba(59,130,246,.30);
    flex-shrink: 0;
}
.sidebar-brand-name {
    font-size: 16px;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: -0.01em;
}

/* Nav section label */
.sidebar-section {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: #94A3B8;
    margin: 24px 0 8px 0;
    padding-left: 4px;
}

/* Nav link rows */
.nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    transition: background .15s, color .15s;
    margin-bottom: 2px;
    text-decoration: none;
}
.nav-item:hover  { background: #F1F5F9; color: #0F172A; }
.nav-item.active { background: #EFF6FF; color: #2563EB; font-weight: 600; }
.nav-icon { font-size: 15px; width: 20px; text-align: center; }

/* Sidebar divider */
.sidebar-divider {
    height: 1px;
    background: #F1F5F9;
    margin: 20px 0;
}

/* Sidebar input labels */
.sidebar-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #64748B;
    margin: 20px 0 10px 0;
}

/* ════════════════════════════════════════════════════════════════
   3. STREAMLIT WIDGET OVERRIDES — inputs, selects, buttons
   ════════════════════════════════════════════════════════════════ */

/* All text inputs */
.stTextInput > label,
.stSelectbox > label,
.stMultiSelect > label,
.stSlider > label {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #64748B !important;
    letter-spacing: 0.04em !important;
    text-transform: uppercase !important;
    margin-bottom: 6px !important;
}

.stTextInput > div > div > input {
    border-radius: 10px !important;
    border: 1.5px solid #E2E8F0 !important;
    background: #FAFAFA !important;
    font-size: 13.5px !important;
    font-family: 'Inter', sans-serif !important;
    color: #0F172A !important;
    padding: 10px 14px !important;
    transition: border-color .2s, box-shadow .2s !important;
    box-shadow: 0 1px 2px rgba(15,23,42,.04) !important;
}
.stTextInput > div > div > input:focus {
    border-color: #3B82F6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,.12) !important;
    background: #FFFFFF !important;
    outline: none !important;
}
.stTextInput > div > div > input::placeholder { color: #CBD5E1 !important; }

/* Selectbox */
.stSelectbox > div > div {
    border-radius: 10px !important;
    border: 1.5px solid #E2E8F0 !important;
    background: #FAFAFA !important;
    font-size: 13.5px !important;
    font-family: 'Inter', sans-serif !important;
    color: #0F172A !important;
    box-shadow: 0 1px 2px rgba(15,23,42,.04) !important;
}

/* Multiselect */
.stMultiSelect > div > div {
    border-radius: 10px !important;
    border: 1.5px solid #E2E8F0 !important;
    background: #FAFAFA !important;
    font-size: 13px !important;
    font-family: 'Inter', sans-serif !important;
    box-shadow: 0 1px 2px rgba(15,23,42,.04) !important;
}
[data-baseweb="tag"] {
    background: #EFF6FF !important;
    border: 1px solid #BFDBFE !important;
    border-radius: 6px !important;
}
[data-baseweb="tag"] span { color: #2563EB !important; font-size: 12px !important; }

/* Slider */
.stSlider [data-baseweb="slider"] div[role="slider"] {
    background: #2563EB !important;
    box-shadow: 0 0 0 3px rgba(37,99,235,.20) !important;
}
.stSlider [data-testid="stThumbValue"] { color: #2563EB !important; font-weight: 600 !important; }

/* PRIMARY button — the main generate button */
.stButton > button[kind="primary"],
.stButton > button {
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    border-radius: 10px !important;
    padding: 11px 20px !important;
    border: none !important;
    cursor: pointer !important;
    transition: all .2s ease !important;
    letter-spacing: -0.01em !important;
}
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #2563EB, #0EA5E9) !important;
    color: #FFFFFF !important;
    box-shadow: 0 4px 14px rgba(37,99,235,.35) !important;
}
.stButton > button[kind="primary"]:hover {
    box-shadow: 0 6px 20px rgba(37,99,235,.45) !important;
    transform: translateY(-1px) !important;
}
.stButton > button[kind="primary"]:active { transform: translateY(0) !important; }
.stButton > button:not([kind="primary"]) {
    background: #FFFFFF !important;
    color: #374151 !important;
    border: 1.5px solid #E2E8F0 !important;
    box-shadow: 0 1px 3px rgba(15,23,42,.06) !important;
}
.stButton > button:not([kind="primary"]):hover {
    background: #F8FAFC !important;
    border-color: #CBD5E1 !important;
}

/* Tabs */
.stTabs [data-baseweb="tab-list"] {
    background: #F1F5F9 !important;
    border-radius: 10px !important;
    padding: 4px !important;
    gap: 2px !important;
    border: none !important;
}
.stTabs [data-baseweb="tab"] {
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    color: #64748B !important;
    border-radius: 8px !important;
    padding: 8px 16px !important;
    border: none !important;
    background: transparent !important;
    transition: all .15s !important;
}
.stTabs [aria-selected="true"] {
    background: #FFFFFF !important;
    color: #2563EB !important;
    font-weight: 600 !important;
    box-shadow: 0 1px 4px rgba(15,23,42,.10) !important;
}

/* Expander */
[data-testid="stExpander"] {
    background: #FFFFFF !important;
    border: 1.5px solid #E2E8F0 !important;
    border-radius: 12px !important;
    box-shadow: 0 1px 4px rgba(15,23,42,.05) !important;
    margin-bottom: 8px !important;
    overflow: hidden !important;
}
[data-testid="stExpander"] summary {
    font-family: 'Inter', sans-serif !important;
    font-size: 13.5px !important;
    font-weight: 600 !important;
    color: #374151 !important;
    padding: 14px 18px !important;
}

/* Alert / info / warning */
.stAlert {
    border-radius: 10px !important;
    border: none !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 13.5px !important;
}

/* Spinner */
.stSpinner > div { border-top-color: #2563EB !important; }

/* Code blocks */
.stCodeBlock > div {
    border-radius: 10px !important;
    border: 1.5px solid #E2E8F0 !important;
    background: #F8FAFC !important;
    font-size: 13px !important;
}

/* ════════════════════════════════════════════════════════════════
   4. TOP BAR COMPONENT
   ════════════════════════════════════════════════════════════════ */
.top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #FFFFFF;
    border-radius: 16px;
    padding: 20px 28px;
    margin-bottom: 28px;
    border: 1px solid #E2E8F0;
    box-shadow: 0 1px 4px rgba(15,23,42,.05), 0 4px 16px rgba(15,23,42,.04);
}
.top-bar-title {
    font-size: 22px;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: -0.025em;
    line-height: 1.2;
}
.top-bar-sub {
    font-size: 13.5px;
    color: #64748B;
    margin-top: 4px;
    line-height: 1.5;
    font-weight: 400;
}

/* ════════════════════════════════════════════════════════════════
   5. SECTION HEADING
   ════════════════════════════════════════════════════════════════ */
.section-heading {
    font-size: 15px;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: -0.01em;
    margin-bottom: 4px;
}
.section-sub {
    font-size: 13px;
    color: #64748B;
    margin-bottom: 20px;
    font-weight: 400;
    line-height: 1.5;
}
.section-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #F1F5F9;
}
.section-title {
    font-size: 17px;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: -0.02em;
}

/* ════════════════════════════════════════════════════════════════
   6. FRAMEWORK / TEMPLATE CARDS
   ════════════════════════════════════════════════════════════════ */
.fw-card {
    background: #FFFFFF;
    border: 1.5px solid #E2E8F0;
    border-radius: 14px;
    padding: 20px 18px;
    cursor: pointer;
    transition: all .2s ease;
    box-shadow: 0 1px 3px rgba(15,23,42,.05);
    height: 100%;
}
.fw-card:hover {
    border-color: #93C5FD;
    box-shadow: 0 4px 20px rgba(37,99,235,.12);
    transform: translateY(-2px);
}
.fw-icon {
    font-size: 24px;
    margin-bottom: 12px;
    display: block;
    line-height: 1;
}
.fw-name {
    font-size: 14px;
    font-weight: 600;
    color: #0F172A;
    margin-bottom: 6px;
    letter-spacing: -0.01em;
}
.fw-desc {
    font-size: 12.5px;
    color: #64748B;
    line-height: 1.55;
    font-weight: 400;
}

/* ════════════════════════════════════════════════════════════════
   7. CAMPAIGN RESULT CARD
   ════════════════════════════════════════════════════════════════ */
.camp-card {
    background: #FFFFFF;
    border: 1.5px solid #E2E8F0;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(15,23,42,.06), 0 0 0 0 transparent;
    margin-bottom: 24px;
    transition: box-shadow .2s;
}
.camp-card:hover { box-shadow: 0 6px 24px rgba(15,23,42,.10); }
.camp-thumb {
    height: 100px;
    background: linear-gradient(135deg, #38BDF8 0%, #2563EB 60%, #1D4ED8 100%);
    position: relative;
    display: flex;
    align-items: flex-end;
    padding: 14px 18px;
}
.camp-badge {
    background: rgba(255,255,255,.18);
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,.30);
    backdrop-filter: blur(4px);
}
.camp-body    { padding: 20px 22px; }
.camp-title   {
    font-size: 17px;
    font-weight: 700;
    color: #0F172A;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
    line-height: 1.3;
}
.camp-summary {
    font-size: 13.5px;
    color: #475569;
    line-height: 1.65;
    margin-bottom: 14px;
    font-weight: 400;
}
.camp-insight-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94A3B8;
    margin-bottom: 6px;
}
.camp-insight-text {
    font-size: 13px;
    color: #334155;
    line-height: 1.6;
    margin-bottom: 16px;
    font-weight: 400;
}

/* ════════════════════════════════════════════════════════════════
   8. KPI PILLS
   ════════════════════════════════════════════════════════════════ */
.kpi-pill {
    display: inline-flex;
    align-items: center;
    background: #EFF6FF;
    color: #2563EB;
    font-size: 11.5px;
    font-weight: 600;
    padding: 5px 13px;
    border-radius: 20px;
    border: 1px solid #BFDBFE;
    margin: 0 6px 6px 0;
    letter-spacing: -0.01em;
    transition: all .15s;
}
.kpi-pill:hover { background: #DBEAFE; border-color: #93C5FD; }

/* ════════════════════════════════════════════════════════════════
   9. POST VARIATION CARDS
   ════════════════════════════════════════════════════════════════ */
.post-card {
    background: #FFFFFF;
    border: 1.5px solid #E2E8F0;
    border-radius: 14px;
    padding: 20px 22px;
    margin-bottom: 16px;
    transition: all .2s ease;
    box-shadow: 0 1px 4px rgba(15,23,42,.05);
}
.post-card:hover {
    border-color: #93C5FD;
    box-shadow: 0 4px 18px rgba(37,99,235,.08);
}
.post-num {
    font-size: 10.5px;
    font-weight: 700;
    color: #2563EB;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.post-num::before {
    content: '';
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #2563EB;
    opacity: .6;
}
.post-body {
    font-size: 14px;
    color: #1E293B;
    line-height: 1.7;
    margin-bottom: 12px;
    font-weight: 400;
}
.post-tags {
    font-size: 12.5px;
    color: #3B82F6;
    margin-bottom: 12px;
    line-height: 1.6;
    font-weight: 500;
}
.post-meta {
    font-size: 12px;
    color: #94A3B8;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-weight: 400;
    padding-top: 10px;
    border-top: 1px solid #F1F5F9;
}
.post-meta span { color: #64748B; }

/* ════════════════════════════════════════════════════════════════
   10. IDEA CARDS
   ════════════════════════════════════════════════════════════════ */
.idea-card {
    background: #F8FAFF;
    border: 1.5px solid #DBEAFE;
    border-radius: 14px;
    padding: 18px 20px;
    height: 100%;
    transition: all .2s ease;
}
.idea-card:hover {
    background: #EFF6FF;
    border-color: #93C5FD;
    box-shadow: 0 4px 16px rgba(37,99,235,.08);
}
.idea-title {
    font-size: 14px;
    font-weight: 700;
    color: #0F172A;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
}
.idea-desc {
    font-size: 13px;
    color: #475569;
    line-height: 1.6;
    margin-bottom: 10px;
    font-weight: 400;
}
.idea-impact {
    font-size: 12px;
    color: #2563EB;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* ════════════════════════════════════════════════════════════════
   11. WELCOME / FEATURE CARDS
   ════════════════════════════════════════════════════════════════ */
.feat-card {
    background: #FFFFFF;
    border: 1.5px solid #E2E8F0;
    border-radius: 16px;
    padding: 28px 22px;
    text-align: center;
    box-shadow: 0 1px 4px rgba(15,23,42,.05);
    transition: all .2s ease;
    height: 100%;
}
.feat-card:hover {
    border-color: #BFDBFE;
    box-shadow: 0 6px 24px rgba(37,99,235,.10);
    transform: translateY(-2px);
}
.feat-icon {
    font-size: 32px;
    margin-bottom: 14px;
    display: block;
    line-height: 1;
}
.feat-title {
    font-size: 15px;
    font-weight: 700;
    color: #0F172A;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
}
.feat-desc {
    font-size: 13px;
    color: #64748B;
    line-height: 1.6;
    font-weight: 400;
}

/* ════════════════════════════════════════════════════════════════
   12. BUDGET TIP ROWS
   ════════════════════════════════════════════════════════════════ */
.budget-tip {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: #F0FDF4;
    border: 1.5px solid #BBF7D0;
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 10px;
    font-size: 13.5px;
    color: #14532D;
    line-height: 1.55;
    font-weight: 400;
}
.budget-tip-icon { font-size: 15px; margin-top: 1px; flex-shrink: 0; }

/* ════════════════════════════════════════════════════════════════
   13. VISUAL STYLE CARD
   ════════════════════════════════════════════════════════════════ */
.visual-card {
    background: #FFFFFF;
    border: 1.5px solid #E2E8F0;
    border-radius: 12px;
    padding: 16px 18px;
    margin-top: 14px;
    box-shadow: 0 1px 3px rgba(15,23,42,.04);
}
.visual-card-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94A3B8;
    margin-bottom: 8px;
}
.visual-card-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.visual-pill {
    background: #F1F5F9;
    color: #334155;
    font-size: 12.5px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid #E2E8F0;
}

/* ════════════════════════════════════════════════════════════════
   14. FOOTER
   ════════════════════════════════════════════════════════════════ */
.footer {
    text-align: center;
    color: #CBD5E1;
    font-size: 12px;
    margin-top: 56px;
    padding-top: 20px;
    border-top: 1px solid #F1F5F9;
    line-height: 1.7;
    font-weight: 400;
}
.footer b { color: #94A3B8; }

/* ════════════════════════════════════════════════════════════════
   15. STREAMLIT MARKDOWN HEADINGS
   ════════════════════════════════════════════════════════════════ */
.stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {
    font-family: 'Inter', sans-serif !important;
    letter-spacing: -0.025em !important;
    color: #0F172A !important;
}
.stMarkdown p {
    font-family: 'Inter', sans-serif !important;
    color: #475569 !important;
    line-height: 1.65 !important;
}

/* ════════════════════════════════════════════════════════════════
   16. SCROLLBAR — thin and minimal
   ════════════════════════════════════════════════════════════════ */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# API KEY
# ─────────────────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or st.secrets.get("GOOGLE_API_KEY", "")

# ─────────────────────────────────────────────────────────────────────────────
# DATA LOADERS
# ─────────────────────────────────────────────────────────────────────────────
@st.cache_data
def load_hashtags() -> dict:
    for path in [
        os.path.join("data", "processed", "text", "hashtags_by_topic.json"),
        os.path.join("data", "processed", "hashtags_by_topic.json"),
    ]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return {}

@st.cache_data
def load_image_suggestions() -> pd.DataFrame:
    for path in [
        os.path.join("data", "processed", "text",   "image_dataset_processed.csv"),
        os.path.join("data", "processed", "images", "image_dataset_processed.csv"),
        os.path.join("data", "raw",       "text",   "image_dataset.csv"),
    ]:
        if os.path.exists(path):
            return pd.read_csv(path, encoding="utf-8-sig")
    return pd.DataFrame()

hashtags_db = load_hashtags()
image_df    = load_image_suggestions()

# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    # Brand
    st.markdown("""
    <div class="sidebar-brand">
        <div class="sidebar-brand-icon">🚀</div>
        <span class="sidebar-brand-name">Socialyze</span>
    </div>
    """, unsafe_allow_html=True)

    # Workspace nav
    st.markdown('<div class="sidebar-section">Workspace</div>', unsafe_allow_html=True)
    st.markdown("📊 &nbsp; **All Campaigns**", unsafe_allow_html=True)
    st.markdown("📋 &nbsp; Campaign Brief",   unsafe_allow_html=True)
    st.markdown("🌐 &nbsp; Shared Workspaces", unsafe_allow_html=True)

    st.markdown('<div class="sidebar-section">Library</div>', unsafe_allow_html=True)
    st.markdown("♡ &nbsp; Favourites",  unsafe_allow_html=True)
    st.markdown("📁 &nbsp; Archived",   unsafe_allow_html=True)

    st.markdown("---")
    # Inputs
    st.markdown('<div class="sidebar-section">Campaign Settings</div>', unsafe_allow_html=True)
    brand    = st.text_input("Brand / Company",    placeholder="e.g. Nike, Zomato")
    product  = st.text_input("Product / Service",  placeholder="e.g. Running Shoes")
    goal     = st.text_input("Campaign Goal",       placeholder="e.g. Drive app installs")
    keywords = st.text_input("Keywords / Themes",  placeholder="e.g. fitness, innovation")

    st.markdown('<div class="sidebar-section">Platform &amp; Audience</div>', unsafe_allow_html=True)
    platforms = st.multiselect(
        "Platforms",
        ["Instagram", "Twitter", "LinkedIn", "Facebook", "TikTok"],
        default=["Instagram", "Twitter"],
    )
    tone           = st.selectbox("Tone",     ["Casual", "Professional", "Inspirational", "Humorous", "Urgent"])
    audience       = st.selectbox("Audience", ["Gen Z", "Millennials", "Professionals", "Students", "Parents", "Entrepreneurs"])
    num_variations = st.slider("Variations per Platform", 1, 5, 3)

    st.markdown("")
    generate_btn = st.button("✦ Generate Campaign", use_container_width=True, type="primary")

# ─────────────────────────────────────────────────────────────────────────────
# GEMINI GENERATION
# ─────────────────────────────────────────────────────────────────────────────
def generate_campaign(
    brand, product, goal, platforms, tone, audience, keywords, num_variations
) -> dict | None:
    if not GOOGLE_API_KEY:
        st.error("Gemini API key not found. Add GOOGLE_API_KEY to your .env or Streamlit secrets.")
        return None

    client = genai.Client(api_key=GOOGLE_API_KEY)
    prompt = f"""You are an expert social media marketing strategist.

Generate a complete social media campaign for:
- Brand      : {brand}
- Product    : {product}
- Goal       : {goal}
- Platforms  : {", ".join(platforms)}
- Tone       : {tone}
- Audience   : {audience}
- Keywords   : {keywords or 'None'}
- Variations : {num_variations} per platform

Return ONLY a valid JSON object. No markdown. No extra text.
{{
  "campaign_name": "string",
  "campaign_summary": "string",
  "audience_insight": "string",
  "platforms": {{
    "<platform_name>": {{
      "posts": [
        {{
          "caption": "string",
          "hashtags": ["#tag1", "#tag2"],
          "cta": "string",
          "content_type": "string",
          "best_time": "string"
        }}
      ]
    }}
  }},
  "campaign_ideas": [
    {{"title": "string", "description": "string", "expected_impact": "string"}}
  ],
  "kpis": ["string"],
  "budget_tips": ["string"]
}}"""

    try:
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.9, max_output_tokens=4000),
        )
        text = resp.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except json.JSONDecodeError:
        st.error("Response parsing failed — please try again.")
        return None
    except Exception as exc:
        st.error(f"Generation failed: {exc}")
        return None

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
PLATFORM_ICONS = {
    "Instagram": "📸", "Twitter": "🐦",
    "LinkedIn": "💼",  "Facebook": "👥", "TikTok": "🎵",
}

FRAMEWORKS = [
    ("🤖", "AI Post Generator",    "Multi-platform captions & hashtags"),
    ("🎯", "Audience Targeting",   "Persona-matched messaging strategy"),
    ("💡", "Campaign Ideation",    "Creative concepts & content calendar"),
    ("⚡", "Custom Flow",          "AI-generated bespoke campaign skeleton"),
]

# ─────────────────────────────────────────────────────────────────────────────
# MAIN CONTENT
# ─────────────────────────────────────────────────────────────────────────────

# ── Top bar ───────────────────────────────────────────────────────
st.markdown("""
<div class="top-bar">
    <div>
        <div class="top-bar-title">Socialyze</div>
        <div class="top-bar-sub">Generate posts, captions, hashtags &amp; campaign ideas — powered by Google Gemini 2.0 Flash</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ── Framework / template cards ─────────────────────────────────────
st.markdown("""<div style='font-size:17px;font-weight:700;color:#1E3A5F;margin-bottom:4px;'>Start Generating</div>
<div style='font-size:13px;color:#64748B;margin-bottom:16px;'>Select a campaign framework to get started.</div>""",
    unsafe_allow_html=True)

fw_cols = st.columns(4)
for col, (icon, name, desc) in zip(fw_cols, FRAMEWORKS):
    with col:
        st.markdown(
            f'<div class="fw-card">'
            f'<div class="fw-icon">{icon}</div>'
            f'<div class="fw-name">{name}</div>'
            f'<div class="fw-desc">{desc}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

st.markdown("<br>", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# GENERATE FLOW
# ─────────────────────────────────────────────────────────────────────────────
if generate_btn:
    if not brand or not product or not goal:
        st.warning("Please fill in Brand, Product, and Campaign Goal before generating.")
    elif not platforms:
        st.warning("Please select at least one platform.")
    else:
        with st.spinner("Generating your campaign with Gemini AI..."):
            result = generate_campaign(brand, product, goal, platforms, tone, audience, keywords, num_variations)

        if result:
            # ── Campaign result header card ────────────────────────
            camp_name    = result.get("campaign_name", "Your Campaign")
            camp_summary = result.get("campaign_summary", "")
            audience_ins = result.get("audience_insight", "")
            kpis         = result.get("kpis", [])

            st.markdown(
                f"""
                <div class="camp-card">
                    <div class="camp-thumb">
                        <span class="camp-badge">Generated</span>
                    </div>
                    <div class="camp-body">
                        <div class="camp-title">{camp_name}</div>
                        <div class="camp-summary">{camp_summary}</div>
                        <div class="camp-insight-label">Audience Insight</div>
                        <div class="camp-insight-text">{audience_ins}</div>
                        <div>
                            {" ".join(f'<span class="kpi-pill">{k}</span>' for k in kpis)}
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            # ── Generated posts per platform ───────────────────────
            st.markdown("""
            <div class="section-hdr">
                <span class="section-title">Generated Posts</span>
            </div>
            """, unsafe_allow_html=True)

            tab_labels    = [f"{PLATFORM_ICONS.get(p, '📱')} {p}" for p in platforms]
            tabs          = st.tabs(tab_labels)
            platform_data = result.get("platforms", {})

            for tab, platform in zip(tabs, platforms):
                with tab:
                    p_data = platform_data.get(platform, platform_data.get(platform.lower(), {}))
                    posts  = p_data.get("posts", [])

                    if not posts:
                        st.info(f"No posts generated for {platform}.")
                        continue

                    for i, post in enumerate(posts, 1):
                        tags   = post.get("hashtags", [])
                        tags_s = " ".join(tags) if isinstance(tags, list) else str(tags)
                        st.markdown(
                            f"""
                            <div class="post-card">
                                <div class="post-num">VARIATION {i} &nbsp;·&nbsp; {post.get('content_type','Post').upper()}</div>
                                <div class="post-body">{post.get('caption','')}</div>
                                <div class="post-tags">{tags_s}</div>
                                <div class="post-meta">
                                    📣 {post.get('cta','')} &nbsp;|&nbsp;
                                    🕐 Best time: {post.get('best_time','N/A')}
                                </div>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )

                    # Hashtag suggestions from dataset
                    if hashtags_db and keywords:
                        topic_key = keywords.split(",")[0].strip().title()
                        if topic_key in hashtags_db:
                            st.markdown("**Additional hashtags from dataset:**")
                            st.code(" ".join(hashtags_db[topic_key][:10]), language="text")

                    # Visual style recommendation
                    if not image_df.empty and "platform" in image_df.columns:
                        p_images = image_df[image_df["platform"].str.lower() == platform.lower()]
                        if not p_images.empty:
                            sample = p_images.sample(1).iloc[0]
                            st.markdown(
                                f"""
                                <div class="visual-card">
                                    <div class="visual-card-title">Recommended visual style</div>
                                    <div class="visual-card-row">
                                        <span class="visual-pill">🎨 {sample.get('visual_style','N/A')}</span>
                                        <span class="visual-pill">🎨 {sample.get('color_tone','N/A')}</span>
                                        <span class="visual-pill">✨ {sample.get('mood','N/A')}</span>
                                    </div>
                                </div>
                                """,
                                unsafe_allow_html=True,
                            )

            # ── Campaign ideas ─────────────────────────────────────
            ideas = result.get("campaign_ideas", [])
            if ideas:
                st.markdown("""<br><div class="section-hdr"><span class="section-title">Creative Campaign Ideas</span></div>""",
                    unsafe_allow_html=True)
                idea_cols = st.columns(min(len(ideas), 3))
                for col, idea in zip(idea_cols, ideas):
                    with col:
                        st.markdown(
                            f"""
                            <div class="idea-card">
                                <div class="idea-title">{idea.get('title','')}</div>
                                <div class="idea-desc">{idea.get('description','')}</div>
                                <div class="idea-impact">📈 {idea.get('expected_impact','')}</div>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )

            # ── Budget tips ────────────────────────────────────────
            budget_tips = result.get("budget_tips", [])
            if budget_tips:
                st.markdown("""<br><div class="section-hdr"><span class="section-title">Budget Tips</span></div>""",
                    unsafe_allow_html=True)
                for tip in budget_tips:
                    st.markdown(
                        f'<div class="budget-tip">'
                        f'<span class="budget-tip-icon">✅</span>'
                        f'<span>{tip}</span>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

else:
    # ── Welcome / default state ────────────────────────────────────
    st.markdown("""
    <div class="section-hdr">
        <span class="section-title">Active Campaigns</span>
    </div>
    """, unsafe_allow_html=True)

    welcome_cols = st.columns(3)
    features = [
        ("📱", "5 Platforms",        "Instagram, Twitter, LinkedIn, Facebook, TikTok"),
        ("✍️", "5 Tones",            "Casual, Professional, Inspirational, Humorous, Urgent"),
        ("🤖", "Gemini 2.0 Flash",   "Free API · Structured JSON output · Up to 5 variations"),
    ]
    for col, (icon, title, desc) in zip(welcome_cols, features):
        with col:
            st.markdown(
                f'<div class="feat-card">'
                f'<div class="feat-icon">{icon}</div>'
                f'<div class="feat-title">{title}</div>'
                f'<div class="feat-desc">{desc}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<br>", unsafe_allow_html=True)
    st.info("👈  Fill in the campaign settings on the left sidebar and click **✦ Generate Campaign** to get started.")

# ─────────────────────────────────────────────────────────────────────────────
# FOOTER
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="footer">
    <b>Socialyze</b> — Sourcesys Technologies<br>
    Team: Subasri B &nbsp;·&nbsp; Gautham Krishnan K &nbsp;·&nbsp; Ashwin D &nbsp;·&nbsp; Vinjarapu Ajay Kumar
</div>
""", unsafe_allow_html=True)
