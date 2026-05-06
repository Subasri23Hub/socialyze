"""
Socialyze — Streamlit App
=========================
UI mirrors the Vite / React frontend exactly.
Pixel-perfect rebuild matching all CSS tokens, components, and layout from
frontend/src (App.jsx, Sidebar.jsx, Dashboard.jsx, all pages + components).

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies

v2 additions
------------
• Sign-in / Sign-up / Sign-out with per-account isolated data
• Persistent JSON storage  →  streamlit_app/data/<username>.json
• Save-to-Campaign fully wired in all 4 Dashboard panels + all 4 Workspace panels
• Campaign Brief & Brand/Client Hub data persisted per account
"""

import os, json, re, datetime, hashlib, pathlib
import streamlit as st
from groq import Groq

# ─────────────────────────────────────────────────────────────────────────────
# PAGE CONFIG  (must be first Streamlit call)
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Socialyze",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
# DATA DIRECTORY
# ─────────────────────────────────────────────────────────────────────────────
_APP_DIR  = pathlib.Path(__file__).parent
_DATA_DIR = _APP_DIR / "data"
_DATA_DIR.mkdir(exist_ok=True)

_USERS_FILE = _DATA_DIR / "_users.json"   # {username: hashed_password}

def _load_users():
    if _USERS_FILE.exists():
        try: return json.loads(_USERS_FILE.read_text(encoding="utf-8"))
        except Exception: return {}
    return {}

def _save_users(users: dict):
    _USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")

def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _user_file(username: str) -> pathlib.Path:
    safe = re.sub(r"[^\w\-]", "_", username.lower())
    return _DATA_DIR / f"{safe}.json"

# Default blank user data structure
def _blank_user_data():
    return {
        "brief":           {},
        "brands":          [],
        "content_tasks":   [],
        "fav_ids":         [],
        "archived_ids":    [],
        "saved_campaigns": [],
        "ws_outputs":      {},
        "my_shares":       [],
    }

def _load_user_data(username: str) -> dict:
    fp = _user_file(username)
    if fp.exists():
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            blank = _blank_user_data()
            for k, v in blank.items():
                if k not in data:
                    data[k] = v
            return data
        except Exception:
            return _blank_user_data()
    return _blank_user_data()

