"""
Socialyze
=========
Project Title   : Socialyze
Project Goal    : Generate post variations, captions, hashtags, and campaign
                  ideas for different target audiences across 5 platforms.

Stage 7 — Integration & Deployment (main Streamlit entry point)

LLM Provider : Groq (llama3-70b-8192)

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

Usage:
    pip install -r requirements.txt
    streamlit run streamlit_app/app.py
"""

import os
import json
import pandas as pd
import streamlit as st
from groq import Groq

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
# GLOBAL CSS
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
[data-testid="stAppViewContainer"] { background: #F8FAFC !important; }
[data-testid="stHeader"] { background: transparent !important; box-shadow: none !important; }
[data-testid="block-container"] { padding-top: 24px !important; padding-bottom: 48px !important; }

[data-testid="stSidebar"] {
    background: #FFFFFF !important;
    border-right: 1px solid #E2E8F0 !important;
    padding: 0 !important;
}
[data-testid="stSidebar"] > div:first-child { padding: 24px 20px !important; }

.sidebar-brand { display: flex; align-items: center; gap: 12px; padding-bottom: 24px; margin-bottom: 8px; border-bottom: 1px solid #F1F5F9; }
.sidebar-brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #3B82F6, #0EA5E9); display: flex; align-items: center; justify-content: center; font-size: 17px; box-shadow: 0 2px 8px rgba(59,130,246,.30); flex-shrink: 0; }
.sidebar-brand-name { font-size: 16px; font-weight: 700; color: #0F172A; letter-spacing: -0.01em; }
.sidebar-section { font-size: 10px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: #94A3B8; margin: 24px 0 8px 0; padding-left: 4px; }

.stTextInput > label, .stSelectbox > label, .stMultiSelect > label, .stSlider > label {
    font-size: 12px !important; font-weight: 600 !important; color: #64748B !important;
    letter-spacing: 0.04em !important; text-transform: uppercase !important; margin-bottom: 6px !important;
}
.stTextInput > div > div > input {
    border-radius: 10px !important; border: 1.5px solid #E2E8F0 !important; background: #FAFAFA !important;
    font-size: 13.5px !important; font-family: 'Inter', sans-serif !important; color: #0F172A !important;
    padding: 10px 14px !important; transition: border-color .2s, box-shadow .2s !important;
    box-shadow: 0 1px 2px rgba(15,23,42,.04) !important;
}
.stTextInput > div > div > input:focus {
    border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,.12) !important;
    background: #FFFFFF !important; outline: none !important;
}
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #2563EB, #0EA5E9) !important; color: #FFFFFF !important;
    font-family: 'Inter', sans-serif !important; font-size: 14px !important; font-weight: 600 !important;
    border-radius: 10px !important; padding: 11px 20px !important; border: none !important;
    box-shadow: 0 4px 14px rgba(37,99,235,.35) !important; transition: all .2s ease !important;
}
.stButton > button[kind="primary"]:hover { box-shadow: 0 6px 20px rgba(37,99,235,.45) !important; transform: translateY(-1px) !important; }

.stTabs [data-baseweb="tab-list"] { background: #F1F5F9 !important; border-radius: 10px !important; padding: 4px !important; }
.stTabs [aria-selected="true"] { background: #FFFFFF !important; color: #2563EB !important; font-weight: 600 !important; box-shadow: 0 1px 4px rgba(15,23,42,.10) !important; }

.top-bar { display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-radius: 16px; padding: 20px 28px; margin-bottom: 28px; border: 1px solid #E2E8F0; box-shadow: 0 1px 4px rgba(15,23,42,.05), 0 4px 16px rgba(15,23,42,.04); }
.top-bar-title { font-size: 22px; font-weight: 700; color: #0F172A; letter-spacing: -0.025em; }
.top-bar-sub { font-size: 13.5px; color: #64748B; margin-top: 4px; font-weight: 400; }

.camp-card { background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,.06); margin-bottom: 24px; }
.camp-thumb { height: 100px; background: linear-gradient(135deg, #38BDF8 0%, #2563EB 60%, #1D4ED8 100%); display: flex; align-items: flex-end; padding: 14px 18px; }
.camp-badge { background: rgba(255,255,255,.18); color: #FFFFFF; font-size: 10px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,.30); }
.camp-body { padding: 20px 22px; }
.camp-title { font-size: 17px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
.camp-summary { font-size: 13.5px; color: #475569; line-height: 1.65; margin-bottom: 14px; }

.kpi-pill { display: inline-flex; align-items: center; background: #EFF6FF; color: #2563EB; font-size: 11.5px; font-weight: 600; padding: 5px 13px; border-radius: 20px; border: 1px solid #BFDBFE; margin: 0 6px 6px 0; }

.post-card { background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 20px 22px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(15,23,42,.05); }
.post-num { font-size: 10.5px; font-weight: 700; color: #2563EB; letter-spacing: 0.09em; text-transform: uppercase; margin-bottom: 10px; }
.post-body { font-size: 14px; color: #1E293B; line-height: 1.7; margin-bottom: 12px; }
.post-tags { font-size: 12.5px; color: #3B82F6; margin-bottom: 12px; font-weight: 500; }
.post-meta { font-size: 12px; color: #94A3B8; display: flex; gap: 16px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid #F1F5F9; }

.idea-card { background: #F8FAFF; border: 1.5px solid #DBEAFE; border-radius: 14px; padding: 18px 20px; height: 100%; }
.idea-title { font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
.idea-desc { font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 10px; }
.idea-impact { font-size: 12px; color: #2563EB; font-weight: 600; }

.fw-card { background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 20px 18px; box-shadow: 0 1px 3px rgba(15,23,42,.05); height: 100%; }
.fw-icon { font-size: 24px; margin-bottom: 12px; display: block; }
.fw-name { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 6px; }
.fw-desc { font-size: 12.5px; color: #64748B; line-height: 1.55; }

.feat-card { background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 28px 22px; text-align: center; box-shadow: 0 1px 4px rgba(15,23,42,.05); height: 100%; }
.feat-icon { font-size: 32px; margin-bottom: 14px; display: block; }
.feat-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
.feat-desc { font-size: 13px; color: #64748B; line-height: 1.6; }

.budget-tip { display: flex; align-items: flex-start; gap: 12px; background: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; font-size: 13.5px; color: #14532D; line-height: 1.55; }
.budget-tip-icon { font-size: 15px; margin-top: 1px; flex-shrink: 0; }

.section-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #F1F5F9; }
.section-title { font-size: 17px; font-weight: 700; color: #0F172A; }

.footer { text-align: center; color: #CBD5E1; font-size: 12px; margin-top: 56px; padding-top: 20px; border-top: 1px solid #F1F5F9; line-height: 1.7; }
.footer b { color: #94A3B8; }

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# API KEY  — Groq
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or st.secrets.get("GROQ_API_KEY", "")

# ─────────────────────────────────────────────────────────────────────────────
# ROOT — one level up from streamlit_app/
# ─────────────────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─────────────────────────────────────────────────────────────────────────────
# DATA LOADERS
# ─────────────────────────────────────────────────────────────────────────────
@st.cache_data
def load_hashtags() -> dict:
    for path in [
        os.path.join(ROOT, "data", "processed", "text", "hashtags_by_topic.json"),
        os.path.join(ROOT, "data", "processed", "hashtags_by_topic.json"),
    ]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return {}

@st.cache_data
def load_image_suggestions() -> pd.DataFrame:
    for path in [
        os.path.join(ROOT, "data", "processed", "text",   "image_dataset_processed.csv"),
        os.path.join(ROOT, "data", "processed", "images", "image_dataset_processed.csv"),
        os.path.join(ROOT, "data", "raw",       "text",   "image_dataset.csv"),
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
    st.markdown("""
    <div class="sidebar-brand">
        <div class="sidebar-brand-icon">🚀</div>
        <span class="sidebar-brand-name">Socialyze</span>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<div class="sidebar-section">Workspace</div>', unsafe_allow_html=True)
    st.markdown("📊 &nbsp; **All Campaigns**", unsafe_allow_html=True)
    st.markdown("📋 &nbsp; Campaign Brief",   unsafe_allow_html=True)
    st.markdown("🌐 &nbsp; Shared Workspaces", unsafe_allow_html=True)

    st.markdown('<div class="sidebar-section">Library</div>', unsafe_allow_html=True)
    st.markdown("♡ &nbsp; Favourites",  unsafe_allow_html=True)
    st.markdown("📁 &nbsp; Archived",   unsafe_allow_html=True)

    st.markdown("---")
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
# GROQ GENERATION
# ─────────────────────────────────────────────────────────────────────────────
def generate_campaign(
    brand, product, goal, platforms, tone, audience, keywords, num_variations
) -> dict | None:
    if not GROQ_API_KEY:
        st.error("Groq API key not found. Add GROQ_API_KEY to your .env or Streamlit secrets.")
        return None

    client = Groq(api_key=GROQ_API_KEY)

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
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.9,
            max_tokens=4000,
        )
        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
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
st.markdown("""
<div class="top-bar">
    <div>
        <div class="top-bar-title">Socialyze</div>
        <div class="top-bar-sub">Generate posts, captions, hashtags &amp; campaign ideas — powered by Groq (Llama 3)</div>
    </div>
</div>
""", unsafe_allow_html=True)

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
        with st.spinner("Generating your campaign with Groq AI (Llama 3)..."):
            result = generate_campaign(brand, product, goal, platforms, tone, audience, keywords, num_variations)

        if result:
            camp_name    = result.get("campaign_name", "Your Campaign")
            camp_summary = result.get("campaign_summary", "")
            audience_ins = result.get("audience_insight", "")
            kpis         = result.get("kpis", [])

            st.markdown(
                f"""
                <div class="camp-card">
                    <div class="camp-thumb"><span class="camp-badge">Generated</span></div>
                    <div class="camp-body">
                        <div class="camp-title">{camp_name}</div>
                        <div class="camp-summary">{camp_summary}</div>
                        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin-bottom:6px;">Audience Insight</div>
                        <div style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:16px;">{audience_ins}</div>
                        <div>{" ".join(f'<span class="kpi-pill">{k}</span>' for k in kpis)}</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            st.markdown("""<div class="section-hdr"><span class="section-title">Generated Posts</span></div>""",
                unsafe_allow_html=True)

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

                    if hashtags_db and keywords:
                        topic_key = keywords.split(",")[0].strip().title()
                        if topic_key in hashtags_db:
                            st.markdown("**Additional hashtags from dataset:**")
                            st.code(" ".join(hashtags_db[topic_key][:10]), language="text")

                    if not image_df.empty and "platform" in image_df.columns:
                        p_images = image_df[image_df["platform"].str.lower() == platform.lower()]
                        if not p_images.empty:
                            sample = p_images.sample(1).iloc[0]
                            st.markdown(
                                f"""
                                <div style="background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:12px;padding:16px 18px;margin-top:14px;">
                                    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin-bottom:8px;">Recommended visual style</div>
                                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                                        <span style="background:#F1F5F9;color:#334155;font-size:12.5px;font-weight:500;padding:5px 12px;border-radius:8px;border:1px solid #E2E8F0;">🎨 {sample.get('visual_style','N/A')}</span>
                                        <span style="background:#F1F5F9;color:#334155;font-size:12.5px;font-weight:500;padding:5px 12px;border-radius:8px;border:1px solid #E2E8F0;">🎨 {sample.get('color_tone','N/A')}</span>
                                        <span style="background:#F1F5F9;color:#334155;font-size:12.5px;font-weight:500;padding:5px 12px;border-radius:8px;border:1px solid #E2E8F0;">✨ {sample.get('mood','N/A')}</span>
                                    </div>
                                </div>
                                """,
                                unsafe_allow_html=True,
                            )

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

            budget_tips = result.get("budget_tips", [])
            if budget_tips:
                st.markdown("""<br><div class="section-hdr"><span class="section-title">Budget Tips</span></div>""",
                    unsafe_allow_html=True)
                for tip in budget_tips:
                    st.markdown(
                        f'<div class="budget-tip"><span class="budget-tip-icon">✅</span><span>{tip}</span></div>',
                        unsafe_allow_html=True,
                    )

else:
    st.markdown("""<div class="section-hdr"><span class="section-title">Active Campaigns</span></div>""",
        unsafe_allow_html=True)

    welcome_cols = st.columns(3)
    features = [
        ("📱", "5 Platforms",      "Instagram, Twitter, LinkedIn, Facebook, TikTok"),
        ("✍️", "5 Tones",          "Casual, Professional, Inspirational, Humorous, Urgent"),
        ("🤖", "Groq · Llama 3",   "Free API · Structured JSON output · Up to 5 variations"),
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