def _save_user_data(username: str, data: dict):
    fp = _user_file(username)
    fp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def _flush():
    """Persist current session data to disk for the signed-in user."""
    u = st.session_state.get("auth_user")
    if not u:
        return
    _save_user_data(u, {
        "brief":           st.session_state.brief,
        "brands":          st.session_state.brands,
        "content_tasks":   st.session_state.content_tasks,
        "fav_ids":         st.session_state.fav_ids,
        "archived_ids":    st.session_state.archived_ids,
        "saved_campaigns": st.session_state.saved_campaigns,
        "ws_outputs":      st.session_state.ws_outputs,
        "my_shares":       st.session_state.my_shares,
    })

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL CSS
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,[data-testid="stAppViewContainer"]{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;background:#F5F6FA !important;}
[data-testid="stHeader"]{background:transparent !important;box-shadow:none !important;height:0 !important;}
[data-testid="block-container"]{padding-top:0 !important;padding-bottom:52px !important;max-width:100% !important;}
section.main>div{padding-top:20px !important;}
[data-testid="stAppViewContainer"]>section.main{padding-left:32px !important;padding-right:32px !important;}
[data-testid="stSidebar"]{background:#FFFFFF !important;border-right:1px solid rgba(0,0,0,0.08) !important;min-width:220px !important;max-width:240px !important;}
[data-testid="stSidebar"]>div:first-child{padding:0 !important;}
[data-testid="stSidebar"] section{padding:0 !important;}
[data-testid="stSidebar"] .block-container{padding:0 !important;}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"]{gap:0 !important;}
.sb-brand{display:flex;align-items:center;gap:10px;padding:20px 14px 18px 14px;border-bottom:1px solid rgba(0,0,0,0.07);cursor:pointer;user-select:none;}
.sb-brand-icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#3B6BF5,#0EA5B0);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sb-brand-name{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#0D0F1A;letter-spacing:-0.02em;}
.sb-section{display:block;font-size:9.5px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:#9BA3BB;margin:16px 0 4px 0;padding:0 22px;}
[data-testid="stSidebar"] .stButton>button{display:flex !important;align-items:center !important;gap:9px !important;padding:8px 10px 8px 12px !important;border-radius:8px !important;font-size:13px !important;font-weight:500 !important;color:#5A607A !important;background:transparent !important;border:none !important;box-shadow:none !important;width:100% !important;text-align:left !important;margin-bottom:1px !important;cursor:pointer !important;transition:background 0.13s,color 0.13s !important;justify-content:flex-start !important;line-height:1 !important;}
[data-testid="stSidebar"] .stButton>button:hover{background:#F0F2F8 !important;color:#0D0F1A !important;}
[data-testid="stSidebar"] .stButton>button[kind="primary"]{background:#EBF0FF !important;color:#3B6BF5 !important;font-weight:600 !important;border:none !important;box-shadow:none !important;padding:8px 10px 8px 12px !important;}
.sb-divider{height:1px;background:rgba(0,0,0,0.07);margin:14px 8px;}
.sb-user{display:flex;align-items:center;gap:9px;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);margin:0 8px 12px 8px;cursor:default;}
.sb-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3B6BF5,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;}
.sb-user-name{font-size:12px;font-weight:600;color:#0D0F1A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-user-role{font-size:10.5px;color:#9BA3BB;margin-top:1px;}
.topbar-title{font-family:'Syne',sans-serif;font-size:21px;font-weight:700;color:#0D0F1A;letter-spacing:-0.03em;}
.topbar-sub{font-size:13px;color:#5A607A;margin-top:3px;}
.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:26px;}
.stat-card{background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:16px 18px;}
.stat-label{font-size:11px;color:#9BA3BB;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;}
.stat-value{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0D0F1A;letter-spacing:-0.03em;}
.stat-change{display:inline-flex;align-items:center;font-size:11px;font-weight:600;margin-top:5px;padding:2px 7px;border-radius:5px;}
.stat-up{background:#DCFCE7;color:#15803D;}.stat-down{background:#FEF2F2;color:#B91C1C;}
.sec-title{font-size:13.5px;font-weight:600;color:#0D0F1A;letter-spacing:-0.01em;margin-bottom:4px;}
.sec-sub{font-size:12px;color:#9BA3BB;margin-bottom:14px;}
.active-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0D0F1A;letter-spacing:-0.02em;}
.active-sub{font-size:12px;color:#9BA3BB;font-weight:400;}
.fw-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:28px;}
.fw-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px 16px 14px 16px;cursor:pointer;transition:all 0.18s;}
.fw-card:hover{border-color:#93C5FD;transform:translateY(-2px);box-shadow:0 6px 20px rgba(59,107,245,0.10);}
.fw-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:18px;}
.fw-name{font-size:13.5px;font-weight:600;color:#0D0F1A;margin-bottom:5px;}
.fw-desc{font-size:11.5px;color:#9BA3BB;line-height:1.5;margin-bottom:14px;}
.fw-cta{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);font-size:12px;font-weight:600;color:#3B6BF5;}
.fw-card-wrap{position:relative;}
.fw-card-wrap .stButton{position:relative;margin-top:-1px;}
.fw-card-wrap .stButton>button{background:transparent !important;border:none !important;border-top:1px solid rgba(0,0,0,0.06) !important;border-radius:0 0 12px 12px !important;box-shadow:none !important;color:#3B6BF5 !important;font-size:12px !important;font-weight:600 !important;padding:9px 16px !important;width:100% !important;justify-content:space-between !important;margin-bottom:0 !important;}
.fw-card-wrap .stButton>button:hover{background:#F0F5FF !important;color:#2350D4 !important;}
.fw-card-wrap-outer{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;overflow:hidden;transition:all 0.18s;cursor:pointer;}
.fw-card-wrap-outer:hover{border-color:#93C5FD;transform:translateY(-2px);box-shadow:0 6px 20px rgba(59,107,245,0.10);}
.fw-card-inner{padding:18px 16px 0 16px;}
.camp-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(13,15,26,0.05);transition:box-shadow 0.15s,transform 0.12s;margin-bottom:0;}
.camp-card:hover{box-shadow:0 6px 20px rgba(13,15,26,0.10);transform:translateY(-2px);}
.camp-thumb{height:92px;display:flex;align-items:center;justify-content:center;position:relative;}
.camp-status{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:20px;position:absolute;top:10px;right:12px;}
.camp-initial{font-family:'Syne',sans-serif;font-size:32px;font-weight:700;color:rgba(255,255,255,0.4);line-height:1;user-select:none;}
.camp-body{padding:14px 16px;}
.camp-name{font-size:14px;font-weight:700;color:#0D0F1A;margin-bottom:9px;}
.camp-plat-row{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
.camp-plat-pill{font-size:11px;font-weight:500;padding:3px 9px;border-radius:6px;}
.camp-foot{display:flex;justify-content:space-between;align-items:center;padding-top:9px;border-top:1px solid rgba(0,0,0,0.05);font-size:11.5px;}
.camp-meta{color:#9BA3BB;display:flex;align-items:center;gap:4px;}
.flow-section{margin-bottom:10px;}
.flow-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
.flow-label{font-size:9.5px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#9BA3BB;}
.flow-stage{font-size:9.5px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#3B6BF5;}
.camp-footer-row{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);}
.camp-ago{font-size:11px;color:#9BA3BB;}
.page-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid rgba(0,0,0,0.06);flex-wrap:wrap;gap:12px;}
.page-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0D0F1A;margin-bottom:3px;letter-spacing:-0.02em;}
.page-sub{font-size:13px;color:#5A607A;}
.page-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(59,107,245,0.1);color:#3B6BF5;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(59,107,245,0.18);margin-bottom:8px;}
.saved-badge{display:inline-flex;align-items:center;gap:5px;background:#DCFCE7;color:#15803D;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:1px solid #BBF7D0;}
.search-result-count{font-size:12px;color:#9BA3BB;}
.info-banner{background:#EBF0FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#1E3A5F;line-height:1.6;display:flex;align-items:flex-start;gap:10px;}
.import-banner{background:#F0F9FF;border:1.5px solid #BAE6FD;border-radius:12px;padding:14px 18px;margin-bottom:20px;}
.import-banner-title{font-size:13px;font-weight:600;color:#0369A1;}
.import-banner-sub{font-size:12px;color:#5A607A;}
.save-camp-banner{background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:12px;padding:14px 18px;margin-top:20px;}
.save-camp-title{font-size:13px;font-weight:600;color:#15803D;}
.form-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:28px 30px;box-shadow:0 1px 4px rgba(13,15,26,0.05);margin-bottom:24px;}
.card-title{font-size:15px;font-weight:700;color:#0D0F1A;margin-bottom:18px;}
.gen-panel{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:24px 28px;margin-bottom:24px;box-shadow:0 2px 12px rgba(13,15,26,0.05);}
.gen-panel-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:#0D0F1A;}
.gen-panel-sub{font-size:13px;color:#5A607A;margin-top:3px;}
.result-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:22px 24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(13,15,26,0.04);}
.result-name{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0D0F1A;margin-bottom:6px;}
.result-tagline{font-size:14px;font-style:italic;color:#3B6BF5;margin-bottom:10px;}
.result-summary{font-size:13.5px;color:#5A607A;line-height:1.65;margin-bottom:14px;}
.insight-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9BA3BB;display:block;margin-bottom:4px;}
.insight-text{font-size:13px;color:#334155;line-height:1.6;margin-bottom:10px;}
.kpi-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.kpi-pill{background:#EBF0FF;color:#3B6BF5;font-size:11.5px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid #BFDBFE;}
.post-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.post-num{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#3B6BF5;margin-bottom:6px;}
.post-hook{background:#F8FAFF;border-left:3px solid #3B6BF5;padding:8px 12px;border-radius:0 8px 8px 0;margin-bottom:10px;font-size:13px;color:#1E293B;font-weight:500;}
.hook-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3B6BF5;display:block;margin-bottom:3px;}
.post-caption{font-size:13.5px;color:#1E293B;line-height:1.7;margin-bottom:10px;}
.post-tags{font-size:12.5px;color:#3B82F6;font-weight:500;margin-bottom:12px;}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid rgba(0,0,0,0.05);padding-top:10px;}
.meta-full{grid-column:1/-1;}
.meta-key{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9BA3BB;display:block;margin-bottom:2px;}
.meta-val{font-size:12.5px;color:#334155;}
.idea-card{background:#F8FAFF;border:1.5px solid #DBEAFE;border-radius:14px;padding:18px;margin-bottom:14px;}
.idea-title{font-size:13.5px;font-weight:700;color:#0D0F1A;margin-bottom:7px;}
.idea-desc{font-size:12.5px;color:#5A607A;line-height:1.6;margin-bottom:8px;}
.idea-viral{font-size:12px;color:#7C3AED;margin-bottom:5px;}
.idea-impact{font-size:12px;color:#2563EB;font-weight:600;}
.tip{background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:12px;padding:11px 14px;margin-bottom:8px;font-size:13px;color:#14532D;line-height:1.55;}
.ws-header{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:22px 26px;margin-bottom:24px;box-shadow:0 2px 8px rgba(13,15,26,0.05);}
.ws-camp-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0D0F1A;letter-spacing:-0.03em;margin-bottom:10px;}
.ws-meta-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.ws-status{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 12px;border-radius:20px;}
.ws-plat-pill{font-size:11.5px;font-weight:500;padding:4px 10px;border-radius:8px;background:#F1F5F9;color:#475569;}
.ws-output-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;margin-bottom:14px;box-shadow:0 1px 4px rgba(13,15,26,0.04);overflow:hidden;}
.ws-output-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;}
.ws-output-type{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:8px;}
.ws-timeline-label{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#9BA3BB;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
.ws-output-count{background:#F0F2F8;color:#5A607A;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;}
.kanban-col{background:#F8FAFC;border:1.5px solid rgba(0,0,0,0.07);border-radius:14px;padding:16px;min-height:260px;}
.kanban-col-hdr{display:flex;align-items:center;gap:7px;margin-bottom:14px;}
.kanban-col-label{font-size:13px;font-weight:700;color:#0D0F1A;}
.kanban-col-count{font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;margin-left:auto;}
.kanban-task{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.07);border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.task-title{font-size:13.5px;font-weight:600;color:#0D0F1A;margin-bottom:7px;}
.task-meta{font-size:11px;color:#9BA3BB;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.task-type-pill{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:#EBF0FF;color:#3B6BF5;border:1px solid #BFDBFE;}
.task-plat-pill{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;}
.task-footer{display:flex;gap:12px;margin-top:8px;font-size:11.5px;color:#9BA3BB;align-items:center;}
.task-empty{font-size:12.5px;color:#CBD5E1;text-align:center;padding:24px 0;}
.brand-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(13,15,26,0.05);transition:box-shadow 0.15s,transform 0.12s;margin-bottom:16px;}
.brand-card:hover{box-shadow:0 4px 16px rgba(13,15,26,0.09);transform:translateY(-1px);}
.brand-top{height:72px;display:flex;align-items:center;justify-content:center;}
.brand-inits{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;}
.brand-body{padding:14px 16px;}
.brand-name{font-size:14px;font-weight:700;color:#0D0F1A;margin-bottom:3px;}
.brand-industry{font-size:12px;color:#5A607A;margin-bottom:8px;}
.brand-plat-row{display:flex;flex-wrap:wrap;gap:4px;}
.brand-plat-pill{font-size:10.5px;font-weight:500;padding:2px 8px;border-radius:6px;background:#F1F5F9;color:#475569;}
.compliance-step-block{margin-bottom:20px;}
.compliance-step-label{font-size:11px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#5A607A;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.compliance-step-num{width:20px;height:20px;border-radius:50%;background:#3B6BF5;color:#FFFFFF;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
.score-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:20px 22px;margin-bottom:18px;display:flex;align-items:center;gap:20px;}
.score-value{font-family:'Syne',sans-serif;font-size:36px;font-weight:700;line-height:1;}
.score-green{color:#16A34A;}.score-amber{color:#D97706;}.score-red{color:#DC2626;}
.score-label{font-size:11px;color:#9BA3BB;text-transform:uppercase;letter-spacing:0.07em;}
.risk-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:12px;}
.risk-high{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;}
.risk-medium{background:#FFF7ED;color:#D97706;border:1px solid #FED7AA;}
.risk-low{background:#DCFCE7;color:#16A34A;border:1px solid #BBF7D0;}
.check-item{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-bottom:1px solid rgba(0,0,0,0.05);}
.check-label{font-size:13px;font-weight:600;color:#0D0F1A;margin-bottom:2px;}
.check-msg{font-size:12px;color:#5A607A;line-height:1.5;}
.rule-preview{background:#F8FAFC;border-radius:12px;padding:16px 18px;margin-top:16px;}
.rule-preview-title{font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;margin-bottom:8px;}
.rule-preview-item{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#5A607A;margin-bottom:5px;}
.rule-preview-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.share-form-wrap{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:28px 30px;box-shadow:0 1px 4px rgba(13,15,26,0.05);max-width:600px;}
.share-form-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0D0F1A;margin-bottom:4px;}
.share-form-sub{font-size:13px;color:#5A607A;line-height:1.6;margin-bottom:20px;}
.share-row-card{display:flex;align-items:center;gap:14px;background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;padding:14px 18px;margin-bottom:10px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.share-avatar-sm{width:36px;height:36px;border-radius:50%;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.share-email{font-size:13.5px;font-weight:600;color:#0D0F1A;}
.share-camp-name{font-size:12px;color:#5A607A;margin-top:2px;}
.perm-badge-view{background:#EBF0FF;color:#3B6BF5;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;border:1px solid #BFDBFE;}
.perm-badge-edit{background:#FFF7ED;color:#EA580C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;border:1px solid #FED7AA;}
.feature-list{margin-top:20px;border-top:1px solid rgba(0,0,0,0.07);padding-top:16px;}
.feature-item{display:flex;gap:10px;font-size:12.5px;color:#5A607A;margin-bottom:8px;align-items:flex-start;}
.member-card{display:flex;align-items:center;gap:14px;background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px 22px;margin-bottom:20px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.member-avatar{width:44px;height:44px;border-radius:50%;background:#EBF0FF;color:#3B6BF5;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.member-name{font-size:14.5px;font-weight:700;color:#0D0F1A;}
.member-email{font-size:12.5px;color:#5A607A;margin-top:2px;}
.role-badge{margin-left:auto;background:#F1F5F9;color:#475569;font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.08);}
.coming-soon-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:32px 30px;box-shadow:0 2px 8px rgba(13,15,26,0.05);margin-top:20px;}
.creator-result-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:22px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.creator-content{font-size:13.5px;color:#334155;line-height:1.75;white-space:pre-wrap;}
.empty-state{text-align:center;padding:48px 20px;}
.empty-icon{font-size:36px;margin-bottom:12px;}
.empty-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0D0F1A;margin-bottom:6px;}
.empty-sub{font-size:13px;color:#9BA3BB;}
.footer{text-align:center;color:#C4C9D9;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.06);line-height:1.7;}
.stButton>button[kind="primary"]{background:#3B6BF5 !important;color:#FFFFFF !important;font-weight:600 !important;font-size:13px !important;border-radius:9px !important;padding:9px 18px !important;border:none !important;box-shadow:none !important;}
.stButton>button[kind="primary"]:hover{opacity:0.88 !important;}
.stButton>button[kind="secondary"]{border-radius:9px !important;font-size:13px !important;font-weight:500 !important;padding:8px 16px !important;border:1.5px solid rgba(0,0,0,0.12) !important;background:#FFFFFF !important;color:#5A607A !important;box-shadow:none !important;}
.stTabs [data-baseweb="tab-list"]{background:#F0F2F8 !important;border-radius:10px !important;padding:4px !important;gap:2px !important;}
.stTabs [data-baseweb="tab"]{border-radius:7px !important;font-size:13px !important;font-weight:500 !important;padding:7px 16px !important;color:#5A607A !important;}
.stTabs [aria-selected="true"]{background:#FFFFFF !important;color:#3B6BF5 !important;font-weight:600 !important;box-shadow:0 1px 4px rgba(13,15,26,0.10) !important;}
.stTextInput>label,.stSelectbox>label,.stTextArea>label,.stSlider>label,.stMultiSelect>label,.stDateInput>label,.stTimeInput>label{font-size:11.5px !important;font-weight:600 !important;color:#5A607A !important;letter-spacing:0.05em !important;text-transform:uppercase !important;}
.stTextInput>div>div>input,.stTextArea textarea{border-radius:10px !important;border:1.5px solid rgba(0,0,0,0.12) !important;background:#FAFAFA !important;font-size:13.5px !important;color:#0D0F1A !important;padding:10px 14px !important;}
.stTextInput>div>div>input:focus,.stTextArea textarea:focus{border-color:#3B6BF5 !important;box-shadow:0 0 0 3px rgba(59,107,245,0.12) !important;background:#FFFFFF !important;outline:none !important;}
::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:10px;}
@media(max-width:900px){.fw-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
/* Auth page */
.auth-wrap{max-width:440px;margin:60px auto 0;}
.auth-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:20px;padding:36px 36px 28px;box-shadow:0 4px 24px rgba(13,15,26,0.08);}
.auth-logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;}
.auth-logo-icon{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#3B6BF5,#0EA5B0);display:flex;align-items:center;justify-content:center;}
.auth-logo-name{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0D0F1A;}
.auth-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0D0F1A;margin-bottom:6px;}
.auth-sub{font-size:13px;color:#5A607A;margin-bottom:24px;}
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# GROQ
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or st.secrets.get("GROQ_API_KEY", "")
MODEL = "llama-3.3-70b-versatile"

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
PLATFORMS  = ["Instagram", "Twitter", "LinkedIn", "Facebook", "TikTok", "YouTube"]
TONES      = ["Casual", "Professional", "Inspirational", "Humorous", "Urgent", "Bold", "Empathetic", "Witty"]
AUDIENCES  = ["Gen Z", "Millennials", "Professionals", "Students", "Parents", "Entrepreneurs", "Executives", "Creators"]
CAMP_TYPES = ["Product Launch", "Brand Awareness", "Lead Generation", "Engagement Boost",
              "Content Promotion", "Seasonal Sale", "Event Promotion", "Rebranding"]
INDUSTRIES = ["E-Commerce", "Fashion & Apparel", "Food & Beverage", "Health & Wellness",
              "Technology", "Finance & Fintech", "Real Estate", "Education",
              "Travel & Hospitality", "Entertainment & Media", "Beauty & Personal Care",
              "Automotive", "Non-Profit", "Professional Services", "Sports & Fitness", "Other"]
BRAND_COLORS = ["#3B6BF5", "#16A34A", "#EA580C", "#9333EA", "#BE123C", "#0369A1", "#D97706", "#0F766E"]
THUMB_GRADS = [
    "linear-gradient(135deg,#38BDF8 0%,#3B6BF5 60%,#6366F1 100%)",
    "linear-gradient(135deg,#34D399 0%,#0EA5B0 60%,#0EA5E9 100%)",
    "linear-gradient(135deg,#F472B6 0%,#C084FC 60%,#818CF8 100%)",
    "linear-gradient(135deg,#FB923C 0%,#F59E0B 60%,#EAB308 100%)",
]
PLATFORM_STYLE = {
    "Instagram": {"bg": "#FDF2F8", "color": "#9D174D"},
    "Twitter":   {"bg": "#EFF6FF", "color": "#1D4ED8"},
    "LinkedIn":  {"bg": "#EFF9FF", "color": "#0369A1"},
    "Facebook":  {"bg": "#EFF6FF", "color": "#1E40AF"},
    "TikTok":    {"bg": "#FEF2F2", "color": "#991B1B"},
    "YouTube":   {"bg": "#FEF2F2", "color": "#991B1B"},
}
PLATFORM_RULES = {
    "Instagram": [
        ("caption_length",  "Caption length",       lambda t: len(t) <= 2200, "Caption exceeds 2,200 chars."),
        ("hashtag_count",   "Hashtag count",         lambda t: len([w for w in t.split() if w.startswith("#")]) <= 30, "More than 30 hashtags — Instagram may block the post."),
        ("no_external_link","No clickable links",    lambda t: "http" not in t, "External links aren't clickable. Use 'link in bio'."),
        ("has_cta",         "Has a call-to-action",  lambda t: any(w in t.lower() for w in ["link in bio","swipe","tap","shop","save","follow","comment","share","dm","click"]), "No clear CTA found."),
        ("no_banned_tags",  "No banned hashtags",    lambda t: not any(w in t.lower() for w in ["like4like","followforfollow","l4l","f4f"]), "Banned hashtags detected."),
    ],
    "Twitter": [
        ("tweet_length",    "Tweet length",          lambda t: len(t) <= 280,  "Tweet exceeds 280 characters."),
        ("hashtag_max",     "Hashtag count ≤ 2",     lambda t: len([w for w in t.split() if w.startswith("#")]) <= 2, "More than 2 hashtags reduces engagement."),
        ("has_hook",        "Strong opening hook",   lambda t: not t.lower().startswith(("hey ", "hi ", "hello ")), "Weak opener."),
    ],
    "LinkedIn": [
        ("post_length",     "Post length ≤ 3,000",   lambda t: len(t) <= 3000, "LinkedIn truncates at 3,000 chars."),
        ("hashtag_count",   "Hashtag count ≤ 5",     lambda t: len([w for w in t.split() if w.startswith("#")]) <= 5, "More than 5 hashtags is spammy."),
        ("professional_tone","Professional tone",    lambda t: not any(w in t.lower() for w in ["wtf","omg","lol"]), "Casual slang detected."),
        ("has_cta",         "Has a call-to-action",  lambda t: any(w in t.lower() for w in ["connect","comment","thoughts","share","follow","dm","learn more"]), "No engagement invitation found."),
    ],
    "Facebook": [
        ("post_length",     "Post length",           lambda t: len(t) <= 63206, "Exceeds Facebook's limit."),
        ("optimal_len",     "Optimal length",        lambda t: len(t) <= 500,   "Posts over 500 chars see lower reach."),
        ("has_cta",         "Has a call-to-action",  lambda t: any(w in t.lower() for w in ["share","like","comment","click","visit","learn","shop"]), "No CTA found."),
    ],
    "TikTok": [
        ("caption_length",  "Caption length",        lambda t: len(t) <= 2200, "Caption too long."),
        ("hashtag_range",   "3–8 hashtags",          lambda t: 3 <= len([w for w in t.split() if w.startswith("#")]) <= 8, "Use 3–8 hashtags."),
        ("has_hook",        "Strong opening",        lambda t: len(t.strip()) > 10, "Caption too short."),
    ],
    "YouTube": [
        ("title_length",    "Title ≤ 100 chars",     lambda t: len(t) <= 100, "Title too long."),
        ("has_keywords",    "Contains keywords",     lambda t: len(t.split()) >= 5, "Description too short."),
        ("has_cta",         "Has a call-to-action",  lambda t: any(w in t.lower() for w in ["subscribe","like","comment","watch","click","check out","learn more"]), "No CTA detected."),
    ],
}
STATUS_COLORS = {
    "Draft":     {"bg": "#F1F5F9", "color": "#475569"},
    "Active":    {"bg": "#DCFCE7", "color": "#15803D"},
    "In Review": {"bg": "#FEF9C3", "color": "#A16207"},
    "Paused":    {"bg": "#FEF2F2", "color": "#B91C1C"},
    "Completed": {"bg": "#EFF9FF", "color": "#0369A1"},
}
KANBAN_COLS = [
    {"id": "Planned",     "label": "Planned",     "color": "#3B6BF5", "bg": "#EBF0FF"},
    {"id": "In Progress", "label": "In Progress", "color": "#D97706", "bg": "#FEF3C7"},
    {"id": "Completed",   "label": "Completed",   "color": "#16A34A", "bg": "#DCFCE7"},
]
WS_PANELS = [
    {"id": "ai",       "label": "⚡ AI Post Generator",  "color": "#3B6BF5", "bg": "#EBF0FF"},
    {"id": "audience", "label": "👥 Audience Targeting", "color": "#16A34A", "bg": "#F0FDF4"},
    {"id": "ideation", "label": "💡 Campaign Ideation",  "color": "#EA580C", "bg": "#FFF7ED"},
    {"id": "custom",   "label": "⚙ Custom Flow",         "color": "#9333EA", "bg": "#FDF4FF"},
]
FLOW_CONFIGS = [
    {"stage": "Foundation",       "points": "0,30 40,30 80,29 120,29 160,28 200,28"},
    {"stage": "Foundation",       "points": "0,30 50,28 100,27 150,26 200,24"},
    {"stage": "Building",         "points": "0,30 35,26 70,28 110,20 150,22 200,14"},
    {"stage": "Building",         "points": "0,30 30,24 65,26 95,16 130,18 170,10 200,8"},
    {"stage": "Peak",             "points": "0,28 30,20 55,22 80,10 110,14 145,4 175,6 200,2"},
    {"stage": "Sustained Impact", "points": "0,26 25,16 50,18 75,8 100,12 130,4 160,6 185,3 200,2"},
]

# ─────────────────────────────────────────────────────────────────────────────
# AUTH — SIGN IN / SIGN UP PAGE
# ─────────────────────────────────────────────────────────────────────────────
SVG_BOLT = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
            'stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>')

def page_auth():
    st.markdown('<div class="auth-wrap">', unsafe_allow_html=True)
    st.markdown(
        f'<div class="auth-card">'
        f'<div class="auth-logo">'
        f'<div class="auth-logo-icon">{SVG_BOLT}</div>'
        f'<span class="auth-logo-name">Socialyze</span>'
        f'</div>',
        unsafe_allow_html=True)

    tab_signin, tab_signup = st.tabs(["Sign In", "Create Account"])

    with tab_signin:
        st.markdown('<div class="auth-title">Welcome back</div>'
                    '<div class="auth-sub">Sign in to your Socialyze account.</div>', unsafe_allow_html=True)
        si_user = st.text_input("Username", key="si_user", placeholder="yourname")
        si_pass = st.text_input("Password", key="si_pass", type="password", placeholder="••••••••")
        if st.button("Sign In →", type="primary", use_container_width=True, key="si_btn"):
            users = _load_users()
            if si_user.strip() and si_pass:
                if si_user.strip() in users and users[si_user.strip()] == _hash_pw(si_pass):
                    _do_login(si_user.strip())
                else:
                    st.error("Invalid username or password.")
            else:
                st.warning("Please enter your username and password.")

    with tab_signup:
        st.markdown('<div class="auth-title">Create account</div>'
                    '<div class="auth-sub">Join Socialyze — free, no credit card needed.</div>', unsafe_allow_html=True)
        su_user = st.text_input("Choose a username", key="su_user", placeholder="yourname")
        su_pass = st.text_input("Create a password", key="su_pass", type="password", placeholder="••••••••")
        su_pass2 = st.text_input("Confirm password",  key="su_pass2", type="password", placeholder="••••••••")
        if st.button("Create Account →", type="primary", use_container_width=True, key="su_btn"):
            users = _load_users()
            un = su_user.strip()
            if not un:
                st.warning("Username is required.")
            elif len(un) < 3:
                st.warning("Username must be at least 3 characters.")
            elif re.search(r"[^\w\-]", un):
                st.warning("Username can only contain letters, numbers, _ and -.")
            elif un in users:
                st.error("That username is already taken. Try another.")
            elif len(su_pass) < 6:
                st.warning("Password must be at least 6 characters.")
            elif su_pass != su_pass2:
                st.error("Passwords don't match.")
            else:
                users[un] = _hash_pw(su_pass)
                _save_users(users)
                _do_login(un)

    st.markdown("</div></div>", unsafe_allow_html=True)

def _do_login(username: str):
    """Load user data into session and mark as authenticated."""
    data = _load_user_data(username)
    st.session_state.auth_user        = username
    st.session_state.brief            = data["brief"]
    st.session_state.brands           = data["brands"]
    st.session_state.content_tasks    = data["content_tasks"]
    st.session_state.fav_ids          = data["fav_ids"]
    st.session_state.archived_ids     = data["archived_ids"]
    st.session_state.saved_campaigns  = data["saved_campaigns"]
    st.session_state.ws_outputs       = data["ws_outputs"]
    st.session_state.my_shares        = data["my_shares"]
    # UI state (not persisted)
    st.session_state.page             = "campaigns"
    st.session_state.active_panel     = None
    st.session_state.workspace_id     = None
    st.session_state.gen_result       = None
    st.session_state.audience_result  = None
    st.session_state.ideation_result  = None
    st.session_state.custom_result    = None
    st.session_state.creator_result   = None
    st.session_state.quick_result     = None
    st.session_state.quick_input      = ""
    st.session_state.compliance_text  = ""
    st.session_state.compliance_platform = "Instagram"
    st.session_state.compliance_result  = None
    st.session_state.compliance_checked = False
    st.session_state.ws_panel          = None
    st.session_state.ws_gen_result     = None
    st.session_state.ws_aud_result     = None
    st.session_state.ws_ide_result     = None
    st.session_state.ws_cus_result     = None
    st.session_state.ws_expanded       = {}
    st.session_state.planner_show_form = False
    st.session_state.shared_tab        = "incoming"
    st.session_state.sw_perm           = "view"
    # Sync tone picker with saved brief
    st.session_state.br_selected_tone  = data["brief"].get("tone", "Inspirational")
    st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def hash_grad(s):
    h = 0
    for c in (s or "x"):
        h = (h * 31 + ord(c)) & 0xFFFF
    return THUMB_GRADS[h % len(THUMB_GRADS)]

def cap_first(s):
    return s[:1].upper() + s[1:] if s else s

def brand_inits(name):
    words = name.strip().split()
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return name[:2].upper() if len(name) >= 2 else name.upper()

def avatar_color(email):
    palette = [("#EBF0FF","#3B6BF5"),("#F0FDF4","#16A34A"),("#FFF7ED","#EA580C"),
               ("#FDF4FF","#9333EA"),("#FFF1F2","#BE123C")]
    h = 0
    for c in email:
        h = (h * 31 + ord(c)) & 0xFFFF
    return palette[h % len(palette)]

def call_groq(prompt, max_tokens=2500):
    if not GROQ_API_KEY:
        st.error("Groq API key not found. Add GROQ_API_KEY to your .env or Streamlit secrets.")
        return None
    try:
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.9,
            max_tokens=max_tokens,
        )
        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        s = text.find("{"); e = text.rfind("}") + 1
        if s != -1 and e > s:
            text = text[s:e]
        return json.loads(text)
    except json.JSONDecodeError:
        st.error("Response parsing failed — please try again.")
        return None
    except Exception as exc:
        st.error(f"Generation failed: {exc}")
        return None

def get_flow_config(n):
    idx = min(max(n, 0), 5)
    return FLOW_CONFIGS[idx]

def _nav_page(page_id):
    st.session_state.page = page_id
    st.session_state.active_panel = None
    st.session_state.workspace_id = None
    st.rerun()

def open_workspace(campaign_id):
    st.session_state.workspace_id  = campaign_id
    st.session_state.ws_panel      = None
    st.session_state.ws_gen_result = None
    st.session_state.ws_aud_result = None
    st.session_state.ws_ide_result = None
    st.session_state.ws_cus_result = None
    st.rerun()

def close_workspace():
    st.session_state.workspace_id = None
    st.session_state.ws_panel     = None
    st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# IMPORT / SAVE HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _write_prefill_to_widgets(panel_key, prefill):
    """Store prefill as pending. _apply_pending_prefill() reads it at the TOP
    of each panel function BEFORE widgets are created — so it always works."""
    st.session_state[f"_pending_{panel_key}"] = prefill


def _apply_pending_prefill(panel_key):
    """Call this at the very top of every panel function (before any widget).
    Writes prefill values into widget session state keys so fields show data."""
    pkey = f"_pending_{panel_key}"
    if pkey not in st.session_state:
        return
    prefill  = st.session_state.pop(pkey)
    pk       = panel_key
    brand    = prefill.get("brand","")
    product  = prefill.get("product","")
    goal     = prefill.get("goal","")
    audience = prefill.get("audience","")
    tone     = prefill.get("tone","Inspirational")
    platforms= prefill.get("platforms",[])

    CI_TONES = ["Casual","Professional","Inspirational","Humorous","Urgent",
                "Playful","Bold","Empathetic","Witty","Provocative"]
    CF_TONES = ["Casual","Professional","Inspirational","Humorous","Urgent",
                "Bold","Empathetic","Provocative","Witty"]

    KEY_MAP = {
        "gp":    {"brand":"gp_brand",     "product":"gp_product",   "goal":"gp_goal",    "audience":"gp_aud",    "tone":("gp_tone",    TONES)},
        "at":    {"brand":"at_brand",     "product":"at_product",   "goal":"at_objective","audience":None,        "tone":None},
        "ci":    {"brand":"ci_brand",     "product":"ci_product",   "goal":"ci_goal",    "audience":"ci_audience","tone":("ci_tone",    CI_TONES)},
        "cf":    {"brand":"cf_brand",     "product":"cf_product",   "goal":"cf_bizobj",  "audience":"cf_audience","tone":("cf_tone",    CF_TONES)},
        "ws_gp": {"brand":"ws_gp_brand",  "product":"ws_gp_product","goal":"ws_gp_goal", "audience":None,        "tone":("ws_gp_tone", TONES)},
        "ws_at": {"brand":"ws_at_brand",  "product":"ws_at_product","goal":"ws_at_goal", "audience":None,        "tone":None},
        "ws_ci": {"brand":"ws_ci_brand",  "product":"ws_ci_product","goal":"ws_ci_goal", "audience":None,        "tone":("ws_ci_tone", TONES)},
        "ws_cf": {"brand":"ws_cf_brand",  "product":"ws_cf_product","goal":"ws_cf_goal", "audience":None,        "tone":None},
        "cs":    {"brand":"cs_brand",     "product":"cs_product",   "goal":None,         "audience":None,        "tone":("cs_tone",    TONES)},
    }
    km = KEY_MAP.get(pk, {})
    if km.get("brand")    and brand:    st.session_state[km["brand"]]    = brand
    if km.get("product")  and product:  st.session_state[km["product"]]  = product
    if km.get("goal")     and goal:     st.session_state[km["goal"]]     = goal
    if km.get("audience") and audience: st.session_state[km["audience"]] = audience
    if pk == "at" and goal:             st.session_state["at_objective"] = goal

    tone_info = km.get("tone")
    if tone_info:
        tone_key, tone_list = tone_info
        if tone in tone_list:
            st.session_state[tone_key] = tone

    if platforms:
        for p in PLATFORMS:
            if   pk in ("gp","ws_gp"): st.session_state[f"{pk}_p_{p}"] = p in platforms
            elif pk == "cf":           st.session_state[f"cf_p_{p}"]    = p in platforms


def render_import_strip(panel_key):
    brief  = st.session_state.brief
    brands = st.session_state.brands
    has_brief  = bool(brief.get("brand_name"))
    has_brands = bool(brands)
    st.markdown(
        '<div class="import-banner">'
        '<div class="import-banner-title">📥 Import Data</div>'
        '<div class="import-banner-sub">Pre-fill from your saved Campaign Brief or Brand &amp; Client Hub.</div>'
        '</div>',
        unsafe_allow_html=True,
    )
    col_a, col_b = st.columns([1, 1])
    cur_src   = st.session_state.get(f"{panel_key}_imported")
    cur_brand = st.session_state.get(f"{panel_key}_imported_brand","")
    if cur_src == "brief":
        st.markdown('<div style="background:#DCFCE7;border:1px solid #BBF7D0;border-radius:8px;'
                    'padding:6px 12px;font-size:12px;font-weight:600;color:#15803D;margin-bottom:8px">'
                    '✓ Pre-filled from Campaign Brief</div>', unsafe_allow_html=True)
    elif cur_src == "brand" and cur_brand:
        st.markdown(f'<div style="background:#EBF0FF;border:1px solid #BFDBFE;border-radius:8px;'
                    f'padding:6px 12px;font-size:12px;font-weight:600;color:#3B6BF5;margin-bottom:8px">'
                    f'✓ Pre-filled from brand: {cur_brand}</div>', unsafe_allow_html=True)
    with col_a:
        if st.button(
            "📋 From Campaign Brief" if has_brief else "📋 Brief (empty)",
            key=f"import_brief_{panel_key}", use_container_width=True,
            type="primary" if has_brief else "secondary", disabled=not has_brief,
        ):
            st.session_state[f"{panel_key}_imported"] = "brief"
            _write_prefill_to_widgets(panel_key, {
                "brand":    brief.get("brand_name",""),
                "product":  brief.get("product_service",""),
                "goal":     brief.get("campaign_goal",""),
                "audience": brief.get("target_audience",""),
                "tone":     brief.get("tone","Inspirational"),
                "platforms": brief.get("platforms",[]),
            })
            st.rerun()
    with col_b:
        brand_names = ["— select brand —"] + [b["name"] for b in brands]
        bsel = st.selectbox("Brand", options=brand_names,
                            key=f"import_brand_sel_{panel_key}",
                            label_visibility="collapsed") if has_brands else None
        if st.button("🏢 From Brand Hub", key=f"import_brand_{panel_key}",
                     use_container_width=True,
                     type="primary" if (has_brands and bsel and bsel != "— select brand —") else "secondary",
                     disabled=not has_brands):
            if bsel and bsel != "— select brand —":
                b = next((x for x in brands if x["name"] == bsel), None)
                if b:
                    tone_map = {"Professional":"Professional","Casual & Friendly":"Casual",
                                "Inspirational":"Inspirational","Witty & Humorous":"Humorous",
                                "Bold & Edgy":"Bold","Empathetic":"Empathetic",
                                "Luxury & Sophisticated":"Professional","Educational":"Professional",
                                "Witty":"Witty","Urgent":"Urgent","Humorous":"Humorous","Bold":"Bold"}
                    plat_norm = {"Twitter / X":"Twitter","Twitter/X":"Twitter","Instagram":"Instagram",
                                 "LinkedIn":"LinkedIn","Facebook":"Facebook","TikTok":"TikTok",
                                 "YouTube":"YouTube","Pinterest":"Pinterest","Threads":"Threads"}
                    norm_plats = []
                    for p in b.get("platforms",[]):
                        n2 = plat_norm.get(p, p.replace(" / X","").replace("/X",""))
                        if n2 in PLATFORMS: norm_plats.append(n2)
                    st.session_state[f"{panel_key}_imported_brand"] = bsel
                    st.session_state[f"{panel_key}_imported"] = "brand"
                    _write_prefill_to_widgets(panel_key, {
                        "brand":    b.get("name",""),
                        "product":  (b.get("notes","") or "")[:80],
                        "goal":     "Build brand awareness and grow audience",
                        "audience": "Millennials",
                        "tone":     tone_map.get(b.get("tone",""),"Inspirational"),
                        "platforms": norm_plats,
                    })
                    st.rerun()

def get_panel_prefill(panel_key):
    brief  = st.session_state.brief
    brands = st.session_state.brands
    source = st.session_state.get(f"{panel_key}_imported")
    if source == "brief":
        return {"brand": brief.get("brand_name",""), "product": brief.get("product_service",""),
                "goal": brief.get("campaign_goal",""), "audience": brief.get("target_audience",""),
                "tone": brief.get("tone","Inspirational"), "platforms": brief.get("platforms",[])}
    elif source == "brand":
        bname = st.session_state.get(f"{panel_key}_imported_brand","")
        b = next((x for x in brands if x["name"] == bname), None)
        if b:
            tone_map = {"Professional":"Professional","Casual & Friendly":"Casual",
                        "Inspirational":"Inspirational","Witty & Humorous":"Humorous",
                        "Bold & Edgy":"Bold","Empathetic":"Empathetic",
                        "Luxury & Sophisticated":"Professional","Educational":"Professional",
                        "Witty":"Witty","Urgent":"Urgent","Humorous":"Humorous","Bold":"Bold"}
            plat_norm = {
                "Twitter / X":"Twitter","Twitter/X":"Twitter","Twitter / x":"Twitter",
                "Instagram":"Instagram","LinkedIn":"LinkedIn","Facebook":"Facebook",
                "TikTok":"TikTok","YouTube":"YouTube","Pinterest":"Pinterest","Threads":"Threads",
            }
            norm_plats = []
            for p in b.get("platforms",[]):
                n2 = plat_norm.get(p, p.replace(" / X","").replace(" /X","").replace("/X",""))
                if n2 in PLATFORMS: norm_plats.append(n2)
            product_val = (b.get("notes","") or "")[:80]
            return {"brand": b.get("name",""), "product": product_val,
                    "goal": "Build brand awareness and grow audience",
                    "audience": "Millennials",
                    "tone": tone_map.get(b.get("tone",""),"Inspirational"),
                    "platforms": norm_plats}
    return {}

def render_save_to_campaign(panel_key, brand, platforms, tone, output_count=1, result_data=None):
    """Save button shown below any panel result. Persists to file."""
    st.markdown('<div class="save-camp-banner">', unsafe_allow_html=True)
    col_a, col_b = st.columns([3, 1])
    with col_a:
        st.markdown(
            '<div class="save-camp-title">💾 Save to Campaign</div>'
            '<div style="font-size:12px;color:#5A607A">Save this output to your Campaigns library.</div>',
            unsafe_allow_html=True)
    with col_b:
        if st.button("Save ✓", key=f"save_camp_{panel_key}", type="primary", use_container_width=True):
            cid = len(st.session_state.saved_campaigns)
            campaign_entry = {
                "id": cid,
                "campaign_name": (brand or "Campaign").lower(),
                "tone": tone,
                "platforms": platforms,
                "status": "Active",
                "output_count": output_count,
                "ago": "Just now",
            }
            st.session_state.saved_campaigns.insert(0, campaign_entry)
            if result_data is not None:
                key = str(cid)
                if key not in st.session_state.ws_outputs:
                    st.session_state.ws_outputs[key] = []
                output_type = "ai"
                if "audience" in panel_key or panel_key == "at":
                    output_type = "audience"
                elif "ideation" in panel_key or panel_key == "ci":
                    output_type = "ideation"
                elif "custom" in panel_key or panel_key == "cf":
                    output_type = "custom"
                st.session_state.ws_outputs[key].insert(0, {
                    "type": output_type,
                    "data": result_data,
                    "saved_at": datetime.datetime.now().strftime("%d %b %Y, %I:%M %p"),
                })
            _flush()
            st.success(f"✓ Saved '{cap_first(brand or 'Campaign')}' to your campaigns!")
    st.markdown("</div>", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# CAMPAIGN CARD HTML  — no fake HTML button inside
# ─────────────────────────────────────────────────────────────────────────────
def campaign_card_html(c):
    name   = cap_first(c.get("campaign_name", "Campaign"))
    status = c.get("status", "Draft")
    plats  = c.get("platforms", [])
    grad   = hash_grad(c.get("campaign_name", ""))
    sc     = STATUS_COLORS.get(status, STATUS_COLORS["Draft"])
    oc     = c.get("output_count", 0)
    flow   = get_flow_config(oc)
    plat_pills = ""
    for p in plats[:4]:
        ps = PLATFORM_STYLE.get(p, {"bg": "#F1F5F9", "color": "#475569"})
        plat_pills += f'<span class="camp-plat-pill" style="background:{ps["bg"]};color:{ps["color"]}">{p}</span>'
    if len(plats) > 4:
        plat_pills += f'<span class="camp-plat-pill" style="background:#F1F5F9;color:#475569">+{len(plats)-4}</span>'
    return f"""<div class="camp-card">
        <div class="camp-thumb" style="background:{grad}">
            <span class="camp-status" style="background:{sc['bg']};color:{sc['color']}">{status}</span>
            <span class="camp-initial">{name[0]}</span>
        </div>
        <div class="camp-body">
            <div class="camp-name">{name}</div>
            <div class="camp-plat-row">{plat_pills}</div>
            <div class="flow-section">
                <div class="flow-hdr">
                    <span class="flow-label">Engagement Flow</span>
                    <span class="flow-stage">{flow['stage']}</span>
                </div>
                <svg width="100%" height="36" viewBox="0 0 200 36" style="display:block">
                    <polyline points="{flow['points']}" fill="none" stroke="#3B6BF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="camp-footer-row">
                <span class="camp-ago">Edited {c.get('ago','')}</span>
                <span class="camp-meta">⊕ {oc} output{'s' if oc!=1 else ''}</span>
            </div>
        </div>
    </div>"""

def render_campaign_grid(campaigns, source="dash", cols=3):
    if not campaigns: return
    n = min(len(campaigns), cols)
    col_widgets = st.columns(n)
    for i, c in enumerate(campaigns):
        cid = c.get("id", i)
        with col_widgets[i % n]:
            st.markdown(campaign_card_html(c), unsafe_allow_html=True)
            if st.button("Open Workspace →", key=f"open_ws_{source}_{cid}_{i}",
                         type="primary", use_container_width=True):
                open_workspace(cid)

# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────────────────────
def nav_btn(label, page_id):
    cur = st.session_state.page
    is_active = (cur == page_id and st.session_state.workspace_id is None)
    if st.button(label, key=f"nav_{page_id}", use_container_width=True,
                 type="primary" if is_active else "secondary"):
        _nav_page(page_id)

def render_sidebar():
    username = st.session_state.get("auth_user", "User")
    initials = username[:2].upper()
    with st.sidebar:
        st.markdown(
            f'<div class="sb-brand"><div class="sb-brand-icon">{SVG_BOLT}</div>'
            f'<span class="sb-brand-name">Socialyze</span></div>',
            unsafe_allow_html=True)
        st.markdown('<span class="sb-section">Workspace</span>', unsafe_allow_html=True)
        nav_btn("📋  Campaign Brief",    "brief")
        nav_btn("⊞  All Campaigns",     "campaigns")
        nav_btn("⚡  Active Campaigns",  "active")
        nav_btn("↗  Shared Workspaces", "shared")
        st.markdown('<span class="sb-section">Library</span>', unsafe_allow_html=True)
        nav_btn("♥  Favourites", "fav")
        nav_btn("▣  Archived",   "archived")
        st.markdown('<span class="sb-section">Clients</span>', unsafe_allow_html=True)
        nav_btn("💼  Brand & Client Hub", "brands")
        st.markdown('<span class="sb-section">Tools</span>', unsafe_allow_html=True)
        nav_btn("▦  Content Planner",  "planner")
        nav_btn("✦  Creator Studio",   "creator")
        nav_btn("🛡  Compliance Guard", "compliance")
        st.markdown('<div class="sb-divider"></div>', unsafe_allow_html=True)
        if st.button("↩  Sign Out", key="nav_signout", use_container_width=True):
            _flush()
            for k in list(st.session_state.keys()):
                del st.session_state[k]
            st.rerun()
        st.markdown(f"""<div class="sb-user">
            <div class="sb-avatar">{initials}</div>
            <div style="flex:1;min-width:0">
                <div class="sb-user-name">{username}</div>
                <div class="sb-user-role">Member</div>
            </div></div>""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# WORKSPACE OUTPUT RENDERERS
# ─────────────────────────────────────────────────────────────────────────────
def _render_ws_ai_output(data):
    if data.get("campaign_tagline"):
        st.markdown(f'<div class="result-tagline">&ldquo;{data["campaign_tagline"]}&rdquo;</div>', unsafe_allow_html=True)
    if data.get("campaign_summary"):
        st.markdown(f'<div class="result-summary">{data["campaign_summary"]}</div>', unsafe_allow_html=True)
    platforms = data.get("platforms", {})
    if isinstance(platforms, list):
        pmap = {}
        for p in platforms:
            if p.get("platform_name"): pmap[p["platform_name"]] = {"posts": p.get("posts", [])}
        platforms = pmap
    if platforms:
        tabs = st.tabs(list(platforms.keys()))
        for tab, plat in zip(tabs, platforms.keys()):
            with tab:
                for i, post in enumerate(platforms[plat].get("posts", []), 1):
                    tags = " ".join(post.get("hashtags", []))
                    hook_html = (f"<div class='post-hook'><span class='hook-label'>HOOK</span>{post.get('hook','')}</div>"
                                 if post.get("hook") else "")
                    st.markdown(f"""<div class="post-card">
                        <div class="post-num">VARIATION {i} · {post.get('content_type','Post').upper()}</div>
                        {hook_html}
                        <div class="post-caption">{post.get('caption','')}</div>
                        <div class="post-tags">{tags}</div>
                        <div class="meta-grid">
                            <div><span class="meta-key">CTA</span><span class="meta-val">{post.get('cta','')}</span></div>
                            <div><span class="meta-key">Best Time</span><span class="meta-val">{post.get('best_time','N/A')}</span></div>
                        </div></div>""", unsafe_allow_html=True)

def _render_ws_audience_output(data):
    for p, lbl in [(data.get("primary_persona",{}), "Primary"), (data.get("secondary_persona",{}), "Secondary")]:
        if not p: continue
        st.markdown(f"""<div class="result-card">
            <div class="result-name">{lbl}: {p.get('name','')}</div>
            <div class="insight-label">Interests</div><div class="insight-text">{', '.join(p.get('interests',[]))}</div>
            <div class="insight-label">Pain Points</div><div class="insight-text">{', '.join(p.get('pain_points',[]))}</div>
            <div class="insight-label">Best Platforms</div><div class="insight-text">{', '.join(p.get('best_platforms',[]))}</div>
            </div>""", unsafe_allow_html=True)
    for tip in data.get("targeting_tips", []):
        st.markdown(f'<div class="tip">💡 {tip}</div>', unsafe_allow_html=True)

def _render_ws_ideation_output(data):
    for c in data.get("campaign_concepts", []):
        vir = f"<div class='idea-viral'>⚡ {c.get('viral_mechanism','')}</div>" if c.get("viral_mechanism") else ""
        st.markdown(f"""<div class="idea-card">
            <div class="idea-title">{c.get('title','')}</div>
            <div class="idea-desc">{c.get('big_idea','')}</div>
            {vir}<div class="idea-impact">📈 {c.get('expected_impact','')}</div>
            </div>""", unsafe_allow_html=True)

def _render_ws_custom_output(data):
    if data.get("campaign_name"):
        st.markdown(f'<div class="result-name">{data["campaign_name"]}</div>', unsafe_allow_html=True)
    if data.get("campaign_objective"):
        st.markdown(f'<div class="result-summary">{data["campaign_objective"]}</div>', unsafe_allow_html=True)
    for phase in data.get("phases", []):
        acts = "".join(f"<li style='font-size:12.5px;color:#334155'>{a}</li>" for a in phase.get("activities",[]))
        st.markdown(f"""<div class="post-card">
            <div class="post-num">PHASE {phase.get('phase_number','')} — {phase.get('duration','')}</div>
            <div class="post-caption">{phase.get('name','')}</div>
            <ul style="margin:8px 0 0 16px">{acts}</ul></div>""", unsafe_allow_html=True)

def _ws_save_output(cid, panel_type, data):
    """Save an AI output to a campaign's workspace history and flush to disk."""
    key = str(cid)
    if key not in st.session_state.ws_outputs:
        st.session_state.ws_outputs[key] = []
    st.session_state.ws_outputs[key].insert(0, {
        "type": panel_type, "data": data,
        "saved_at": datetime.datetime.now().strftime("%d %b %Y, %I:%M %p"),
    })
    for c in st.session_state.saved_campaigns:
        if c.get("id") == cid:
            c["output_count"] = c.get("output_count", 0) + 1
            c["ago"] = "Just now"
            break
    _flush()

# ─────────────────────────────────────────────────────────────────────────────
# WORKSPACE GENERATION PANELS
# ─────────────────────────────────────────────────────────────────────────────
def _ws_panel_generate(campaign):
    cid = campaign.get("id")
    _apply_pending_prefill("ws_gp"); pre = get_panel_prefill("ws_gp")
    brand_default = pre.get("brand", cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚡ AI Post Generator</div>'
                '<div class="gen-panel-sub">Multi-platform captions &amp; hashtags via Groq</div></div>',
                unsafe_allow_html=True)
    render_import_strip("ws_gp")
    if st.session_state.ws_gen_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand    = st.text_input("Brand",           value=brand_default, key="ws_gp_brand")
            product  = st.text_input("Product/Service", value=pre.get("product",""), key="ws_gp_product")
            goal     = st.text_input("Campaign Goal",   value=pre.get("goal",""), key="ws_gp_goal")
        with c2:
            camp_type  = st.selectbox("Campaign Type", CAMP_TYPES, key="ws_gp_ct")
            tone_def   = pre.get("tone","Inspirational")
            tone       = st.selectbox("Tone", TONES, index=TONES.index(tone_def) if tone_def in TONES else 2, key="ws_gp_tone")
            variations = st.slider("Variations per Platform", 1, 5, 2, key="ws_gp_var")
        st.markdown("**Platforms**")
        init_plats = pre.get("platforms", campaign.get("platforms",["Instagram"]))
        sel_plats  = []
        plat_cols  = st.columns(len(PLATFORMS))
        for i, p in enumerate(PLATFORMS):
            if plat_cols[i].checkbox(p, value=p in init_plats, key=f"ws_gp_p_{p}"): sel_plats.append(p)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Close Panel", key="ws_gp_cancel"): st.session_state.ws_panel = None; st.rerun()
        with c2:
            if st.button("⚡ Generate", type="primary", use_container_width=True, key="ws_gp_gen"):
                if not brand or not product or not goal: st.warning("Fill Brand, Product, and Goal.")
                elif not sel_plats: st.warning("Select at least one platform.")
                else:
                    prompt = (f"Social media Creative Director. Agency-quality campaign.\n"
                              f"Brand: {brand} | {product} | {camp_type} | Goal: {goal} | Tone: {tone} | "
                              f"Platforms: {', '.join(sel_plats)} | {variations} variation(s) per platform\n"
                              f'Return ONLY valid JSON: {{"campaign_tagline":"","campaign_summary":"",'
                              f'"platforms":[{{"platform_name":"{sel_plats[0]}","posts":[{{"hook":"","caption":"",'
                              f'"hashtags":[],"cta":"","content_type":"","best_time":""}}]}}],"kpis":[]}}')
                    with st.spinner("Generating…"):
                        parsed = call_groq(prompt, 2000)
                    if parsed:
                        if isinstance(parsed.get("platforms"), list):
                            pmap = {}
                            for p in parsed["platforms"]:
                                if p.get("platform_name"): pmap[p["platform_name"]] = {"posts": p.get("posts",[])}
                            parsed["platforms"] = pmap
                        parsed["_brand"] = brand; parsed["_platforms"] = sel_plats; parsed["_tone"] = tone
                        st.session_state.ws_gen_result = parsed; st.rerun()
    else:
        r = st.session_state.ws_gen_result
        tl = f"<div class='result-tagline'>&ldquo;{r['campaign_tagline']}&rdquo;</div>" if r.get("campaign_tagline") else ""
        st.markdown(f'<div class="result-card"><div class="result-name">{r.get("_brand","Campaign")}</div>'
                    f'{tl}<div class="result-summary">{r.get("campaign_summary","")}</div></div>', unsafe_allow_html=True)
        _render_ws_ai_output(r)
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("← Generate Another", key="ws_gp_regen"): st.session_state.ws_gen_result = None; st.rerun()
        with c2:
            if st.button("💾 Save to This Campaign", type="primary", use_container_width=True, key="ws_gp_save"):
                _ws_save_output(cid, "ai", r)
                st.session_state.ws_gen_result = None; st.session_state.ws_panel = None
                st.success("✓ Output saved!"); st.rerun()
        with c3:
            if st.button("✕ Close", key="ws_gp_close"): st.session_state.ws_panel = None; st.rerun()

def _ws_panel_audience(campaign):
    cid = campaign.get("id")
    _apply_pending_prefill("ws_at"); pre = get_panel_prefill("ws_at")
    brand_default = pre.get("brand", cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">👥 Audience Targeting</div>'
                '<div class="gen-panel-sub">Persona-matched messaging strategy</div></div>', unsafe_allow_html=True)
    render_import_strip("ws_at")
    if st.session_state.ws_aud_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand   = st.text_input("Brand",   value=brand_default, key="ws_at_brand")
            product = st.text_input("Product", value=pre.get("product",""), key="ws_at_product")
        with c2:
            goal  = st.text_input("Goal", value=pre.get("goal",""), key="ws_at_goal")
            plats = st.multiselect("Platforms", PLATFORMS,
                                   default=[p for p in pre.get("platforms", campaign.get("platforms",["Instagram"])) if p in PLATFORMS],
                                   key="ws_at_plats")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Close", key="ws_at_cancel"): st.session_state.ws_panel = None; st.rerun()
        with c2:
            if st.button("👥 Generate", type="primary", use_container_width=True, key="ws_at_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt = (f"Digital marketing strategist. Audience strategy:\n"
                              f"Brand: {brand} | Product: {product} | Goal: {goal or 'Build awareness'} | "
                              f"Platforms: {', '.join(plats) if plats else 'Instagram'}\n"
                              f'Return ONLY valid JSON: {{"primary_persona":{{"name":"","age_range":"","interests":[],'
                              f'"pain_points":[],"motivations":[],"best_platforms":[]}},"secondary_persona":{{"name":"",'
                              f'"age_range":"","interests":[],"pain_points":[],"motivations":[],"best_platforms":[]}},'
                              f'"messaging_pillars":[{{"pillar":"","message":"","content_angle":""}}],"targeting_tips":[]}}')
                    with st.spinner("Generating…"):
                        result = call_groq(prompt, 1500)
                    if result:
                        result["_brand"] = brand; result["_platforms"] = plats
                        st.session_state.ws_aud_result = result; st.rerun()
    else:
        r = st.session_state.ws_aud_result
        _render_ws_audience_output(r)
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("← Again", key="ws_at_regen"): st.session_state.ws_aud_result = None; st.rerun()
        with c2:
            if st.button("💾 Save to Campaign", type="primary", use_container_width=True, key="ws_at_save"):
                _ws_save_output(cid, "audience", r)
                st.session_state.ws_aud_result = None; st.session_state.ws_panel = None
                st.success("✓ Saved!"); st.rerun()
        with c3:
            if st.button("✕ Close", key="ws_at_close"): st.session_state.ws_panel = None; st.rerun()

def _ws_panel_ideation(campaign):
    cid = campaign.get("id")
    _apply_pending_prefill("ws_ci"); pre = get_panel_prefill("ws_ci")
    brand_default = pre.get("brand", cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">💡 Campaign Ideation</div>'
                '<div class="gen-panel-sub">Creative concepts &amp; calendar ideas</div></div>', unsafe_allow_html=True)
    render_import_strip("ws_ci")
    if st.session_state.ws_ide_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand   = st.text_input("Brand",   value=brand_default, key="ws_ci_brand")
            product = st.text_input("Product", value=pre.get("product",""), key="ws_ci_product")
        with c2:
            goal     = st.text_input("Goal", value=pre.get("goal",""), key="ws_ci_goal")
            tone_def = pre.get("tone","Inspirational")
            tone     = st.selectbox("Tone", TONES, index=TONES.index(tone_def) if tone_def in TONES else 2, key="ws_ci_tone")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Close", key="ws_ci_cancel"): st.session_state.ws_panel = None; st.rerun()
        with c2:
            if st.button("💡 Generate", type="primary", use_container_width=True, key="ws_ci_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt = (f"Creative director. 5 campaign concepts:\n"
                              f"Brand: {brand} | Product: {product} | Goal: {goal or 'Build awareness'} | Tone: {tone}\n"
                              f'Return ONLY valid JSON: {{"campaign_concepts":[{{"title":"","big_idea":"","viral_mechanism":"",'
                              f'"content_formats":[],"expected_impact":""}}],"hashtag_strategy":{{"branded":[],'
                              f'"trending":[],"niche":[]}},"collab_ideas":[]}}')
                    with st.spinner("Generating…"):
                        result = call_groq(prompt, 1800)
                    if result:
                        result["_brand"] = brand; result["_tone"] = tone
                        st.session_state.ws_ide_result = result; st.rerun()
    else:
        r = st.session_state.ws_ide_result
        _render_ws_ideation_output(r)
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("← Again", key="ws_ci_regen"): st.session_state.ws_ide_result = None; st.rerun()
        with c2:
            if st.button("💾 Save to Campaign", type="primary", use_container_width=True, key="ws_ci_save"):
                _ws_save_output(cid, "ideation", r)
                st.session_state.ws_ide_result = None; st.session_state.ws_panel = None
                st.success("✓ Saved!"); st.rerun()
        with c3:
            if st.button("✕ Close", key="ws_ci_close"): st.session_state.ws_panel = None; st.rerun()

def _ws_panel_custom(campaign):
    cid = campaign.get("id")
    _apply_pending_prefill("ws_cf"); pre = get_panel_prefill("ws_cf")
    brand_default = pre.get("brand", cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚙ Custom Flow</div>'
                '<div class="gen-panel-sub">AI-generated bespoke campaign skeleton</div></div>', unsafe_allow_html=True)
    render_import_strip("ws_cf")
    if st.session_state.ws_cus_result is None:
        brand       = st.text_input("Brand",           value=brand_default, key="ws_cf_brand")
        product     = st.text_input("Product/Service", value=pre.get("product",""), key="ws_cf_product")
        goal        = st.text_input("Goal",            value=pre.get("goal",""), key="ws_cf_goal")
        custom_inst = st.text_area("Custom Instructions", key="ws_cf_inst", height=80)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Close", key="ws_cf_cancel"): st.session_state.ws_panel = None; st.rerun()
        with c2:
            if st.button("⚙ Build Skeleton", type="primary", use_container_width=True, key="ws_cf_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt = (f"Campaign architect. Bespoke skeleton:\n"
                              f"Brand: {brand} | Product: {product} | Goal: {goal or 'Grow'} | Custom: {custom_inst or 'None'}\n"
                              f'Return ONLY valid JSON: {{"campaign_name":"","campaign_objective":"","unique_angle":"",'
                              f'"phases":[{{"phase_number":1,"name":"","duration":"","activities":[],"deliverables":[],'
                              f'"success_metrics":[]}}],"messaging_framework":{{"core_message":"","tone_guide":"",'
                              f'"words_to_use":[],"words_to_avoid":[]}},"risk_mitigation":[]}}')
                    with st.spinner("Building…"):
                        result = call_groq(prompt, 1800)
                    if result:
                        result["_brand"] = brand
                        st.session_state.ws_cus_result = result; st.rerun()
    else:
        r = st.session_state.ws_cus_result
        _render_ws_custom_output(r)
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("← Again", key="ws_cf_regen"): st.session_state.ws_cus_result = None; st.rerun()
        with c2:
            if st.button("💾 Save to Campaign", type="primary", use_container_width=True, key="ws_cf_save"):
                _ws_save_output(cid, "custom", r)
                st.session_state.ws_cus_result = None; st.session_state.ws_panel = None
                st.success("✓ Saved!"); st.rerun()
        with c3:
            if st.button("✕ Close", key="ws_cf_close"): st.session_state.ws_panel = None; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# CAMPAIGN WORKSPACE PAGE
# ─────────────────────────────────────────────────────────────────────────────
def page_workspace():
    cid      = st.session_state.workspace_id
    campaign = next((c for c in st.session_state.saved_campaigns if c.get("id") == cid), None)
    if campaign is None:
        st.error("Campaign not found.")
        if st.button("← Back to All Campaigns"): close_workspace()
        return
    name   = cap_first(campaign.get("campaign_name","Campaign"))
    status = campaign.get("status","Draft")
    plats  = campaign.get("platforms",[])
    grad   = hash_grad(campaign.get("campaign_name",""))
    sc     = STATUS_COLORS.get(status, STATUS_COLORS["Draft"])
    if st.button("← All Campaigns", key="ws_back"): close_workspace(); return
    plat_pills = "".join(f'<span class="ws-plat-pill">{p}</span>' for p in plats)
    st.markdown(f"""<div class="ws-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
            <div>
                <div class="ws-camp-name">{name}</div>
                <div class="ws-meta-row">
                    <span class="ws-status" style="background:{sc['bg']};color:{sc['color']}">{status}</span>
                    {plat_pills}
                </div>
                <div style="margin-top:10px;font-size:12px;color:#9BA3BB">
                    ⊕ {campaign.get('output_count',0)} outputs saved &nbsp;·&nbsp; 🕐 {campaign.get('ago','recently')}
                </div>
            </div>
            <div style="width:64px;height:64px;border-radius:14px;background:{grad};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span style="font-family:'Syne',sans-serif;font-size:26px;font-weight:700;color:rgba(255,255,255,0.5)">{name[0]}</span>
            </div>
        </div></div>""", unsafe_allow_html=True)
    st.markdown('<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9BA3BB;margin-bottom:10px">Generate for this campaign</div>',
                unsafe_allow_html=True)
    ws_panel = st.session_state.ws_panel
    if ws_panel is None:
        btn_cols = st.columns(4)
        for col, pw in zip(btn_cols, WS_PANELS):
            with col:
                if st.button(pw["label"], key=f"ws_open_{pw['id']}", use_container_width=True):
                    st.session_state.ws_panel      = pw["id"]
                    st.session_state.ws_gen_result = None
                    st.session_state.ws_aud_result = None
                    st.session_state.ws_ide_result = None
                    st.session_state.ws_cus_result = None
                    st.rerun()
    else:
        if   ws_panel == "ai":       _ws_panel_generate(campaign)
        elif ws_panel == "audience": _ws_panel_audience(campaign)
        elif ws_panel == "ideation": _ws_panel_ideation(campaign)
        elif ws_panel == "custom":   _ws_panel_custom(campaign)
    st.markdown("<br>", unsafe_allow_html=True)
    outputs = st.session_state.ws_outputs.get(str(cid), [])
    count   = len(outputs)
    st.markdown(f'<div class="ws-timeline-label">Output History <span class="ws-output-count">{count} item{"s" if count!=1 else ""}</span></div>',
                unsafe_allow_html=True)
    if not outputs:
        st.markdown('<div class="empty-state" style="padding:32px 0"><div class="empty-icon">🔭</div>'
                    '<div class="empty-title">No outputs yet</div>'
                    '<div class="empty-sub">Use one of the 4 panels above to generate and save content.</div></div>',
                    unsafe_allow_html=True)
    else:
        OUTPUT_META = {
            "ai":       {"label":"AI Post Generator","color":"#3B6BF5","bg":"#EBF0FF","emoji":"⚡"},
            "audience": {"label":"Audience Targeting","color":"#16A34A","bg":"#F0FDF4","emoji":"👥"},
            "ideation": {"label":"Campaign Ideation","color":"#EA580C","bg":"#FFF7ED","emoji":"💡"},
            "custom":   {"label":"Custom Flow","color":"#9333EA","bg":"#FDF4FF","emoji":"⚙"},
        }
        for i, out in enumerate(outputs):
            meta    = OUTPUT_META.get(out.get("type","ai"), OUTPUT_META["ai"])
            eid     = f"{cid}_{i}"
            is_open = st.session_state.ws_expanded.get(eid, i == 0)
            hdr_cols = st.columns([6, 1])
            with hdr_cols[0]:
                st.markdown(f'<div class="ws-output-card" style="margin-bottom:0"><div class="ws-output-hdr">'
                            f'<span class="ws-output-type" style="background:{meta["bg"]};color:{meta["color"]}">'
                            f'{meta["emoji"]} {meta["label"]}</span>'
                            f'<span style="font-size:12px;color:#9BA3BB">{out.get("saved_at","")}</span>'
                            f'</div></div>', unsafe_allow_html=True)
            with hdr_cols[1]:
                tog = "▲ Hide" if is_open else "▼ Show"
                if st.button(tog, key=f"ws_tog_{eid}", use_container_width=True):
                    st.session_state.ws_expanded[eid] = not is_open; st.rerun()
            if is_open:
                with st.expander("", expanded=True):
                    t = out.get("type")
                    if   t == "ai":       _render_ws_ai_output(out.get("data",{}))
                    elif t == "audience": _render_ws_audience_output(out.get("data",{}))
                    elif t == "ideation": _render_ws_ideation_output(out.get("data",{}))
                    elif t == "custom":   _render_ws_custom_output(out.get("data",{}))
                    else:                 st.json(out.get("data",{}))
    st.markdown('<div class="footer"><strong>Socialyze</strong> — Sourcesys Technologies</div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# QUICK CAMPAIGN PANEL
# ─────────────────────────────────────────────────────────────────────────────
def panel_quick():
    st.markdown(
        '<div class="gen-panel">'
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">'
        '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3B6BF5,#8B5CF6);'
        'display:flex;align-items:center;justify-content:center;font-size:18px">✦</div>'
        '<div><div class="gen-panel-title">New Campaign</div>'
        '<div class="gen-panel-sub">Describe your campaign — get instant ideas, posts, captions &amp; hashtags</div>'
        '</div></div></div>',
        unsafe_allow_html=True)
    if st.session_state.quick_result is None:
        st.markdown('<div class="form-card">', unsafe_allow_html=True)
        st.markdown('<label style="font-size:11.5px;font-weight:600;color:#5A607A;letter-spacing:0.05em;'
                    'text-transform:uppercase">What\'s your campaign about?</label>', unsafe_allow_html=True)
        user_input = st.text_area("", value=st.session_state.quick_input,
            placeholder=('e.g. "Launching a new fitness app for Gen Z that makes working out fun and social. '
                         'Want to build buzz on Instagram and TikTok before launch day."'),
            height=120, key="qp_input", label_visibility="collapsed")
        st.markdown('<div style="font-size:11px;color:#9BA3BB;margin-top:-8px;margin-bottom:10px">'
                    'Press Ctrl+Enter to generate</div>', unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("Cancel", key="qp_cancel"):
                st.session_state.active_panel = None
                st.session_state.quick_result = None
                st.session_state.quick_input  = ""
                st.rerun()
        with c2:
            if st.button("✦ Generate Campaign", type="primary", use_container_width=True, key="qp_gen",
                         disabled=not user_input.strip()):
                if user_input.strip():
                    st.session_state.quick_input = user_input
                    prompt = (
                        f'Social media expert. Campaign brief: "{user_input.strip()}"\n\n'
                        "Generate: 3 campaign ideas, 3 post variations (different angles), 3 captions, 10 hashtags.\n"
                        "Keep tone engaging and platform-native.\n\n"
                        "Return ONLY valid JSON. Start { end }.\n"
                        '{"campaign_ideas":[{"title":"...","description":"..."}],'
                        '"post_variations":[{"angle":"...","content":"..."}],'
                        '"captions":["..."],"hashtags":["#..."]}'
                    )
                    with st.spinner("Crafting your campaign…"):
                        result = call_groq(prompt, 1200)
                    if result:
                        st.session_state.quick_result = result; st.rerun()
    else:
        r = st.session_state.quick_result
        st.markdown(
            f'<div style="background:#F8FAFF;border:1.5px solid #DBEAFE;border-radius:12px;padding:12px 16px;margin-bottom:20px">'
            f'<span style="font-size:10px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px">Your brief</span>'
            f'<span style="font-size:13px;color:#334155;font-style:italic">"{st.session_state.quick_input}"</span>'
            f'</div>', unsafe_allow_html=True)
        ideas = r.get("campaign_ideas", [])
        st.markdown('<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
                    '<div style="width:28px;height:28px;border-radius:8px;background:#EBF0FF;color:#3B6BF5;'
                    'display:flex;align-items:center;justify-content:center;font-size:14px">💡</div>'
                    '<span style="font-size:13.5px;font-weight:700;color:#0D0F1A">Campaign Ideas</span></div>',
                    unsafe_allow_html=True)
        if ideas:
            cols = st.columns(min(len(ideas), 3))
            for col, idea in zip(cols, ideas):
                with col:
                    st.markdown(f'<div class="idea-card"><div class="idea-title">{idea.get("title","")}</div>'
                                f'<div class="idea-desc">{idea.get("description","")}</div></div>', unsafe_allow_html=True)
        st.markdown('<div style="display:flex;align-items:center;gap:8px;margin:16px 0 12px">'
                    '<div style="width:28px;height:28px;border-radius:8px;background:#FFF7ED;color:#EA580C;'
                    'display:flex;align-items:center;justify-content:center;font-size:14px">📱</div>'
                    '<span style="font-size:13.5px;font-weight:700;color:#0D0F1A">Post Variations</span></div>',
                    unsafe_allow_html=True)
        for i, post in enumerate(r.get("post_variations", [])):
            st.markdown(f'<div class="post-card">'
                        f'<div class="post-num">{post.get("angle", f"Variation {i+1}")}</div>'
                        f'<div class="post-caption">{post.get("content","")}</div></div>', unsafe_allow_html=True)
        st.markdown('<div style="display:flex;align-items:center;gap:8px;margin:16px 0 12px">'
                    '<div style="width:28px;height:28px;border-radius:8px;background:#F0FDF4;color:#16A34A;'
                    'display:flex;align-items:center;justify-content:center;font-size:14px">✍️</div>'
                    '<span style="font-size:13.5px;font-weight:700;color:#0D0F1A">Captions</span></div>',
                    unsafe_allow_html=True)
        for i, caption in enumerate(r.get("captions", [])):
            st.markdown(f'<div class="post-card"><div class="post-num">Caption {i+1}</div>'
                        f'<div class="post-caption">{caption}</div></div>', unsafe_allow_html=True)
        tags = r.get("hashtags", [])
        st.markdown('<div style="display:flex;align-items:center;gap:8px;margin:16px 0 12px">'
                    '<div style="width:28px;height:28px;border-radius:8px;background:#FDF4FF;color:#9333EA;'
                    'display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">#</div>'
                    '<span style="font-size:13.5px;font-weight:700;color:#0D0F1A">Hashtags</span></div>',
                    unsafe_allow_html=True)
        if tags:
            tag_html = " ".join(f'<span class="kpi-pill" style="background:#FDF4FF;color:#9333EA;border-color:#E9D5FF">{t}</span>' for t in tags)
            st.markdown(f'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">{tag_html}</div>', unsafe_allow_html=True)
        render_save_to_campaign("qp", brand=st.session_state.quick_input[:30],
                                platforms=["Instagram","TikTok"], tone="Casual",
                                output_count=3, result_data=r)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Try Again", key="qp_regen"):
                st.session_state.quick_result = None; st.session_state.quick_input = ""; st.rerun()
        with c2:
            if st.button("Done ✓", type="primary", use_container_width=True, key="qp_done"):
                st.session_state.active_panel = None; st.session_state.quick_result = None
                st.session_state.quick_input = ""; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# GENERATE PANELS (Dashboard)
# ─────────────────────────────────────────────────────────────────────────────
def panel_generate():
    pkey = "gp"; _apply_pending_prefill(pkey); pre = get_panel_prefill(pkey)
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚡ AI Post Generator</div>'
                '<div class="gen-panel-sub">Multi-platform captions &amp; hashtags via Groq</div></div>',
                unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.gen_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand    = st.text_input("Brand / Company",  value=pre.get("brand",""),   placeholder="e.g. Nike, Zomato", key="gp_brand")
            product  = st.text_input("Product / Service",value=pre.get("product",""), placeholder="e.g. Running Shoes", key="gp_product")
            goal     = st.text_input("Campaign Goal",    value=pre.get("goal",""),    placeholder="e.g. Drive 10K installs", key="gp_goal")
            keywords = st.text_input("Keywords / Themes",placeholder="e.g. speed, performance", key="gp_kw")
        with c2:
            camp_type  = st.selectbox("Campaign Type", CAMP_TYPES, key="gp_ct")
            tone_def   = pre.get("tone","Inspirational")
            tone       = st.selectbox("Tone", TONES, index=TONES.index(tone_def) if tone_def in TONES else 2, key="gp_tone")
            aud_def    = pre.get("audience","Millennials")
            audience   = st.selectbox("Target Audience", AUDIENCES, index=AUDIENCES.index(aud_def) if aud_def in AUDIENCES else 1, key="gp_aud")
            variations = st.slider("Variations per Platform", 1, 5, 3, key="gp_var")
        st.markdown("**Platforms**")
        init_plats = pre.get("platforms",["Instagram","Twitter"])
        sel_plats  = []
        plat_cols  = st.columns(len(PLATFORMS))
        for i, p in enumerate(PLATFORMS):
            if plat_cols[i].checkbox(p, value=p in init_plats, key=f"gp_p_{p}"): sel_plats.append(p)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Cancel", key="gp_cancel"): st.session_state.active_panel = None; st.rerun()
        with c2:
            gen = st.button("⚡ Generate Campaign", type="primary", use_container_width=True, key="gp_gen")
        if gen:
            if not brand or not product or not goal: st.warning("Fill Brand, Product, and Goal.")
            elif not sel_plats: st.warning("Select at least one platform.")
            else:
                plat_hints = {"Instagram":"Reels-first, hook line 1, 3-5 hashtags",
                              "Twitter":"Under 280 chars, opinionated hook, 1-2 hashtags",
                              "LinkedIn":"Personal story hook, data-backed, 3 hashtags max",
                              "Facebook":"Community-first, shareable emotional angle",
                              "TikTok":"Hook in 2s, POV/challenge format",
                              "YouTube":"Title = 90% clicks, hook in 30s"}
                plat_lines = "\n".join(f"{p}: {plat_hints.get(p,'platform-native best practices')}" for p in sel_plats)
                prompt = (f"Social media Creative Director. Agency-quality campaign.\n"
                          f"Brief: {brand} | {product} | {camp_type} | Goal: {goal} | Audience: {audience} | Tone: {tone}"
                          f"{(' | Keywords: '+keywords) if keywords else ''}\n"
                          f"Platforms: {', '.join(sel_plats)} | {variations} variation(s)\nPlatform rules:\n{plat_lines}\n"
                          f'Return ONLY valid JSON: {{"campaign_tagline":"","campaign_summary":"","brand_voice_guide":"",'
                          f'"audience_insight":"","platforms":[{{"platform_name":"{sel_plats[0]}","posts":[{{"hook":"",'
                          f'"caption":"","hashtags":[],"cta":"","content_type":"","best_time":"","visual_direction":"",'
                          f'"engagement_tactic":""}}]}}],"campaign_ideas":[{{"title":"","big_idea":"","viral_mechanism":"",'
                          f'"expected_impact":""}}],"kpis":[],"budget_tips":[]}}')
                with st.spinner(f"Generating with Groq ({MODEL})…"):
                    parsed = call_groq(prompt, 2500)
                if parsed:
                    if isinstance(parsed.get("platforms"), list):
                        pmap = {}
                        for p in parsed["platforms"]:
                            if p.get("platform_name"): pmap[p["platform_name"]] = {"posts": p.get("posts",[])}
                        parsed["platforms"] = pmap
                    parsed["_brand"] = brand; parsed["_product"] = product
                    parsed["_tone"]  = tone;  parsed["_platforms"] = sel_plats; parsed["_variations"] = variations
                    st.session_state.gen_result = parsed; st.rerun()
    else:
        result    = st.session_state.gen_result
        kpi_pills = " ".join(f'<span class="kpi-pill">{k}</span>' for k in result.get("kpis",[]))
        bv    = (f"<div class='insight-label'>Brand Voice</div><div class='insight-text'>{result['brand_voice_guide']}</div>"
                 if result.get("brand_voice_guide") else "")
        ai_in = (f"<div class='insight-label'>Audience Insight</div><div class='insight-text'>{result['audience_insight']}</div>"
                 if result.get("audience_insight") else "")
        tl    = (f"<div class='result-tagline'>&ldquo;{result['campaign_tagline']}&rdquo;</div>"
                 if result.get("campaign_tagline") else "")
        st.markdown(f'<div class="result-card"><div class="result-name">{result.get("_brand","Campaign")}</div>'
                    f'{tl}<div class="result-summary">{result.get("campaign_summary","")}</div>'
                    f'{bv}{ai_in}<div class="kpi-row">{kpi_pills}</div></div>', unsafe_allow_html=True)
        plat_keys = list(result.get("platforms",{}).keys())
        if plat_keys:
            tabs = st.tabs(plat_keys)
            for tab, platform in zip(tabs, plat_keys):
                with tab:
                    for i, post in enumerate(result["platforms"][platform].get("posts",[]), 1):
                        tags_s    = " ".join(post.get("hashtags",[]))
                        hook_html = (f"<div class='post-hook'><span class='hook-label'>HOOK</span>{post.get('hook','')}</div>"
                                     if post.get("hook") else "")
                        vis  = (f"<div class='meta-full'><span class='meta-key'>Visual Direction</span><span class='meta-val'>{post.get('visual_direction','')}</span></div>"
                                if post.get("visual_direction") else "")
                        eng  = (f"<div class='meta-full'><span class='meta-key'>Engagement Tactic</span><span class='meta-val'>{post.get('engagement_tactic','')}</span></div>"
                                if post.get("engagement_tactic") else "")
                        st.markdown(f"""<div class="post-card">
                            <div class="post-num">VARIATION {i} · {post.get('content_type','Post').upper()}</div>
                            {hook_html}<div class="post-caption">{post.get('caption','')}</div>
                            <div class="post-tags">{tags_s}</div>
                            <div class="meta-grid">
                                <div><span class="meta-key">CTA</span><span class="meta-val">{post.get('cta','')}</span></div>
                                <div><span class="meta-key">Best Time</span><span class="meta-val">{post.get('best_time','N/A')}</span></div>
                                {vis}{eng}
                            </div></div>""", unsafe_allow_html=True)
        ideas = result.get("campaign_ideas",[])
        if ideas:
            st.markdown("<br><div class='sec-title'>Creative Campaign Concepts</div>", unsafe_allow_html=True)
            ic = st.columns(min(len(ideas),3))
            for col, idea in zip(ic, ideas):
                with col:
                    vir = f"<div class='idea-viral'>⚡ {idea.get('viral_mechanism','')}</div>" if idea.get("viral_mechanism") else ""
                    st.markdown(f'<div class="idea-card"><div class="idea-title">{idea.get("title","")}</div>'
                                f'<div class="idea-desc">{idea.get("big_idea","")}</div>'
                                f'{vir}<div class="idea-impact">📈 {idea.get("expected_impact","")}</div></div>', unsafe_allow_html=True)
        for tip in result.get("budget_tips",[]): st.markdown(f'<div class="tip">✅ {tip}</div>', unsafe_allow_html=True)
        render_save_to_campaign("gp", brand=result.get("_brand",""), platforms=result.get("_platforms",[]),
                                tone=result.get("_tone",""),
                                output_count=result.get("_variations",3)*len(result.get("_platforms",[])),
                                result_data=result)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Generate Another", key="gp_regen"): st.session_state.gen_result = None; st.rerun()
        with c2:
            if st.button("Done ✓", type="primary", use_container_width=True, key="gp_done"):
                st.session_state.active_panel = None; st.session_state.gen_result = None; st.rerun()

def panel_audience():
    pkey = "at"; _apply_pending_prefill(pkey); pre = get_panel_prefill(pkey)
    AT_AGE_GROUPS     = ['13–17','18–24','25–34','35–44','45–54','55–64','65+','All Ages']
    AT_CUSTOMER_TYPES = ['B2C','B2B','D2C','B2B2C','Non-Profit']
    AT_INDUSTRIES     = ['E-Commerce','EdTech','FinTech','HealthTech','FMCG','Fashion',
                         'Food & Beverage','SaaS','Real Estate','Travel','Automotive','Entertainment','Other']
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">👥 Audience Targeting</div>'
                '<div class="gen-panel-sub">3 high-impact personas — practical, modern, scroll-ready</div></div>',
                unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.audience_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand       = st.text_input("Brand Name *",         value=pre.get("brand",""),   placeholder="e.g. Nike, Swiggy",                                          key="at_brand")
            product     = st.text_input("Product / Service *",  value=pre.get("product",""), placeholder="e.g. Running Shoes",                                         key="at_product")
            objective   = st.text_input("Campaign Objective *", value=pre.get("goal",""),    placeholder="e.g. Drive 10K app installs in 30 days",                     key="at_objective")
            region      = st.text_input("Region / Geography *",                              placeholder="e.g. South India, Mumbai, Tier-2 cities",                    key="at_region")
            pain_points = st.text_input("Pain Points *",                                     placeholder="e.g. Users find checkout slow, trust issues with new brands", key="at_pain")
        with c2:
            industry      = st.selectbox("Industry",      AT_INDUSTRIES,     key="at_industry")
            age_group     = st.selectbox("Age Group",     AT_AGE_GROUPS,     index=2, key="at_age")
            customer_type = st.selectbox("Customer Type", AT_CUSTOMER_TYPES, key="at_ctype")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Cancel", key="at_cancel"): st.session_state.active_panel = None; st.rerun()
        with c2:
            if st.button("👥 Generate Audience Strategy", type="primary", use_container_width=True, key="at_gen"):
                if not brand or not product or not objective or not region or not pain_points:
                    st.warning("Please fill in all required fields.")
                else:
                    prompt = (f"You are a senior marketing strategist. Generate 3 HIGH-QUALITY audience personas.\n"
                              f"Brand: {brand} | Product: {product} | Campaign Objective: {objective} | "
                              f"Region: {region} | Industry: {industry} | Age Group: {age_group} | "
                              f"Customer Type: {customer_type} | Pain Points: {pain_points}\n"
                              f'Return ONLY valid JSON: {{"personas":[{{"persona_name":"","identity_label":"",'
                              f'"behavior":"","mindset":"","pain_point":"","hook":"","best_content_style":"",'
                              f'"best_platform":""}}],"audience_overlap_matrix":"",'
                              f'"channel_priority":[{{"platform":"","priority":"","rationale":""}}],'
                              f'"cultural_moments":[]}}')
                    with st.spinner("Building Personas…"):
                        result = call_groq(prompt, 1800)
                    if result:
                        result["_brand"] = brand; result["_product"] = product
                        st.session_state.audience_result = result; st.rerun()
    else:
        r = st.session_state.audience_result
        PERSONA_ACCENTS = [
            {"border":"#3B6BF5","bg":"#EBF0FF"},
            {"border":"#16A34A","bg":"#F0FDF4"},
            {"border":"#EA580C","bg":"#FFF7ED"},
        ]
        st.markdown(f'<div class="topbar-title">Audience Strategy: {r.get("_brand","")} · {r.get("_product","")}</div>', unsafe_allow_html=True)
        for i, p in enumerate(r.get("personas",[])):
            acc = PERSONA_ACCENTS[i % len(PERSONA_ACCENTS)]
            rows = ""
            if p.get("behavior"):    rows += f'<div class="insight-label">📲 BEHAVIOR</div><div class="insight-text">{p["behavior"]}</div>'
            if p.get("mindset"):     rows += f'<div class="insight-label">🧠 MINDSET</div><div class="insight-text">{p["mindset"]}</div>'
            if p.get("pain_point"):  rows += f'<div class="insight-label">😤 PAIN POINT</div><div class="insight-text">{p["pain_point"]}</div>'
            if p.get("hook"):        rows += f'<div style="background:{acc["bg"]};border:1.5px solid {acc["border"]}33;border-radius:10px;padding:10px 14px;margin-bottom:8px"><div class="insight-label">👉 HOOK THAT WORKS</div><div style="font-size:13px;font-weight:600;color:{acc["border"]}">&ldquo;{p["hook"]}&rdquo;</div></div>'
            if p.get("best_content_style"): rows += f'<div class="insight-label">🎬 BEST CONTENT STYLE</div><div class="insight-text">{p["best_content_style"]}</div>'
            if p.get("best_platform"):      rows += f'<div class="insight-label">👉 BEST PLATFORM</div><div class="insight-text">{p["best_platform"]}</div>'
            identity_html = ""
            if p.get("identity_label") and p["identity_label"] != p.get("persona_name"):
                identity_html = f'<div style="font-size:12px;color:{acc["border"]};font-weight:600;margin-bottom:10px">{p["identity_label"]}</div>'
            st.markdown(
                f'<div class="result-card" style="border-top:3px solid {acc["border"]}">'
                f'<div class="result-name">{p.get("persona_name","")}</div>'
                f'{identity_html}'
                f'{rows}</div>', unsafe_allow_html=True)
        if r.get("audience_overlap_matrix"):
            st.markdown(f'<div class="result-card"><div class="sec-title">Audience Overlap Insight</div>'
                        f'<div class="result-summary">{r["audience_overlap_matrix"]}</div></div>', unsafe_allow_html=True)
        if r.get("channel_priority"):
            st.markdown('<div class="sec-title" style="margin-top:16px">Channel Priority Ranking</div>', unsafe_allow_html=True)
            cols = st.columns(min(len(r["channel_priority"]),3))
            PRIO_COLORS = {"Must-Have":{"bg":"#DCFCE7","color":"#15803D"},"High":{"bg":"#DBEAFE","color":"#1D4ED8"},
                           "Medium":{"bg":"#FEF9C3","color":"#A16207"},"Low":{"bg":"#F1F5F9","color":"#475569"}}
            for col, ch in zip(cols, r["channel_priority"]):
                pc = PRIO_COLORS.get(ch.get("priority",""), {"bg":"#F1F5F9","color":"#475569"})
                with col:
                    st.markdown(f'<div class="stat-card"><div class="stat-label">{ch.get("platform","")}</div>'
                                f'<span class="stat-change" style="background:{pc["bg"]};color:{pc["color"]}">{ch.get("priority","")}</span>'
                                f'<div style="font-size:12px;color:#5A607A;margin-top:8px">{ch.get("rationale","")}</div></div>', unsafe_allow_html=True)
        if r.get("cultural_moments"):
            st.markdown('<div class="sec-title" style="margin-top:16px">Cultural Moments to Tap</div>', unsafe_allow_html=True)
            for m in r["cultural_moments"]: st.markdown(f'<div class="tip">🎯 {m}</div>', unsafe_allow_html=True)
        render_save_to_campaign("at", brand=r.get("_brand",""), platforms=[],
                                tone="Professional", output_count=3, result_data=r)
        if st.button("← Back", key="at_back"): st.session_state.audience_result = None; st.session_state.active_panel = None; st.rerun()

def panel_ideation():
    pkey = "ci"; _apply_pending_prefill(pkey); pre = get_panel_prefill(pkey)
    CI_TONES     = ['Casual','Professional','Inspirational','Humorous','Urgent','Playful','Bold','Empathetic','Witty','Provocative']
    CI_PLATFORMS = ['Instagram','Twitter','LinkedIn','Facebook','TikTok','YouTube','Multi-Platform']
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">💡 Campaign Ideation</div>'
                '<div class="gen-panel-sub">5 distinct campaign concepts — Cannes-level creative thinking via Groq</div></div>',
                unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.ideation_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand        = st.text_input("Brand Name *",        value=pre.get("brand",""),    placeholder="e.g. Zomato, Nykaa",                            key="ci_brand")
            product      = st.text_input("Product / Service *", value=pre.get("product",""),  placeholder="e.g. Food Delivery App",                        key="ci_product")
            ci_goal      = st.text_input("Campaign Goal *",     value=pre.get("goal",""),     placeholder="e.g. Dominate Diwali season orders",             key="ci_goal")
            ci_audience  = st.text_input("Target Audience *",   value=pre.get("audience",""), placeholder="e.g. Millennials in metro cities",               key="ci_audience")
            season_event = st.text_input("Season / Event *",                                  placeholder="e.g. Diwali 2025, IPL Season, Valentine's Day",  key="ci_season")
        with c2:
            tone_def   = pre.get("tone","Inspirational")
            tone_idx   = CI_TONES.index(tone_def) if tone_def in CI_TONES else 2
            tone       = st.selectbox("Tone",           CI_TONES,     index=tone_idx, key="ci_tone")
            plat_def   = pre.get("platforms",["Instagram"])
            plat_focus = st.selectbox("Platform Focus", CI_PLATFORMS,
                                      index=CI_PLATFORMS.index(plat_def[0]) if plat_def and plat_def[0] in CI_PLATFORMS else 0,
                                      key="ci_platfocus")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Cancel", key="ci_cancel"): st.session_state.active_panel = None; st.rerun()
        with c2:
            if st.button("💡 Generate 5 Campaign Concepts", type="primary", use_container_width=True, key="ci_gen"):
                if not brand or not product or not ci_goal or not ci_audience or not season_event:
                    st.warning("Please fill in all required fields.")
                else:
                    prompt = (f"You are the Executive Creative Director at a world-class agency. "
                              f"Generate 5 radically distinct campaign concepts for {brand}.\n"
                              f"Brand: {brand} | Product: {product} | Campaign Goal: {ci_goal} | "
                              f"Target Audience: {ci_audience} | Tone: {tone} | Season/Event: {season_event} | "
                              f"Platform Focus: {plat_focus}\n"
                              f'Return ONLY valid JSON: {{"campaign_ideas":[{{"idea_title":"","tagline":"",'
                              f'"big_idea":"","cultural_hook":"","platform_execution":"",'
                              f'"sample_post":"","viral_mechanism":"","influencer_strategy":"",'
                              f'"success_metric":"","why_it_wins":"",'
                              f'"hashtag_breakdown":[{{"tag":"","explanation":"","when_to_post":""}}]}}]}}')
                    with st.spinner("Generating 5 Campaign Concepts…"):
                        result = call_groq(prompt, 2200)
                    if result:
                        result["_brand"] = brand; result["_tone"] = tone
                        result["_season"] = season_event; result["_platform"] = plat_focus
                        st.session_state.ideation_result = result; st.rerun()
    else:
        r = st.session_state.ideation_result
        IDEA_ACCENTS = [
            {"bg":"#EBF0FF","accent":"#3B6BF5","border":"#BFDBFE","label":"Safe but Smart"},
            {"bg":"#F0FDF4","accent":"#16A34A","border":"#BBF7D0","label":"Crowd-Pleaser"},
            {"bg":"#FFF7ED","accent":"#EA580C","border":"#FED7AA","label":"Bold Move"},
            {"bg":"#FDF4FF","accent":"#9333EA","border":"#E9D5FF","label":"Brand-Defining"},
            {"bg":"#FFF1F2","accent":"#BE123C","border":"#FECDD3","label":"🔥 High Risk / High Reward"},
        ]
        st.markdown(f'<div class="topbar-title">5 Campaign Concepts for {r.get("_brand","")} · {r.get("_season","")} · {r.get("_platform","")}</div>',
                    unsafe_allow_html=True)
        for i, idea in enumerate(r.get("campaign_ideas",[])):
            c = IDEA_ACCENTS[i % len(IDEA_ACCENTS)]
            rows = ""
            for section_label, key in [("The Big Idea","big_idea"),("Cultural Hook 🎯","cultural_hook"),
                                        (f'{r.get("_platform","")} Execution',"platform_execution"),
                                        ("⚡ Viral Mechanism","viral_mechanism"),
                                        ("🤝 Influencer Strategy","influencer_strategy")]:
                if idea.get(key):
                    rows += (f'<div style="border-left:3px solid {c["accent"]};padding:6px 12px;margin-bottom:8px;border-radius:0 8px 8px 0">'
                             f'<div style="font-size:10px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">{section_label}</div>'
                             f'<div style="font-size:13px;color:#334155">{idea[key]}</div></div>')
            if idea.get("sample_post"):
                rows += (f'<div style="background:#F8FAFF;border:1.5px solid {c["border"]};border-radius:10px;padding:12px 14px;margin-bottom:8px">'
                         f'<div style="font-size:10px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">📱 Launch Post — Ready to Publish</div>'
                         f'<div style="font-size:13px;color:#1E293B;white-space:pre-wrap">{idea["sample_post"]}</div></div>')
            meta = ""
            if idea.get("success_metric"): meta += f'<span style="background:{c["bg"]};color:{c["accent"]};border:1px solid {c["border"]};font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:20px;margin-right:6px">📊 {idea["success_metric"]}</span>'
            if idea.get("why_it_wins"):    meta += f'<span style="background:#DCFCE7;color:#15803D;border:1px solid #BBF7D0;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:20px">🏆 {idea["why_it_wins"]}</span>'
            hashtag_html = ""
            for h in idea.get("hashtag_breakdown",[]):
                hashtag_html += (f'<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
                                 f'<span style="background:{c["bg"]};color:{c["accent"]};border:1px solid {c["border"]};font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:20px;white-space:nowrap">{h.get("tag","")}</span>'
                                 f'<span style="font-size:12px;color:#5A607A">{h.get("explanation","")}</span></div>')
            if hashtag_html:
                rows += (f'<div style="background:#F8FAFC;border-radius:10px;padding:12px 14px;margin-top:4px">'
                         f'<div style="font-size:10px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🏷️ Hashtag Breakdown</div>'
                         f'{hashtag_html}</div>')
            meta_html = f'<div style="margin-top:8px">{meta}</div>' if meta else ""
            st.markdown(
                f'<div class="result-card" style="border-left:4px solid {c["accent"]};margin-bottom:16px">'
                f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
                f'<span style="background:{c["bg"]};color:{c["accent"]};border:1.5px solid {c["border"]};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px">#{i+1}</span>'
                f'<span style="font-size:15px;font-weight:700;color:#0D0F1A">{idea.get("idea_title","")}</span>'
                f'<span style="background:{c["bg"]};color:{c["accent"]};font-size:11px;font-weight:600;padding:2px 9px;border-radius:12px;margin-left:auto">{c["label"]}</span>'
                f'</div>'
                f'<div style="font-size:13px;font-style:italic;color:{c["accent"]};margin-bottom:12px">&ldquo;{idea.get("tagline","")}&rdquo;</div>'
                f'{rows}'
                f'{meta_html}'
                f'</div>', unsafe_allow_html=True)
        render_save_to_campaign("ci", brand=r.get("_brand",""), platforms=[r.get("_platform","Instagram")],
                                tone=r.get("_tone","Inspirational"), output_count=5, result_data=r)
        if st.button("← Back", key="ci_back"): st.session_state.ideation_result = None; st.session_state.active_panel = None; st.rerun()

def panel_custom():
    pkey = "cf"; _apply_pending_prefill(pkey); pre = get_panel_prefill(pkey)
    CF_TONES     = ['Casual','Professional','Inspirational','Humorous','Urgent','Bold','Empathetic','Provocative','Witty']
    CF_DURATIONS = ['1 Week','2 Weeks','1 Month','6 Weeks','2 Months','3 Months']
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚙ Custom Flow</div>'
                '<div class="gen-panel-sub">Full integrated campaign skeleton — strategy, plan, captions, hashtags &amp; calendar</div></div>',
                unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.custom_result is None:
        c1, c2 = st.columns(2)
        with c1:
            brand      = st.text_input("Brand Name *",         value=pre.get("brand",""),    placeholder="e.g. Sourcesys, Swiggy",                               key="cf_brand")
            product    = st.text_input("Product / Service *",  value=pre.get("product",""),  placeholder="e.g. SaaS Platform, App",                              key="cf_product")
            biz_obj    = st.text_input("Business Objective *", value=pre.get("goal",""),     placeholder="e.g. Generate 500 qualified B2B leads in 30 days",     key="cf_bizobj")
            cf_audience= st.text_input("Target Audience *",    value=pre.get("audience",""), placeholder="e.g. IT Decision Makers, CTO/VPs at 100–500 person companies", key="cf_audience")
            key_msg    = st.text_input("Key Message *",                                      placeholder="e.g. Cut deployment time by 60% — no code changes",    key="cf_keymsg")
            cta        = st.text_input("Call to Action *",                                   placeholder="e.g. Book a 15-min demo, Start free trial",             key="cf_cta")
        with c2:
            tone_def = pre.get("tone","Inspirational")
            tone_idx = CF_TONES.index(tone_def) if tone_def in CF_TONES else 2
            tone     = st.selectbox("Tone",              CF_TONES,     index=tone_idx, key="cf_tone")
            duration = st.selectbox("Campaign Duration", CF_DURATIONS, index=2, key="cf_duration")
        st.markdown("**Platforms \\***")
        init_plats = pre.get("platforms",["Instagram","LinkedIn"])
        sel_plats  = []
        plat_cols  = st.columns(len(PLATFORMS))
        for i, p in enumerate(PLATFORMS):
            if plat_cols[i].checkbox(p, value=p in init_plats, key=f"cf_p_{p}"): sel_plats.append(p)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Cancel", key="cf_cancel"): st.session_state.active_panel = None; st.rerun()
        with c2:
            if st.button("⚙ Generate Full Campaign", type="primary", use_container_width=True, key="cf_gen"):
                if not brand or not product or not biz_obj or not cf_audience or not key_msg or not cta:
                    st.warning("Please fill in all required fields.")
                elif not sel_plats:
                    st.warning("Select at least one platform.")
                else:
                    prompt = (f"You are the Chief Strategy Officer at a world-class integrated marketing agency. "
                              f"This is a real, paid, high-stakes campaign brief.\n"
                              f"Brand: {brand} | Product: {product} | Business Objective: {biz_obj} | "
                              f"Target Audience: {cf_audience} | Tone: {tone} | Platforms: {', '.join(sel_plats)} | "
                              f"Campaign Duration: {duration} | Key Message: {key_msg} | Primary CTA: {cta}\n"
                              f'Return ONLY valid JSON: {{"campaign_name":"","positioning_statement":"","campaign_summary":"",'
                              f'"brand_voice_guide":"",'
                              f'"content_pillars":[{{"name":"","description":"","example":""}}],'
                              f'"platform_strategy":[{{"platform":"","strategy":"","frequency":"","formats":""}}],'
                              f'"posting_plan":[{{"week":"","theme":"","goal":"",'
                              f'"content_plan":[],"execution_tips":[],"ai_insights":""}}],'
                              f'"sample_captions":[{{"platform":"","caption":""}}],'
                              f'"hashtag_strategy":{{"brand_hashtags":[],"trend_hashtags":[],"niche_hashtags":[]}},'
                              f'"calendar_hooks":[]}}')
                    with st.spinner("Building Full Campaign…"):
                        result = call_groq(prompt, 2500)
                    if result:
                        result["_brand"]     = brand
                        result["_platforms"] = sel_plats
                        result["_tone"]      = tone
                        result["_duration"]  = duration
                        st.session_state.custom_result = result; st.rerun()
    else:
        r  = st.session_state.custom_result
        # Header card
        plat_pills_html = "".join(
            f'<span style="border:1px solid #3B6BF5;color:#3B6BF5;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:20px">{p}</span>'
            for p in r.get("_platforms",[])
        )
        pos_html = f'<div class="result-summary">{r["positioning_statement"]}</div>' if r.get("positioning_statement") else ""
        st.markdown(
            f'<div class="result-card">'
            f'<div class="result-name">{r.get("campaign_name", r.get("_brand",""))}</div>'
            f'{pos_html}'
            f'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'
            f'<span class="kpi-pill">{r.get("_tone","")}</span>'
            f'<span class="kpi-pill">{r.get("_duration","")}</span>'
            f'{plat_pills_html}</div></div>', unsafe_allow_html=True)
        # Section tabs
        CF_SECTIONS = [("overview","Overview"),("pillars","Content Pillars"),("strategy","Platform Strategy"),
                       ("plan","Posting Plan"),("captions","Sample Captions"),("hashtags","Hashtag Strategy"),("calendar","Content Calendar")]
        active_sec = st.session_state.get("cf_active_sec","pillars")
        sec_cols   = st.columns(len(CF_SECTIONS))
        for col, (sid, slbl) in zip(sec_cols, CF_SECTIONS):
            with col:
                if st.button(slbl, key=f"cf_sec_{sid}",
                             type="primary" if active_sec==sid else "secondary",
                             use_container_width=True):
                    st.session_state.cf_active_sec = sid; st.rerun()
        st.markdown("<br>", unsafe_allow_html=True)
        if active_sec == "overview":
            if r.get("campaign_summary"):
                st.markdown(f'<div class="result-card"><div class="sec-title">Campaign Summary</div>'
                            f'<div class="result-summary">{r["campaign_summary"]}</div></div>', unsafe_allow_html=True)
            if r.get("brand_voice_guide"):
                st.markdown(f'<div class="result-card"><div class="sec-title">Brand Voice Guide</div>'
                            f'<div class="result-summary">{r["brand_voice_guide"]}</div></div>', unsafe_allow_html=True)
        elif active_sec == "pillars":
            PILLAR_COLORS = ["#3B6BF5","#16A34A","#EA580C","#9333EA","#CA8A04"]
            for i, pillar in enumerate(r.get("content_pillars",[])):
                c = PILLAR_COLORS[i % len(PILLAR_COLORS)]
                name = pillar.get("name",pillar) if isinstance(pillar,dict) else str(pillar)
                desc = pillar.get("description","") if isinstance(pillar,dict) else ""
                ex   = pillar.get("example","")   if isinstance(pillar,dict) else ""
                desc_html = f'<div class="post-caption">{desc}</div>' if desc else ""
                ex_html   = f'<div style="font-size:12px;color:#3B6BF5;margin-top:6px"><strong>Example →</strong> {ex}</div>' if ex else ""
                st.markdown(
                    f'<div class="post-card" style="border-left:4px solid {c}">'
                    f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
                    f'<span style="background:{c}18;color:{c};font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px">P{i+1}</span>'
                    f'<span style="font-size:14px;font-weight:700;color:#0D0F1A">{name}</span></div>'
                    f'{desc_html}{ex_html}'
                    f'</div>', unsafe_allow_html=True)
            PLAT_COLORS = {"instagram":"#E1306C","linkedin":"#0077B5","twitter":"#1DA1F2",
                           "tiktok":"#010101","facebook":"#1877F2","youtube":"#FF0000"}
            for ps in r.get("platform_strategy",[]):
                pc        = PLAT_COLORS.get((ps.get("platform","")).lower(),"#3B6BF5")
                freq_html = f'<span style="font-size:12px;color:#5A607A">{ps["frequency"]}</span>' if ps.get("frequency") else ""
                fmt_html  = f'<div style="font-size:12px;color:#5A607A;margin-top:6px"><strong>Formats:</strong> {ps["formats"]}</div>' if ps.get("formats") else ""
                st.markdown(
                    f'<div class="post-card">'
                    f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
                    f'<span style="background:{pc}18;color:{pc};font-size:13px;font-weight:700;padding:3px 12px;border-radius:20px">{ps.get("platform","")}</span>'
                    f'{freq_html}'
                    f'</div>'
                    f'<div class="post-caption">{ps.get("strategy","")}</div>'
                    f'{fmt_html}'
                    f'</div>', unsafe_allow_html=True)
        elif active_sec == "plan":
            for i, week in enumerate(r.get("posting_plan",[])):
                with st.expander(f'{week.get("week","Week")} — {week.get("theme","").upper()}', expanded=True):
                    if week.get("goal"):
                        st.markdown(f'<div style="font-size:13px;font-weight:600;color:#0D0F1A;margin-bottom:8px">{week["goal"]}</div>', unsafe_allow_html=True)
                    if week.get("content_plan"):
                        st.markdown('<div class="insight-label">Content Plan</div>', unsafe_allow_html=True)
                        for item in week["content_plan"]:
                            st.markdown(f'<div style="font-size:12.5px;color:#334155;margin:3px 0">• {item}</div>', unsafe_allow_html=True)
                    if week.get("execution_tips"):
                        st.markdown('<div class="insight-label" style="margin-top:8px">Execution Tips</div>', unsafe_allow_html=True)
                        for tip in week["execution_tips"]:
                            st.markdown(f'<div class="tip" style="margin-bottom:4px">⚡ {tip}</div>', unsafe_allow_html=True)
                    if week.get("ai_insights"):
                        st.markdown(f'<div style="background:#EBF0FF;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#3B6BF5;margin-top:8px">🧠 {week["ai_insights"]}</div>', unsafe_allow_html=True)
        elif active_sec == "captions":
            PLAT_COLORS = {"instagram":"#E1306C","linkedin":"#0077B5","twitter":"#1DA1F2",
                           "tiktok":"#010101","facebook":"#1877F2","youtube":"#FF0000"}
            for i, item in enumerate(r.get("sample_captions",[])):
                caption  = item.get("caption","") if isinstance(item,dict) else str(item)
                platform = item.get("platform","") if isinstance(item,dict) else ""
                pc = PLAT_COLORS.get(platform.lower(),"#3B6BF5") if platform else "#3B6BF5"
                plat_badge = f'<span style="background:{pc}18;color:{pc};font-size:11px;font-weight:700;padding:2px 9px;border-radius:12px">{platform}</span>' if platform else ""
                st.markdown(
                    f'<div class="post-card">'
                    f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
                    f'<span class="post-num">Caption {i+1}</span>'
                    f'{plat_badge}'
                    f'</div>'
                    f'<div class="post-caption">{caption}</div>'
                    f'</div>', unsafe_allow_html=True)
                st.code(caption, language=None)
        elif active_sec == "hashtags":
            hs = r.get("hashtag_strategy",{})
            for tier_label, tier_key, tier_color in [
                ("🏷 Brand Hashtags","brand_hashtags","#3B6BF5"),
                ("📈 Trend Hashtags","trend_hashtags","#16A34A"),
                ("🎯 Niche Hashtags","niche_hashtags","#EA580C"),
            ]:
                tags = hs.get(tier_key,[])
                if tags:
                    st.markdown(f'<div style="font-size:11px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px">{tier_label}</div>', unsafe_allow_html=True)
                    tag_html = " ".join(f'<span class="kpi-pill" style="color:{tier_color};border-color:{tier_color}33">{t if isinstance(t,str) else t.get("tag",str(t))}</span>' for t in tags)
                    st.markdown(f'<div style="display:flex;flex-wrap:wrap;gap:6px">{tag_html}</div>', unsafe_allow_html=True)
            all_tags = []
            for k in ["brand_hashtags","trend_hashtags","niche_hashtags"]:
                for t in hs.get(k,[]):
                    all_tags.append(t if isinstance(t,str) else t.get("tag",str(t)))
            if all_tags:
                st.markdown("<br>", unsafe_allow_html=True)
                st.code(" ".join(all_tags), language=None)
        elif active_sec == "calendar":
            for i, hook in enumerate(r.get("calendar_hooks",[])):
                text = hook if isinstance(hook,str) else hook.get("text",str(hook))
                st.markdown(
                    f'<div class="post-card" style="display:flex;align-items:flex-start;gap:12px">'
                    f'<span style="background:#EBF0FF;color:#3B6BF5;font-size:12px;font-weight:700;'
                    f'padding:3px 10px;border-radius:20px;flex-shrink:0">{i+1}</span>'
                    f'<span style="font-size:13px;color:#334155">{text}</span></div>', unsafe_allow_html=True)
        render_save_to_campaign("cf", brand=r.get("_brand",""), platforms=r.get("_platforms",[]),
                                tone=r.get("_tone","Professional"),
                                output_count=len(r.get("content_pillars",[])) or 5, result_data=r)
        if st.button("← Back", key="cf_back"): st.session_state.custom_result = None; st.session_state.active_panel = None; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ALL CAMPAIGNS  (Dashboard)
# ─────────────────────────────────────────────────────────────────────────────
def page_campaigns():
    campaigns = st.session_state.saved_campaigns
    c1, c2 = st.columns([3, 1])
    with c1:
        st.markdown('<div class="topbar-title">All Campaigns</div>'
                    '<div class="topbar-sub">AI-powered social media generation — Socialyze</div>', unsafe_allow_html=True)
    with c2:
        if st.button("＋ New Campaign", type="primary", key="dash_new", use_container_width=True):
            st.session_state.active_panel = "quick"; st.rerun()
    total     = len(campaigns)
    outputs   = sum(c.get("output_count",1) for c in campaigns)
    plat_set  = set(p for c in campaigns for p in c.get("platforms",[]))
    tones     = [c.get("tone","") for c in campaigns if c.get("tone")]
    top_tone  = max(set(tones), key=tones.count) if tones else "—"
    tone_disp = (top_tone[0].upper()+top_tone[1:]) if top_tone != "—" else "—"
    st.markdown(f"""<div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Campaigns</div><div class="stat-value">{total}</div>
            <span class="stat-change {'stat-up' if total>0 else 'stat-down'}">{total} total</span></div>
        <div class="stat-card"><div class="stat-label">Posts Generated</div><div class="stat-value">{outputs}</div>
            <span class="stat-change {'stat-up' if outputs>0 else 'stat-down'}">{outputs} output{'s' if outputs!=1 else ''} saved</span></div>
        <div class="stat-card"><div class="stat-label">Platforms Used</div><div class="stat-value">{len(plat_set)}</div>
            <span class="stat-change {'stat-up' if plat_set else 'stat-down'}">{len(plat_set)} platform{'s' if len(plat_set)!=1 else ''} active</span></div>
        <div class="stat-card"><div class="stat-label">Avg. Tone</div>
            <div class="stat-value" style="font-size:{'22px' if len(tone_disp)<=8 else '16px'}">{tone_disp}</div>
            <span class="stat-change {'stat-up' if tone_disp!='—' else 'stat-down'}">Most used tone</span></div>
    </div>""", unsafe_allow_html=True)
    panel = st.session_state.active_panel
    if panel == "quick":    panel_quick();    return
    if panel == "ai":       panel_generate(); return
    if panel == "generate": panel_generate(); return
    if panel == "audience": panel_audience(); return
    if panel == "ideation": panel_ideation(); return
    if panel == "custom":   panel_custom();   return
    st.markdown('<div class="sec-title">Start Generating</div>'
                '<div class="sec-sub">Select a framework to bootstrap your campaign.</div>', unsafe_allow_html=True)
    fw_defs = [
        ("ai",       "#EBF0FF", "#3B6BF5", "⚡", "AI Post Generator",  "Multi-platform captions & hashtags via Groq"),
        ("audience", "#F0FDF4", "#16A34A", "👥", "Audience Targeting", "Persona-matched messaging strategy"),
        ("ideation", "#FFF7ED", "#EA580C", "💡", "Campaign Ideation",  "Creative concepts & content calendar ideas"),
        ("custom",   "#FDF4FF", "#9333EA", "⚙",  "Custom Flow",        "AI-generated bespoke campaign skeleton"),
    ]
    fw_cols = st.columns(4)
    for col, (pid, bg, stroke, emoji, name, desc) in zip(fw_cols, fw_defs):
        with col:
            st.markdown(
                f'<div class="fw-card-wrap-outer">'
                f'  <div class="fw-card-inner">'
                f'    <div class="fw-icon" style="background:{bg}">{emoji}</div>'
                f'    <div class="fw-name">{name}</div>'
                f'    <div class="fw-desc">{desc}</div>'
                f'  </div>'
                f'</div>',
                unsafe_allow_html=True,
            )
            if st.button(f"Open {name} →", key=f"fw_{pid}", use_container_width=True):
                st.session_state.active_panel = pid; st.rerun()
    st.markdown("<br>", unsafe_allow_html=True)
    sub_txt = f' — showing 4 of {len(campaigns)}' if len(campaigns) > 4 else ''
    st.markdown(f'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
                f'<div><span class="active-title">Recent Campaigns</span>'
                f'<span class="active-sub">{sub_txt}</span></div></div>', unsafe_allow_html=True)
    if not campaigns:
        st.markdown('<div class="empty-state"><div class="empty-icon">🚀</div>'
                    '<div class="empty-title">No campaigns yet</div>'
                    '<div class="empty-sub">Click <strong>New Campaign</strong> to get started!</div></div>',
                    unsafe_allow_html=True)
    else:
        render_campaign_grid(campaigns[:4], source="dash", cols=4)
    st.markdown('<div class="footer"><strong>Socialyze</strong> — Sourcesys Technologies</div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ACTIVE CAMPAIGNS
# ─────────────────────────────────────────────────────────────────────────────
def page_active():
    campaigns = st.session_state.saved_campaigns
    c1, c2 = st.columns([4, 1])
    with c1:
        st.markdown(f'<div class="page-hdr"><div><div class="page-title">Active Campaigns</div>'
                    f'<div class="page-sub">All your AI-generated campaigns in one place · {len(campaigns)} total</div>'
                    f'</div></div>', unsafe_allow_html=True)
    with c2:
        if st.button("↺ Refresh", key="act_refresh", use_container_width=True): st.rerun()
    col_s, col_c = st.columns([4, 1])
    with col_s:
        search = st.text_input("", placeholder="🔍  Search by brand or campaign name…", key="act_search", label_visibility="collapsed")
    filtered = [c for c in campaigns if search.lower() in c.get("campaign_name","").lower()] if search else campaigns
    with col_c:
        if search:
            st.markdown(f'<div class="search-result-count" style="margin-top:10px">{len(filtered)} result{"s" if len(filtered)!=1 else ""}</div>',
                        unsafe_allow_html=True)
    if not campaigns:
        st.markdown('<div class="empty-state"><div class="empty-icon">📋</div>'
                    '<div class="empty-title">No campaigns yet</div>'
                    '<div class="empty-sub">Generate content from All Campaigns to see it here.</div></div>', unsafe_allow_html=True)
    elif not filtered:
        st.markdown(f'<div class="empty-state"><div class="empty-icon">🔍</div>'
                    f'<div class="empty-title">No matches for &ldquo;{search}&rdquo;</div>'
                    f'<div class="empty-sub">Try a different name.</div></div>', unsafe_allow_html=True)
    else:
        render_campaign_grid(filtered, source="active", cols=3)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: CAMPAIGN BRIEF
# ─────────────────────────────────────────────────────────────────────────────
def page_brief():
    brief     = st.session_state.brief
    has_brief = bool(brief.get("brand_name"))
    saved_badge = '<span class="saved-badge">✓ Brief Saved</span>' if has_brief else ""
    st.markdown(f'<div class="page-hdr"><div style="display:flex;align-items:flex-start;gap:14px">'
                f'<div><div class="page-title">Campaign Brief</div>'
                f'<div class="page-sub">{"Your default campaign brief is saved. Edit and re-save anytime." if has_brief else "Set up default campaign inputs to pre-fill any AI panel automatically."}</div>'
                f'</div></div>{saved_badge}</div>', unsafe_allow_html=True)
    st.markdown('<div class="info-banner"><span>ℹ</span>'
                '<span>Campaign Brief is <strong>optional</strong>. When saved, click '
                '<strong>"📋 From Campaign Brief"</strong> inside any AI service panel to pre-fill its fields instantly.</span></div>',
                unsafe_allow_html=True)
    st.markdown('<div class="form-card"><div class="card-title">Campaign Details</div>', unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        brand_name      = st.text_input("Brand / Company Name *",  value=brief.get("brand_name",""),      placeholder="e.g. Nike, Zomato, Sourcesys", key="br_brand")
        product_service = st.text_input("Product / Service *",     value=brief.get("product_service",""), placeholder="e.g. Running Shoes", key="br_prod")
    with c2:
        campaign_goal   = st.text_input("Campaign Goal *",         value=brief.get("campaign_goal",""),   placeholder="e.g. Drive app installs", key="br_goal")
        target_audience = st.text_input("Target Audience *",       value=brief.get("target_audience",""), placeholder="e.g. Millennials in metro cities", key="br_aud")
    st.markdown("**Default Tone**")
    # Seed the tone picker from the saved brief on first visit; keep it across reruns
    _brief_tone_default = brief.get("tone", "Inspirational")
    if "br_selected_tone" not in st.session_state:
        st.session_state.br_selected_tone = _brief_tone_default
    selected_tone = st.session_state.br_selected_tone
    tone_cols = st.columns(len(TONES))
    for i, t in enumerate(TONES):
        with tone_cols[i]:
            if st.button(t, key=f"br_tone_{t}",
                         type="primary" if t == selected_tone else "secondary",
                         use_container_width=True):
                st.session_state.br_selected_tone = t
                st.rerun()
    st.markdown("**Platforms** (optional)")
    current_plats  = brief.get("platforms",[])
    plat_cols      = st.columns(len(PLATFORMS))
    selected_plats = []
    for i, p in enumerate(PLATFORMS):
        with plat_cols[i]:
            if st.checkbox(p, value=p in current_plats, key=f"br_plat_{p}"): selected_plats.append(p)
    st.markdown("</div>", unsafe_allow_html=True)
    if st.button("💾 " + ("Update Brief" if has_brief else "Save Brief"), type="primary", key="br_save"):
        if not brand_name.strip() or not product_service.strip() or not campaign_goal.strip() or not target_audience.strip():
            st.error("All fields marked * are required.")
        else:
            st.session_state.brief = {"brand_name": brand_name.strip(), "product_service": product_service.strip(),
                                       "campaign_goal": campaign_goal.strip(), "target_audience": target_audience.strip(),
                                       "tone": st.session_state.get("br_selected_tone", "Inspirational"),
                                       "platforms": selected_plats}
            _flush()
            st.success("✓ Campaign Brief saved! Use 'Import Data' in any AI panel to auto-fill.")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: CONTENT PLANNER
# ─────────────────────────────────────────────────────────────────────────────
def page_planner():
    tasks = st.session_state.content_tasks
    c1, c2 = st.columns([4, 1])
    with c1:
        st.markdown('<div class="page-hdr"><div><div class="page-title">Content Planner</div>'
                    '<div class="page-sub">Plan, track, and manage your content tasks across all platforms.</div>'
                    '</div></div>', unsafe_allow_html=True)
    with c2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("＋ Add Task", type="primary", key="planner_add_btn", use_container_width=True):
            st.session_state["planner_show_form"] = not st.session_state.get("planner_show_form", False)
    if st.session_state.get("planner_show_form", False):
        st.markdown('<div class="form-card"><div class="card-title">Add Content Task</div>', unsafe_allow_html=True)
        c1, c2, c3 = st.columns(3)
        with c1:
            t_title    = st.text_input("Task Title *",  key="nt_title",  placeholder="e.g. Instagram Reel — Product Launch")
            t_type     = st.text_input("Task Type *",   key="nt_type",   placeholder="e.g. Reel, Story, Blog Post")
        with c2:
            t_platform = st.selectbox("Platform", ["Instagram","Twitter / X","LinkedIn","Facebook","TikTok","YouTube","Pinterest","Threads","Other"], key="nt_plat")
            t_status   = st.selectbox("Column", ["Planned","In Progress","Completed"], key="nt_status")
        with c3:
            t_date = st.date_input("Date", key="nt_date")
            t_time = st.time_input("Time", key="nt_time")
        t_desc = st.text_area("Description (optional)", key="nt_desc", placeholder="Brief notes…", height=70)
        ca, cb = st.columns(2)
        with ca:
            if st.button("Cancel", key="nt_cancel"): st.session_state["planner_show_form"] = False; st.rerun()
        with cb:
            if st.button("✔ Add Task", type="primary", use_container_width=True, key="nt_add"):
                if not t_title.strip() or not t_type.strip(): st.warning("Task Title and Type are required.")
                else:
                    st.session_state.content_tasks.append({"id": len(tasks), "title": t_title.strip(),
                        "platform": t_platform, "task_type": t_type, "date": str(t_date),
                        "time": str(t_time)[:5], "status": t_status, "description": t_desc})
                    _flush()
                    st.session_state["planner_show_form"] = False; st.success(f"✓ Task '{t_title}' added!"); st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    cols = st.columns(3)
    for col_widget, kc in zip(cols, KANBAN_COLS):
        col_tasks = [t for t in tasks if t.get("status") == kc["id"]]
        with col_widget:
            st.markdown(f'<div class="kanban-col"><div class="kanban-col-hdr">'
                        f'<span style="width:8px;height:8px;border-radius:50%;background:{kc["color"]};display:inline-block;margin-right:4px;flex-shrink:0"></span>'
                        f'<span class="kanban-col-label">{kc["label"]}</span>'
                        f'<span class="kanban-col-count" style="background:{kc["bg"]};color:{kc["color"]}">{len(col_tasks)}</span></div>',
                        unsafe_allow_html=True)
            if not col_tasks:
                st.markdown('<div class="task-empty">⊕ Drop tasks here</div>', unsafe_allow_html=True)
            else:
                for t in col_tasks:
                    type_pill = f'<span class="task-type-pill">{t.get("task_type","")}</span>' if t.get("task_type") else ""
                    plat_pill = f'<span class="task-plat-pill">{t.get("platform","")}</span>'   if t.get("platform")  else ""
                    desc_html = (f"<p style='font-size:12px;color:#5A607A;margin-top:6px;line-height:1.5'>"
                                 f"{t.get('description','')[:80]}{'…' if len(t.get('description',''))>80 else ''}</p>"
                                 if t.get("description") else "")
                    st.markdown(f'<div class="kanban-task"><div class="task-title">{t["title"]}</div>'
                                f'<div class="task-meta">{type_pill} {plat_pill}</div>{desc_html}'
                                f'<div class="task-footer"><span>📅 {t.get("date","")}</span><span>🕐 {t.get("time","")}</span></div></div>',
                                unsafe_allow_html=True)
                    move_opts  = [s["id"] for s in KANBAN_COLS if s["id"] != kc["id"]]
                    new_status = st.selectbox("", ["— keep —"] + move_opts, key=f"mv_{t['id']}_{kc['id']}", label_visibility="collapsed")
                    if new_status != "— keep —":
                        for task in st.session_state.content_tasks:
                            if task["id"] == t["id"]: task["status"] = new_status
                        _flush(); st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: COMPLIANCE GUARD
# ─────────────────────────────────────────────────────────────────────────────
def page_compliance():
    PLATFORM_ICONS = {"Instagram":"📷","Twitter":"𝕏","LinkedIn":"in","TikTok":"♪","Facebook":"f","YouTube":"▶"}
    st.markdown('<div class="page-hdr"><div><span class="page-badge">🛡 Compliance Guard</span>'
                '<div class="page-title">Compliance Guard</div>'
                '<div class="page-sub">Paste your post copy and check it against platform rules, character limits, hashtag policies, brand tone, and copyright risk signals.</div>'
                '</div></div>', unsafe_allow_html=True)
    left, right = st.columns([5, 6])
    with left:
        st.markdown('<div class="compliance-step-block"><div class="compliance-step-label">'
                    '<span class="compliance-step-num">1</span> CAMPAIGN '
                    '<span style="font-size:10px;color:#9BA3BB;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span>'
                    '</div></div>', unsafe_allow_html=True)
        camps = st.session_state.saved_campaigns
        camp_options = ["No campaign (generic check)"] + [cap_first(c.get("campaign_name","")) for c in camps]
        st.selectbox("Campaign", camp_options, key="cg_camp", label_visibility="collapsed")
        st.markdown('<div class="compliance-step-block" style="margin-top:16px"><div class="compliance-step-label">'
                    '<span class="compliance-step-num">2</span> PLATFORM</div></div>', unsafe_allow_html=True)
        platform  = st.session_state.get("compliance_platform","Instagram")
        all_plats = ["Instagram","Twitter","LinkedIn","TikTok","Facebook","YouTube"]
        for row in [all_plats[:3], all_plats[3:]]:
            row_cols = st.columns(3)
            for col_w, p in zip(row_cols, row):
                with col_w:
                    if st.button(f"{PLATFORM_ICONS.get(p,'•')} {p}", key=f"cg_plat_{p}", use_container_width=True,
                                 type="primary" if platform == p else "secondary"):
                        st.session_state.compliance_platform = p
                        st.session_state.compliance_checked  = False
                        st.session_state.compliance_result   = None; st.rerun()
        st.markdown('<div class="compliance-step-block" style="margin-top:16px"><div class="compliance-step-label">'
                    '<span class="compliance-step-num">3</span> POST COPY</div></div>', unsafe_allow_html=True)
        platform   = st.session_state.get("compliance_platform","Instagram")
        char_limit = {"Instagram":2200,"Twitter":280,"LinkedIn":3000,"Facebook":63206,"TikTok":2200,"YouTube":5000}.get(platform,9999)
        post_text  = st.text_area("", value=st.session_state.compliance_text,
                                  placeholder=f"Paste your {platform} post copy here…",
                                  height=200, key="cg_text", label_visibility="collapsed")
        char_count = len(post_text)
        over_limit = char_count > char_limit
        over_txt   = " ⚠ Over limit" if over_limit else ""
        st.markdown(f'<div style="font-size:12px;color:{"#DC2626" if over_limit else "#9BA3BB"};margin-bottom:4px">'
                    f'{char_count:,} / {char_limit:,} chars{over_txt}</div>', unsafe_allow_html=True)
        run_btn = st.button("🛡 Run Compliance Check", type="primary", use_container_width=True,
                            key="cg_check", disabled=not post_text.strip())
        if run_btn and post_text.strip():
            st.session_state.compliance_text    = post_text
            st.session_state.compliance_checked = True
            rules = PLATFORM_RULES.get(platform,[])
            passed=[]; failed=[]; warnings=[]
            for rule_id, label, check_fn, msg in rules:
                ok = check_fn(post_text)
                if ok: passed.append((rule_id, label, msg))
                elif rule_id in ("has_cta","optimal_len"): warnings.append((rule_id, label, msg))
                else: failed.append((rule_id, label, msg))
            score      = int((len(passed) / max(len(rules),1)) * 100)
            hashtags   = [w for w in post_text.split() if w.startswith("#")]
            risk_level = "High" if (len(failed)>=3 or over_limit) else "Medium" if len(failed)>=1 else "Low"
            st.session_state.compliance_result = {"passed":passed,"failed":failed,"warnings":warnings,
                "score":score,"hashtags":hashtags,"platform":platform,"char_count":char_count,"risk_level":risk_level}
            st.rerun()
        if st.session_state.compliance_checked:
            if st.button("↺ Clear & Reset", key="cg_reset"):
                st.session_state.compliance_text    = ""
                st.session_state.compliance_checked = False
                st.session_state.compliance_result  = None; st.rerun()
    with right:
        result = st.session_state.compliance_result
        if not st.session_state.compliance_checked or result is None:
            plat_preview  = st.session_state.get("compliance_platform","Instagram")
            rules_preview = PLATFORM_RULES.get(plat_preview,[])
            rule_items    = "".join(f'<div class="rule-preview-item"><span class="rule-preview-dot" style="background:#3B6BF5"></span>{label}</div>'
                                    for _, label, _, _ in rules_preview)
            st.markdown(f'<div style="text-align:center;padding:40px 20px 20px">'
                        f'<div style="font-size:40px;margin-bottom:16px">🛡</div>'
                        f'<div style="font-family:\'Syne\',sans-serif;font-size:16px;font-weight:700;color:#0D0F1A;margin-bottom:8px">Your compliance report will appear here</div>'
                        f'<div style="font-size:13px;color:#9BA3BB;line-height:1.6;max-width:300px;margin:0 auto">Checks your post against {plat_preview}\'s platform rules.</div></div>'
                        f'<div class="rule-preview"><div class="rule-preview-title" style="color:#3B6BF5">{plat_preview.upper()} QUALITY RULES</div>'
                        f'{rule_items}</div>', unsafe_allow_html=True)
        else:
            score      = result["score"]
            risk_level = result["risk_level"]
            sc_class   = "score-green" if score>=80 else "score-amber" if score>=50 else "score-red"
            risk_class = "risk-low" if risk_level=="Low" else "risk-medium" if risk_level=="Medium" else "risk-high"
            risk_emoji = "✅" if risk_level=="Low" else "⚠️" if risk_level=="Medium" else "🔴"
            risk_sub   = "Safe to publish" if risk_level=="Low" else "Review before posting" if risk_level=="Medium" else "Immediate action needed"
            ring_color = "#16A34A" if score>=80 else "#D97706" if score>=50 else "#DC2626"
            st.markdown(f'<div class="score-card">'
                        f'<div style="flex:1"><div class="score-label">Compliance Score</div>'
                        f'<div class="score-value {sc_class}">{score}%</div>'
                        f'<div style="font-size:12px;color:#9BA3BB;margin-top:4px">{result["platform"]} · {result["char_count"]:,} chars</div></div>'
                        f'<div style="flex:1;text-align:center"><div class="score-label">Risk Level</div>'
                        f'<div class="risk-badge {risk_class}" style="margin:6px 0;display:inline-flex">{risk_emoji} {risk_level}</div>'
                        f'<div style="font-size:11.5px;color:#9BA3BB">{risk_sub}</div></div>'
                        f'<div style="flex-shrink:0"><svg width="80" height="80" viewBox="0 0 80 80">'
                        f'<circle cx="40" cy="40" r="30" fill="none" stroke="#F0F2F8" stroke-width="8"/>'
                        f'<circle cx="40" cy="40" r="30" fill="none" stroke="{ring_color}" stroke-width="8" '
                        f'stroke-dasharray="{(score/100)*188.5:.1f} 188.5" stroke-linecap="round" transform="rotate(-90 40 40)"/>'
                        f'<text x="40" y="46" text-anchor="middle" font-size="15" font-weight="700" fill="{ring_color}" '
                        f'font-family="DM Sans, sans-serif">{score}%</text></svg></div></div>', unsafe_allow_html=True)
            tabs = st.tabs(["✓ Quality Checks","⚠ Policy & Risk"])
            with tabs[0]:
                if result["failed"]:
                    n_failed = len(result["failed"])
                    st.markdown(f'<div style="font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">● Issues to Fix ({n_failed})</div>', unsafe_allow_html=True)
                    for _, label, msg in result["failed"]:
                        st.markdown(f'<div class="check-item"><span style="font-size:16px;flex-shrink:0">❌</span>'
                                    f'<div><div class="check-label">{label}</div><div class="check-msg">{msg}</div></div></div>', unsafe_allow_html=True)
                if result["warnings"]:
                    n_warn = len(result["warnings"])
                    st.markdown(f'<div style="font-size:12px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:.07em;margin:14px 0 8px">● Suggestions ({n_warn})</div>', unsafe_allow_html=True)
                    for _, label, msg in result["warnings"]:
                        st.markdown(f'<div class="check-item"><span style="font-size:16px;flex-shrink:0">⚠️</span>'
                                    f'<div><div class="check-label">{label}</div><div class="check-msg">{msg}</div></div></div>', unsafe_allow_html=True)
                if result["passed"]:
                    n_pass = len(result["passed"])
                    st.markdown(f'<div style="font-size:12px;font-weight:700;color:#16A34A;text-transform:uppercase;letter-spacing:.07em;margin:14px 0 8px">● Passing ({n_pass})</div>', unsafe_allow_html=True)
                    pass_cols = st.columns(2)
                    for i, (_, label, _) in enumerate(result["passed"]):
                        with pass_cols[i % 2]:
                            st.markdown(f'<div style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#16A34A;padding:5px 0">✅ {label}</div>', unsafe_allow_html=True)
            with tabs[1]:
                ht_count = len(result["hashtags"])
                rec_max  = {"Instagram":30,"Twitter":2,"LinkedIn":5,"Facebook":10,"TikTok":8,"YouTube":3}.get(result["platform"],10)
                ht_color = "#16A34A" if ht_count<=rec_max else "#D97706"
                ht_ok    = "✅ Good" if ht_count<=rec_max else "⚠️ Too many"
                st.markdown(f'<div class="result-card"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
                            f'<div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:10px">'
                            f'<div style="font-size:22px;font-weight:700;color:#0D0F1A">{result["char_count"]:,}</div>'
                            f'<div style="font-size:10.5px;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-top:3px">Characters</div></div>'
                            f'<div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:10px">'
                            f'<div style="font-size:22px;font-weight:700;color:{ht_color}">{ht_count}</div>'
                            f'<div style="font-size:10.5px;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-top:3px">Hashtags</div></div>'
                            f'<div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:10px">'
                            f'<div style="font-size:14px;font-weight:700;color:{ht_color}">{ht_ok}</div>'
                            f'<div style="font-size:10.5px;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-top:3px">Hashtag Check</div></div>'
                            f'</div></div>', unsafe_allow_html=True)
                if result["hashtags"]:
                    st.markdown(f'<div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;margin-top:8px">'
                                f'<div style="font-size:11px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Detected Hashtags</div>'
                                f'<div style="font-size:13px;color:#3B82F6;font-weight:500;line-height:1.9">{" ".join(result["hashtags"][:30])}</div></div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: SHARED WORKSPACES
# ─────────────────────────────────────────────────────────────────────────────
def page_shared():
    campaigns = st.session_state.saved_campaigns
    c1, c2 = st.columns([4, 1])
    with c1:
        st.markdown('<div class="page-hdr"><div><div class="page-title">Shared Workspaces</div>'
                    '<div class="page-sub">Collaborate on campaigns with your team in real time.</div>'
                    '</div></div>', unsafe_allow_html=True)
    with c2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("＋ Share a Campaign", type="primary", key="sw_share_btn", use_container_width=True):
            st.session_state.shared_tab = "share"; st.rerun()
    tab    = st.session_state.shared_tab
    shares = st.session_state.my_shares
    out_count = len(shares)
    t_cols = st.columns(3)
    tab_defs = [("incoming","📨  Shared With Me"),
                ("outgoing", f"📤  My Shares" + (f"  {out_count}" if out_count else "")),
                ("share","✦  New Share")]
    for col_w, (tid, lbl) in zip(t_cols, tab_defs):
        with col_w:
            if st.button(lbl, key=f"sh_tab_{tid}", type="primary" if tab==tid else "secondary", use_container_width=True):
                st.session_state.shared_tab = tid; st.rerun()
    st.markdown("<br>", unsafe_allow_html=True)
    if tab == "incoming":
        st.markdown('<div class="empty-state"><div class="empty-icon">📨</div>'
                    '<div class="empty-title">No campaigns shared with you yet</div>'
                    '<div class="empty-sub">When a teammate shares a campaign with your email, it will appear here.</div></div>',
                    unsafe_allow_html=True)
    elif tab == "outgoing":
        if not shares:
            st.markdown('<div class="empty-state"><div class="empty-icon">📤</div>'
                        '<div class="empty-title">You haven\'t shared any campaigns yet</div>'
                        '<div class="empty-sub">Use the \'New Share\' tab to invite a teammate.</div></div>', unsafe_allow_html=True)
            if st.button("→ Share a Campaign", type="primary", key="sw_goto_share"):
                st.session_state.shared_tab = "share"; st.rerun()
        else:
            for i, s in enumerate(shares):
                av_bg, av_fg = avatar_color(s["email"])
                perm_class = "perm-badge-edit" if s["permission"]=="edit" else "perm-badge-view"
                perm_label = "✎ Edit" if s["permission"]=="edit" else "👁 View"
                st.markdown(f'<div class="share-row-card">'
                            f'<div class="share-avatar-sm" style="background:{av_bg};color:{av_fg}">{s["email"][:2].upper()}</div>'
                            f'<div style="flex:1"><div class="share-email">{s["email"]}</div>'
                            f'<div class="share-camp-name">⚡ {cap_first(s["campaign"])}</div></div>'
                            f'<span class="{perm_class}">{perm_label}</span></div>', unsafe_allow_html=True)
                if st.button("Revoke", key=f"sw_revoke_{i}", type="secondary"):
                    st.session_state.my_shares = [x for x in shares if x!=s]
                    _flush(); st.rerun()
    else:
        st.markdown('<div class="share-form-wrap"><div class="share-form-title">Invite a Teammate</div>'
                    '<p class="share-form-sub">Share any campaign with a team member.</p>',
                    unsafe_allow_html=True)
        camp_names = [c.get("campaign_name","") for c in campaigns]
        if not camp_names:
            st.info("No campaigns found. Generate one first from All Campaigns.")
        else:
            camp_options_disp = [cap_first(n) for n in camp_names]
            sel_idx   = st.selectbox("Campaign", range(len(camp_options_disp)), format_func=lambda x: camp_options_disp[x], key="sw_camp_sel")
            sel_camp  = camp_names[sel_idx]
            inv_email = st.text_input("Teammate's Email", placeholder="teammate@company.com", key="sw_email")
            st.markdown("**Permission**")
            perm_state = st.session_state.get("sw_perm","view")
            perm_cols  = st.columns(2)
            with perm_cols[0]:
                if st.button("👁 View only", key="sw_perm_view", use_container_width=True,
                             type="primary" if perm_state=="view" else "secondary"):
                    st.session_state["sw_perm"]="view"; st.rerun()
            with perm_cols[1]:
                if st.button("✎ Can edit", key="sw_perm_edit", use_container_width=True,
                             type="primary" if perm_state=="edit" else "secondary"):
                    st.session_state["sw_perm"]="edit"; st.rerun()
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("📤 Send Invite", type="primary", key="sw_submit", use_container_width=True):
                if not inv_email or "@" not in inv_email: st.error("Please enter a valid email address.")
                else:
                    st.session_state.my_shares.append({"email":inv_email.strip(),"campaign":sel_camp,"permission":st.session_state.get("sw_perm","view")})
                    _flush()
                    st.success(f"✓ Invite sent to {inv_email.strip()}!")
                    st.session_state.shared_tab = "outgoing"; st.rerun()
        st.markdown('<div class="feature-list">'
                    '<div class="feature-item"><span>📨</span><span>Invite by email — view or edit permissions</span></div>'
                    '<div class="feature-item"><span>🔗</span><span>Invitee can open any output saved to the workspace</span></div>'
                    '<div class="feature-item"><span>🔒</span><span>Only the owner can save or delete the campaign</span></div>'
                    '<div class="feature-item"><span>🔔</span><span>Revoke access at any time from "My Shares"</span></div>'
                    '</div></div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: FAVOURITES
# ─────────────────────────────────────────────────────────────────────────────
def page_fav():
    campaigns = st.session_state.saved_campaigns
    fav_ids   = st.session_state.fav_ids
    favs      = [c for c in campaigns if c.get("id") in fav_ids]
    sub = "Star any campaign to pin it here." if not favs else f"{len(favs)} pinned campaign{'s' if len(favs)!=1 else ''}"
    c1, c2 = st.columns([4,1])
    with c1:
        st.markdown(f'<div class="page-hdr"><div><div class="page-title">Favourites</div>'
                    f'<div class="page-sub">{sub}</div></div></div>', unsafe_allow_html=True)
    with c2:
        if st.button("↺ Refresh", key="fav_refresh", use_container_width=True): st.rerun()
    if not favs:
        st.markdown('<div class="empty-state"><div class="empty-icon">⭐</div>'
                    '<div class="empty-title">No favourites yet</div>'
                    '<div class="empty-sub">Click ☆ on any campaign below to pin it here.</div></div>', unsafe_allow_html=True)
        if campaigns:
            st.markdown('<div style="font-size:12px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.09em;margin-bottom:12px">All Campaigns — click ☆ to favourite</div>',
                        unsafe_allow_html=True)
            n = min(len(campaigns), 3); cols = st.columns(n)
            for i, c in enumerate(campaigns):
                cid = c.get("id",i); is_fav = cid in fav_ids
                with cols[i % n]:
                    st.markdown(campaign_card_html(c), unsafe_allow_html=True)
                    if st.button("★ Favourited" if is_fav else "☆ Favourite", key=f"fav_{cid}_{i}",
                                 type="primary" if is_fav else "secondary", use_container_width=True):
                        st.session_state.fav_ids = [x for x in fav_ids if x!=cid] if is_fav else fav_ids+[cid]
                        _flush(); st.rerun()
    else:
        search = st.text_input("🔍 Search favourites…", key="fav_search")
        shown  = [c for c in favs if search.lower() in c.get("campaign_name","").lower()] if search else favs
        if not shown and search:
            st.markdown(f'<div class="empty-state"><div class="empty-icon">🔍</div>'
                        f'<div class="empty-title">No matches</div>'
                        f'<div class="empty-sub">No favourites match &ldquo;{search}&rdquo;.</div></div>', unsafe_allow_html=True)
        n = min(len(shown), 3) if shown else 0
        if n:
            cols = st.columns(n)
            for i, c in enumerate(shown):
                cid = c.get("id",i)
                with cols[i % n]:
                    st.markdown(campaign_card_html(c), unsafe_allow_html=True)
                    col_a, col_b = st.columns(2)
                    with col_a:
                        if st.button("Open →", key=f"fav_open_{cid}_{i}", use_container_width=True, type="primary"): open_workspace(cid)
                    with col_b:
                        if st.button("★ Remove", key=f"unfav_{cid}_{i}", use_container_width=True):
                            st.session_state.fav_ids = [x for x in fav_ids if x!=cid]
                            _flush(); st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ARCHIVED
# ─────────────────────────────────────────────────────────────────────────────
def page_archived():
    campaigns = st.session_state.saved_campaigns
    arc_ids   = st.session_state.archived_ids
    archived  = [c for c in campaigns if c.get("id") in arc_ids]
    sub = "Archive campaigns to keep but step back from." if not archived else f"{len(archived)} archived campaign{'s' if len(archived)!=1 else ''}"
    c1, c2 = st.columns([4,1])
    with c1:
        st.markdown(f'<div class="page-hdr"><div><div class="page-title">Archived</div>'
                    f'<div class="page-sub">{sub}</div></div></div>', unsafe_allow_html=True)
    with c2:
        if st.button("↺ Refresh", key="arc_refresh", use_container_width=True): st.rerun()
    if not archived:
        st.markdown('<div class="empty-state"><div class="empty-icon">📦</div>'
                    '<div class="empty-title">No archived campaigns</div>'
                    '<div class="empty-sub">Click 📦 on any campaign below to move it here.</div></div>', unsafe_allow_html=True)
        if campaigns:
            n = min(len(campaigns), 3); cols = st.columns(n)
            for i, c in enumerate(campaigns):
                cid = c.get("id",i); is_arc = cid in arc_ids
                with cols[i % n]:
                    st.markdown(campaign_card_html(c), unsafe_allow_html=True)
                    if st.button("📦 Archive" if not is_arc else "↩ Unarchive", key=f"arc_{cid}_{i}",
                                 type="secondary", use_container_width=True):
                        st.session_state.archived_ids = [x for x in arc_ids if x!=cid] if is_arc else arc_ids+[cid]
                        _flush(); st.rerun()
    else:
        n = min(len(archived), 3); cols = st.columns(n)
        for i, c in enumerate(archived):
            cid = c.get("id",i)
            with cols[i % n]:
                st.markdown(campaign_card_html(c), unsafe_allow_html=True)
                col_a, col_b = st.columns(2)
                with col_a:
                    if st.button("Open →", key=f"arc_open_{cid}_{i}", use_container_width=True, type="primary"): open_workspace(cid)
                with col_b:
                    if st.button("↩ Unarchive", key=f"unarc_{cid}_{i}", use_container_width=True):
                        st.session_state.archived_ids = [x for x in arc_ids if x!=cid]
                        _flush(); st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: BRANDS
# ─────────────────────────────────────────────────────────────────────────────
def page_brands():
    brands = st.session_state.brands
    c1, c2 = st.columns([4,1])
    with c1:
        st.markdown('<div class="page-hdr"><div><div class="page-title">Brand &amp; Client Hub</div>'
                    '<div class="page-sub">Manage all your brand profiles. Each brand pre-fills your campaign brief automatically.</div>'
                    '</div></div>', unsafe_allow_html=True)
    if brands:
        brand_cols = st.columns(min(len(brands),3))
        for i, b in enumerate(brands):
            color = b.get("color", BRAND_COLORS[i % len(BRAND_COLORS)])
            inits = brand_inits(b.get("name","BR"))
            plat_pills = "".join(f'<span class="brand-plat-pill">{p}</span>' for p in b.get("platforms",[])[:4])
            with brand_cols[i % 3]:
                _hx = color.lstrip('#')
                _r2,_g2,_b2 = int(_hx[0:2],16),int(_hx[2:4],16),int(_hx[4:6],16)
                _br = (_r2*299+_g2*587+_b2*114)//1000
                _tc = '#FFFFFF' if _br < 160 else '#1E293B'
                st.markdown(
                    f'<div class="brand-card">'
                    f'<div class="brand-top" style="background:{color}">'
                    f'<span class="brand-inits" style="color:{_tc}">{inits}</span>'
                    f'</div><div class="brand-body">'
                    f'<div class="brand-name">{b["name"]}</div>'
                    f'<div class="brand-industry">'
                    f'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;'
                    f'background:{color};margin-right:5px;vertical-align:middle"></span>'
                    f'{b.get("industry","")}'
                    f'</div>'
                    f'<div class="brand-plat-row">{plat_pills}</div>'
                    f'</div></div>',
                    unsafe_allow_html=True)
    if not brands:
        st.markdown('<div class="empty-state"><div class="empty-icon">💼</div>'
                    '<div class="empty-title">No brands yet</div>'
                    '<div class="empty-sub">Add your first brand profile below.</div></div>', unsafe_allow_html=True)
    st.markdown("---")
    st.markdown('<div class="card-title">➕ Add New Brand</div>', unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        b_name     = st.text_input("Brand Name *", key="nb_name", placeholder="e.g. Nike")
        b_industry = st.selectbox("Industry", INDUSTRIES, key="nb_industry")
    with c2:
        b_tone  = st.selectbox("Tone of Voice", ["Professional","Casual & Friendly","Inspirational","Witty & Humorous","Bold & Edgy","Luxury & Sophisticated","Educational","Empathetic"], key="nb_tone")
        b_notes = st.text_area("Notes", key="nb_notes", placeholder="Key messaging, goals…", height=80)
    st.markdown("**Platforms**")
    b_plats     = []
    all_plats_b = ["Instagram","Twitter / X","LinkedIn","Facebook","TikTok","YouTube","Pinterest","Threads"]
    plat_cols_b = st.columns(len(all_plats_b))
    for i, p in enumerate(all_plats_b):
        with plat_cols_b[i]:
            if st.checkbox(p, key=f"nb_plat_{p}"): b_plats.append(p)
    st.markdown("**Brand Color**")
    sel_color  = st.session_state.get("nb_color", BRAND_COLORS[0])
    swatch_html = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    for bc in BRAND_COLORS:
        ring = f'box-shadow:0 0 0 3px #fff,0 0 0 5px {bc}' if bc==sel_color else 'box-shadow:none'
        swatch_html += (f'<div style="width:36px;height:36px;border-radius:50%;background:{bc};'
                        f'cursor:pointer;{ring};transition:box-shadow 0.15s;flex-shrink:0"></div>')
    swatch_html += '</div>'
    st.markdown(swatch_html, unsafe_allow_html=True)
    color_cols = st.columns(len(BRAND_COLORS))
    for i, c in enumerate(BRAND_COLORS):
        with color_cols[i]:
            lbl = "✓" if c==sel_color else " "
            if st.button(lbl, key=f"nb_color_{i}", type="primary" if sel_color==c else "secondary",
                         use_container_width=True, help=c):
                st.session_state["nb_color"] = c; st.rerun()
    if st.button("💾 Save Brand", type="primary", key="nb_save"):
        if not b_name.strip(): st.error("Brand Name is required.")
        else:
            st.session_state.brands.append({"name":b_name.strip(),"industry":b_industry,"tone":b_tone,
                "platforms":b_plats,"notes":b_notes,"color":st.session_state.get("nb_color",BRAND_COLORS[len(brands)%len(BRAND_COLORS)])})
            _flush()
            st.success(f"✓ Brand '{b_name}' saved!"); st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: CREATOR STUDIO
# ─────────────────────────────────────────────────────────────────────────────
def page_creator():
    pkey = "cs"; _apply_pending_prefill(pkey); pre = get_panel_prefill(pkey); campaigns = st.session_state.saved_campaigns
    st.markdown('<div class="page-hdr"><div><span class="page-badge">✦ Creator Studio</span>'
                '<div class="page-title">Creator Studio</div>'
                '<div class="page-sub">Reads your brand data — outputs a 100% personalised editing guide.</div>'
                '</div></div>', unsafe_allow_html=True)
    render_import_strip(pkey)
    FORMATS       = ["reel","carousel","photo","story","thread"]
    FORMAT_LABELS = {"reel":"Reel / Short Video","carousel":"Carousel Slides","photo":"Photo Post","story":"Story Frames","thread":"Twitter Thread"}
    st.markdown('<div class="form-card">', unsafe_allow_html=True)
    camp_names = ["(None)"] + [cap_first(c.get("campaign_name","")) for c in campaigns]
    st.selectbox("Campaign (optional)", camp_names, key="cs_camp")
    c1, c2 = st.columns(2)
    with c1:
        brand   = st.text_input("Brand",   value=pre.get("brand",""),   placeholder="e.g. Nike", key="cs_brand")
        product = st.text_input("Product", value=pre.get("product",""), placeholder="e.g. Running Shoes", key="cs_product")
        tone_def = pre.get("tone","Inspirational")
        tone_cs  = st.selectbox("Tone", TONES, index=TONES.index(tone_def) if tone_def in TONES else 2, key="cs_tone")
    with c2:
        fmt     = st.selectbox("Content Format", FORMATS, format_func=lambda x: FORMAT_LABELS[x], key="cs_fmt")
        plat_cs = st.selectbox("Platform",  PLATFORMS, key="cs_plat")
        aud_cs  = st.selectbox("Audience",  AUDIENCES, index=1, key="cs_aud")
    hint = st.text_area("Content Hint (optional)", key="cs_hint", placeholder="e.g. a 30-sec Instagram Reel for product launch…", height=70)
    st.markdown("</div>", unsafe_allow_html=True)
    if st.button("✦ Generate Personalised Guide", type="primary", key="cs_gen"):
        if not brand or not product: st.warning("Fill Brand and Product.")
        else:
            fmt_name = FORMAT_LABELS[fmt]
            prompt   = (f"Social media content creator and creative director.\n"
                        f"Brand: {brand} | Product: {product} | Format: {fmt_name} | Platform: {plat_cs} | "
                        f"Tone: {tone_cs} | Audience: {aud_cs}\n"
                        f"{'Content Hint: '+hint if hint else ''}\n"
                        f'Return ONLY valid JSON: {{"script":"Full {fmt_name.lower()} with scene-by-scene breakdown.",'
                        f'"editing_steps":"Step-by-step editing guide for {plat_cs}.",'
                        f'"canva_layout":"Detailed Canva layout with dimensions, fonts, hex colors.",'
                        f'"thumbnail":"Thumbnail concept — composition, text overlay, font, colors.",'
                        f'"common_mistakes":"5 common mistakes with {fmt_name.lower()} on {plat_cs} and how to avoid each."}}')
            with st.spinner(f"Building guide with Groq ({MODEL})…"):
                result = call_groq(prompt, 2500)
            if result:
                result["_brand"] = brand; result["_format"] = fmt; result["_platforms"] = [plat_cs]; result["_tone"] = tone_cs
                st.session_state.creator_result = result; st.rerun()
    if st.session_state.creator_result:
        r       = st.session_state.creator_result
        fmt_r   = r.get("_format","reel")
        fmt_lbl = FORMAT_LABELS.get(fmt_r,"Reel Script")
        st.markdown(f'<div style="display:flex;align-items:center;gap:10px;background:#FFFFFF;'
                    f'border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;padding:12px 18px;margin-bottom:16px;">'
                    f'<span style="font-size:11px;color:#9BA3BB">Guide personalised for</span>'
                    f'<span style="font-size:13px;font-weight:700;color:#0D0F1A">{r.get("_brand","")}</span>'
                    f'<span class="kpi-pill">{fmt_lbl}</span></div>', unsafe_allow_html=True)
        tab_labels = [f"✦ {fmt_lbl}","✦ Editing Steps","✦ Canva Layout","✦ Thumbnail","✦ Mistakes to Avoid"]
        key_map    = {tab_labels[0]:"script",tab_labels[1]:"editing_steps",tab_labels[2]:"canva_layout",
                      tab_labels[3]:"thumbnail",tab_labels[4]:"common_mistakes"}
        tabs = st.tabs(tab_labels)
        for tab, lbl in zip(tabs, tab_labels):
            with tab:
                content = r.get(key_map.get(lbl,"script"),"")
                st.markdown(f'<div class="creator-result-card"><div class="creator-content">{content}</div></div>', unsafe_allow_html=True)
        render_save_to_campaign("cs", brand=r.get("_brand",""), platforms=r.get("_platforms",[]),
                                tone=r.get("_tone",""), output_count=5, result_data=r)
        c1, c2 = st.columns(2)
        with c1:
            if st.button("← Generate Another", key="cs_regen"): st.session_state.creator_result = None; st.rerun()
        with c2:
            if st.button("Open in Canva →", type="primary", key="cs_canva", use_container_width=True):
                st.markdown('<script>window.open("https://www.canva.com/create/","_blank")</script>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: TEAM
# ─────────────────────────────────────────────────────────────────────────────
def page_team():
    username = st.session_state.get("auth_user","User")
    st.markdown('<div class="page-hdr"><div><div class="page-title">Team</div>'
                '<div class="page-sub">Sourcesys Technologies — manage your workspace members.</div>'
                '</div></div>', unsafe_allow_html=True)
    st.markdown(f'<div class="member-card"><div class="member-avatar">{username[:2].upper()}</div>'
                f'<div><div class="member-name">{username}</div><div class="member-email">Member account</div></div>'
                f'<span class="role-badge">You · Member</span></div>', unsafe_allow_html=True)
    st.markdown('<div class="coming-soon-card">'
                '<div style="font-family:\'Syne\',sans-serif;font-size:17px;font-weight:700;color:#0D0F1A;margin-bottom:10px">Team Collaboration — Coming Soon</div>'
                '<div style="font-size:13.5px;color:#5A607A;line-height:1.7;margin-bottom:16px;max-width:520px">Grow your workspace into a full team environment.</div>'
                '<span style="display:inline-flex;align-items:center;background:#FFF7ED;color:#EA580C;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;border:1px solid #FED7AA">In Development</span>'
                '</div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# MAIN — AUTH GATE + ROUTER
# ─────────────────────────────────────────────────────────────────────────────
if not st.session_state.get("auth_user"):
    page_auth()
    st.stop()

# Ensure all required session keys exist (in case of partial reload)
for _k, _v in _blank_user_data().items():
    if _k not in st.session_state:
        st.session_state[_k] = _v

for _k, _v in [("page","campaigns"),("active_panel",None),("workspace_id",None),
                ("gen_result",None),("audience_result",None),("ideation_result",None),
                ("custom_result",None),("creator_result",None),("quick_result",None),
                ("quick_input",""),("compliance_text",""),("compliance_platform","Instagram"),
                ("compliance_result",None),("compliance_checked",False),
                ("ws_panel",None),("ws_gen_result",None),("ws_aud_result",None),
                ("ws_ide_result",None),("ws_cus_result",None),("ws_expanded",{}),
                ("planner_show_form",False),("shared_tab","incoming"),("sw_perm","view"),
                ("br_selected_tone","Inspirational"),("cf_active_sec","pillars")]:
    if _k not in st.session_state:
        st.session_state[_k] = _v

render_sidebar()

if st.session_state.workspace_id is not None:
    page_workspace()
else:
    page = st.session_state.page
    if   page == "campaigns":  page_campaigns()
    elif page == "brief":      page_brief()
    elif page == "active":     page_active()
    elif page == "fav":        page_fav()
    elif page == "archived":   page_archived()
    elif page == "shared":     page_shared()
    elif page == "brands":     page_brands()
    elif page == "planner":    page_planner()
    elif page == "creator":    page_creator()
    elif page == "compliance": page_compliance()
    elif page == "team":       page_team()
    else:                      page_campaigns()

    if page != "campaigns":
        st.markdown(
            '<div class="footer"><strong>Socialyze</strong> — Sourcesys Technologies<br>'
            'Team: Subasri B &nbsp;·&nbsp; Gautham Krishnan K &nbsp;·&nbsp; Ashwin D &nbsp;·&nbsp; Vinjarapu Ajay Kumar</div>',
            unsafe_allow_html=True)