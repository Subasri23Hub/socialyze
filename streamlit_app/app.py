"""
Socialyze — Streamlit App
=========================
UI mirrors the Vite / React frontend exactly.

Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
Company: Sourcesys Technologies
"""

import os, json, re
import streamlit as st
from groq import Groq

# ─────────────────────────────────────────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Socialyze",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL CSS
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;}
:root{--bg:#F5F6FA;--surface:#FFFFFF;--surface2:#F0F2F8;--border:rgba(0,0,0,0.08);--border2:rgba(0,0,0,0.13);--text1:#0D0F1A;--text2:#5A607A;--text3:#9BA3BB;--accent:#3B6BF5;--accent-light:#EBF0FF;}
[data-testid="stAppViewContainer"]{background:#F5F6FA !important;}
[data-testid="stHeader"]{background:transparent !important;box-shadow:none !important;}
[data-testid="block-container"]{padding-top:0 !important;padding-bottom:48px !important;}
section.main>div{padding-top:16px !important;}

[data-testid="stSidebar"]{background:#FFFFFF !important;border-right:1px solid rgba(0,0,0,0.08) !important;min-width:220px !important;max-width:240px !important;}
[data-testid="stSidebar"]>div:first-child{padding:0 !important;}
[data-testid="stSidebar"] section{padding:0 !important;}
[data-testid="stSidebar"] .block-container{padding:0 !important;}

.sb-brand{display:flex;align-items:center;gap:10px;padding:20px 14px 18px 14px;border-bottom:1px solid rgba(0,0,0,0.07);user-select:none;}
.sb-brand-icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#3B6BF5,#0EA5B0);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sb-brand-name{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#0D0F1A;letter-spacing:-0.02em;}
.sb-section{display:block;font-size:9.5px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:#9BA3BB;margin:16px 0 4px 0;padding:0 22px;}

[data-testid="stSidebar"] .stButton>button{display:flex !important;align-items:center !important;gap:9px !important;padding:8px 10px 8px 12px !important;border-radius:8px !important;font-size:13px !important;font-weight:500 !important;color:#5A607A !important;background:transparent !important;border:none !important;box-shadow:none !important;width:100% !important;text-align:left !important;margin-bottom:1px !important;cursor:pointer !important;transition:background 0.13s,color 0.13s !important;justify-content:flex-start !important;line-height:1 !important;}
[data-testid="stSidebar"] .stButton>button:hover{background:#F0F2F8 !important;color:#0D0F1A !important;}
[data-testid="stSidebar"] .stButton>button[kind="primary"]{background:#EBF0FF !important;color:#3B6BF5 !important;font-weight:600 !important;border:none !important;box-shadow:none !important;padding:8px 10px 8px 12px !important;}

.sb-divider{height:1px;background:rgba(0,0,0,0.07);margin:14px 8px;}
.sb-user{display:flex;align-items:center;gap:9px;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);margin:0 8px 12px 8px;}
.sb-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3B6BF5,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;}
.sb-user-name{font-size:12px;font-weight:600;color:#0D0F1A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-user-role{font-size:10.5px;color:#9BA3BB;margin-top:1px;}

.topbar-title{font-family:'Syne',sans-serif;font-size:21px;font-weight:700;color:#0D0F1A;letter-spacing:-0.03em;}
.topbar-sub{font-size:13px;color:#5A607A;margin-top:3px;margin-bottom:18px;}

.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:26px;}
.stat-card{background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:16px 18px;}
.stat-label{font-size:11px;color:#9BA3BB;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;}
.stat-value{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0D0F1A;letter-spacing:-0.03em;}
.stat-change{display:inline-flex;align-items:center;font-size:11px;font-weight:600;margin-top:5px;padding:2px 7px;border-radius:5px;}
.stat-up{background:#DCFCE7;color:#15803D;}.stat-down{background:#FEF2F2;color:#B91C1C;}

.sec-title{font-size:13.5px;font-weight:600;color:#0D0F1A;letter-spacing:-0.01em;margin-bottom:4px;}
.sec-sub{font-size:12px;color:#9BA3BB;margin-bottom:14px;}

.fw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;}
.fw-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px 16px;transition:all 0.18s;}
.fw-card:hover{border-color:#93C5FD;transform:translateY(-2px);box-shadow:0 6px 20px rgba(59,107,245,0.10);}
.fw-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:18px;}
.fw-name{font-size:13.5px;font-weight:600;color:#0D0F1A;margin-bottom:5px;}
.fw-desc{font-size:11.5px;color:#9BA3BB;line-height:1.5;}

.import-banner{background:#F0F9FF;border:1.5px solid #BAE6FD;border-radius:12px;padding:14px 18px;margin-bottom:20px;}
.import-banner-title{font-size:13px;font-weight:600;color:#0369A1;}
.import-banner-sub{font-size:12px;color:#5A607A;}
.save-camp-banner{background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:12px;padding:14px 18px;margin-top:20px;}
.save-camp-title{font-size:13px;font-weight:600;color:#15803D;}

.page-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid rgba(0,0,0,0.06);}
.page-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0D0F1A;margin-bottom:3px;letter-spacing:-0.02em;}
.page-sub{font-size:13px;color:#5A607A;}

.camp-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(13,15,26,0.05);transition:box-shadow 0.15s,transform 0.12s;}
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

/* ── Workspace ── */
.ws-header{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:22px 26px;margin-bottom:24px;box-shadow:0 2px 8px rgba(13,15,26,0.05);}
.ws-camp-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0D0F1A;letter-spacing:-0.03em;margin-bottom:10px;}
.ws-meta-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.ws-status{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 12px;border-radius:20px;}
.ws-plat-pill{font-size:11.5px;font-weight:500;padding:4px 10px;border-radius:8px;background:#F1F5F9;color:#475569;}
.ws-meta-item{font-size:12px;color:#9BA3BB;display:flex;align-items:center;gap:4px;}
.ws-panel-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;font-size:13px;font-weight:600;border:1.5px solid;cursor:pointer;transition:opacity 0.15s;margin-right:8px;margin-bottom:8px;}
.ws-output-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;margin-bottom:14px;box-shadow:0 1px 4px rgba(13,15,26,0.04);overflow:hidden;}
.ws-output-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;}
.ws-output-type{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:8px;}
.ws-output-body{padding:16px 18px;border-top:1px solid rgba(0,0,0,0.06);}
.ws-timeline-label{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#9BA3BB;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
.ws-output-count{background:#F0F2F8;color:#5A607A;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;}

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

.stButton>button[kind="primary"]{background:#3B6BF5 !important;color:#FFFFFF !important;font-weight:600 !important;font-size:13px !important;border-radius:9px !important;padding:9px 18px !important;border:none !important;box-shadow:none !important;}
.stButton>button[kind="secondary"]{border-radius:9px !important;font-size:13px !important;font-weight:500 !important;padding:8px 16px !important;border:1.5px solid rgba(0,0,0,0.12) !important;background:#FFFFFF !important;color:#5A607A !important;box-shadow:none !important;}

.stTabs [data-baseweb="tab-list"]{background:#F0F2F8 !important;border-radius:10px !important;padding:4px !important;gap:2px !important;}
.stTabs [data-baseweb="tab"]{border-radius:7px !important;font-size:13px !important;font-weight:500 !important;padding:7px 16px !important;color:#5A607A !important;}
.stTabs [aria-selected="true"]{background:#FFFFFF !important;color:#3B6BF5 !important;font-weight:600 !important;box-shadow:0 1px 4px rgba(13,15,26,0.10) !important;}

.stTextInput>label,.stSelectbox>label,.stTextArea>label,.stSlider>label,.stMultiSelect>label{font-size:11.5px !important;font-weight:600 !important;color:#5A607A !important;letter-spacing:0.05em !important;text-transform:uppercase !important;}
.stTextInput>div>div>input,.stTextArea textarea{border-radius:10px !important;border:1.5px solid rgba(0,0,0,0.12) !important;background:#FAFAFA !important;font-size:13.5px !important;color:#0D0F1A !important;padding:10px 14px !important;}
.stTextInput>div>div>input:focus,.stTextArea textarea:focus{border-color:#3B6BF5 !important;box-shadow:0 0 0 3px rgba(59,107,245,0.12) !important;background:#FFFFFF !important;outline:none !important;}

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
.info-banner{background:#EBF0FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#1E3A5F;line-height:1.6;}
.form-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:28px 30px;box-shadow:0 1px 4px rgba(13,15,26,0.05);margin-bottom:24px;}
.card-title{font-size:15px;font-weight:700;color:#0D0F1A;margin-bottom:18px;}
.saved-badge{display:inline-flex;align-items:center;gap:5px;background:#DCFCE7;color:#15803D;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:1px solid #BBF7D0;}
.page-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(59,107,245,0.1);color:#3B6BF5;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(59,107,245,0.18);margin-bottom:8px;}
.brand-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(13,15,26,0.05);transition:box-shadow 0.15s,transform 0.12s;margin-bottom:16px;}
.brand-card:hover{box-shadow:0 4px 16px rgba(13,15,26,0.09);transform:translateY(-1px);}
.brand-top{height:72px;display:flex;align-items:center;justify-content:center;}
.brand-inits{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;}
.brand-body{padding:14px 16px;}
.brand-name{font-size:14px;font-weight:700;color:#0D0F1A;margin-bottom:3px;}
.brand-industry{font-size:12px;color:#5A607A;margin-bottom:8px;}
.brand-plat-row{display:flex;flex-wrap:wrap;gap:4px;}
.brand-plat-pill{font-size:10.5px;font-weight:500;padding:2px 8px;border-radius:6px;background:#F1F5F9;color:#475569;}
.creator-result-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:22px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.creator-content{font-size:13.5px;color:#334155;line-height:1.75;white-space:pre-wrap;}
.member-card{display:flex;align-items:center;gap:14px;background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px 22px;margin-bottom:20px;box-shadow:0 1px 3px rgba(13,15,26,0.04);}
.member-avatar{width:44px;height:44px;border-radius:50%;background:#EBF0FF;color:#3B6BF5;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.member-name{font-size:14.5px;font-weight:700;color:#0D0F1A;}
.member-email{font-size:12.5px;color:#5A607A;margin-top:2px;}
.role-badge{margin-left:auto;background:#F1F5F9;color:#475569;font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.08);}
.coming-soon-card{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:16px;padding:32px 30px;box-shadow:0 2px 8px rgba(13,15,26,0.05);margin-top:20px;}
.empty-state{text-align:center;padding:48px 20px;}
.empty-icon{font-size:36px;margin-bottom:12px;}
.empty-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0D0F1A;margin-bottom:6px;}
.empty-sub{font-size:13px;color:#9BA3BB;}
.footer{text-align:center;color:#C4C9D9;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.06);line-height:1.7;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:10px;}
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# GROQ
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or st.secrets.get("GROQ_API_KEY", "")
MODEL = "llama-3.3-70b-versatile"

# ─────────────────────────────────────────────────────────────────────────────
# SESSION STATE
# ─────────────────────────────────────────────────────────────────────────────
def _init(key, val):
    if key not in st.session_state:
        st.session_state[key] = val

_init("page",               "campaigns")
_init("active_panel",       None)
_init("workspace_id",       None)   # index into saved_campaigns being viewed
_init("brief",              {})
_init("brands",             [])
_init("content_tasks",      [])
_init("fav_ids",            [])
_init("archived_ids",       [])
_init("saved_campaigns",    [])
_init("my_shares",          [])
_init("shared_tab",         "incoming")
_init("gen_result",         None)
_init("audience_result",    None)
_init("ideation_result",    None)
_init("custom_result",      None)
_init("creator_result",     None)
_init("compliance_text",    "")
_init("compliance_platform","Instagram")
_init("compliance_result",  None)
_init("compliance_checked", False)
_init("ws_panel",           None)   # active panel inside workspace
_init("ws_outputs",         {})     # dict: campaign_id -> list of saved outputs
_init("ws_gen_result",      None)
_init("ws_aud_result",      None)
_init("ws_ide_result",      None)
_init("ws_cus_result",      None)

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
PLATFORMS  = ["Instagram","Twitter","LinkedIn","Facebook","TikTok","YouTube"]
TONES      = ["Casual","Professional","Inspirational","Humorous","Urgent","Bold","Empathetic","Witty"]
AUDIENCES  = ["Gen Z","Millennials","Professionals","Students","Parents","Entrepreneurs","Executives","Creators"]
CAMP_TYPES = ["Product Launch","Brand Awareness","Lead Generation","Engagement Boost",
              "Content Promotion","Seasonal Sale","Event Promotion","Rebranding"]
INDUSTRIES = ["E-Commerce","Fashion & Apparel","Food & Beverage","Health & Wellness",
              "Technology","Finance & Fintech","Real Estate","Education",
              "Travel & Hospitality","Entertainment & Media","Beauty & Personal Care",
              "Automotive","Non-Profit","Professional Services","Sports & Fitness","Other"]
BRAND_COLORS = ["#3B6BF5","#16A34A","#EA580C","#9333EA","#BE123C","#0369A1","#D97706","#0F766E"]
THUMB_GRADS  = [
    "linear-gradient(135deg,#38BDF8 0%,#3B6BF5 60%,#6366F1 100%)",
    "linear-gradient(135deg,#34D399 0%,#0EA5B0 60%,#0EA5E9 100%)",
    "linear-gradient(135deg,#F472B6 0%,#C084FC 60%,#818CF8 100%)",
    "linear-gradient(135deg,#FB923C 0%,#F59E0B 60%,#EAB308 100%)",
]
PLATFORM_STYLE = {
    "Instagram":{"bg":"#FDF2F8","color":"#9D174D"},
    "Twitter":  {"bg":"#EFF6FF","color":"#1D4ED8"},
    "LinkedIn": {"bg":"#EFF9FF","color":"#0369A1"},
    "Facebook": {"bg":"#EFF6FF","color":"#1E40AF"},
    "TikTok":   {"bg":"#FEF2F2","color":"#991B1B"},
    "YouTube":  {"bg":"#FEF2F2","color":"#991B1B"},
}
PLATFORM_RULES = {
    "Instagram":[
        ("caption_length","Caption length",lambda t:len(t)<=2200,"Caption exceeds 2,200 chars."),
        ("hashtag_count","Hashtag count",lambda t:len([w for w in t.split() if w.startswith("#")])<=30,"More than 30 hashtags — Instagram may block the post."),
        ("no_external_link","No clickable links",lambda t:"http" not in t,"External links aren't clickable. Use 'link in bio'."),
        ("has_cta","Has a call-to-action",lambda t:any(w in t.lower() for w in ["link in bio","swipe","tap","shop","save","follow","comment","share","dm","click"]),"No clear CTA found."),
        ("no_banned_tags","No banned hashtags",lambda t:not any(w in t.lower() for w in ["like4like","followforfollow","l4l","f4f"]),"Banned hashtags detected — may cause shadowban."),
    ],
    "Twitter":[
        ("tweet_length","Tweet length",lambda t:len(t)<=280,"Tweet exceeds 280 characters."),
        ("hashtag_max","Hashtag count ≤ 2",lambda t:len([w for w in t.split() if w.startswith("#")])<=2,"More than 2 hashtags reduces engagement by ~17%."),
        ("has_hook","Strong opening hook",lambda t:not t.lower().startswith(("hey ","hi ","hello")),"Weak opener — lead with your sharpest point."),
    ],
    "LinkedIn":[
        ("post_length","Post length ≤ 3,000",lambda t:len(t)<=3000,"LinkedIn truncates at 3,000 chars."),
        ("hashtag_count","Hashtag count ≤ 5",lambda t:len([w for w in t.split() if w.startswith("#")])<=5,"More than 5 hashtags is spammy."),
        ("professional_tone","Professional tone",lambda t:not any(w in t.lower() for w in ["wtf","omg","lol"]),"Casual slang detected."),
        ("has_cta","Has a call-to-action",lambda t:any(w in t.lower() for w in ["connect","comment","thoughts","share","follow","dm","learn more"]),"No engagement invitation found."),
    ],
    "Facebook":[
        ("post_length","Post length",lambda t:len(t)<=63206,"Exceeds Facebook's absolute limit."),
        ("optimal_len","Optimal length",lambda t:len(t)<=500,"Posts over 500 chars see lower organic reach."),
        ("has_cta","Has a call-to-action",lambda t:any(w in t.lower() for w in ["share","like","comment","click","visit","learn","shop"]),"No CTA found."),
    ],
    "TikTok":[
        ("caption_length","Caption length",lambda t:len(t)<=2200,"Caption too long."),
        ("hashtag_range","3–8 hashtags",lambda t:3<=len([w for w in t.split() if w.startswith("#")])<=8,"Use 3–8 hashtags for best TikTok reach."),
        ("has_hook","Strong opening",lambda t:len(t.strip())>10,"Caption too short — TikTok needs a hook."),
    ],
    "YouTube":[
        ("title_length","Title ≤ 100 chars",lambda t:len(t)<=100,"Title too long."),
        ("has_keywords","Contains keywords",lambda t:len(t.split())>=5,"Description too short."),
        ("has_cta","Has a call-to-action",lambda t:any(w in t.lower() for w in ["subscribe","like","comment","watch","click","check out","learn more"]),"No CTA detected."),
    ],
}
STATUS_COLORS = {
    "Draft":    {"bg":"#F1F5F9","color":"#475569"},
    "Active":   {"bg":"#DCFCE7","color":"#15803D"},
    "In Review":{"bg":"#FEF9C3","color":"#A16207"},
    "Paused":   {"bg":"#FEF2F2","color":"#B91C1C"},
    "Completed":{"bg":"#EFF9FF","color":"#0369A1"},
}
KANBAN_COLS = [
    {"id":"Planned",    "label":"Planned",    "color":"#3B6BF5","bg":"#EBF0FF"},
    {"id":"In Progress","label":"In Progress","color":"#D97706","bg":"#FEF3C7"},
    {"id":"Completed",  "label":"Completed",  "color":"#16A34A","bg":"#DCFCE7"},
]
WS_PANELS = [
    {"id":"ai",       "label":"⚡ AI Post Generator",  "color":"#3B6BF5","bg":"#EBF0FF"},
    {"id":"audience", "label":"👥 Audience Targeting", "color":"#16A34A","bg":"#F0FDF4"},
    {"id":"ideation", "label":"💡 Campaign Ideation",  "color":"#EA580C","bg":"#FFF7ED"},
    {"id":"custom",   "label":"⚙ Custom Flow",         "color":"#9333EA","bg":"#FDF4FF"},
]

SVG_BOLT = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'

def _svg(path_d, size=15):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{path_d}</svg>'

ICON_BOOK      = _svg('<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>')
ICON_GRID      = _svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>')
ICON_ACTIVITY  = _svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>')
ICON_SHARE     = _svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>')
ICON_HEART     = _svg('<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>')
ICON_ARCHIVE   = _svg('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>')
ICON_BRIEFCASE = _svg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><path d="M2 12h20"/>')
ICON_PLANNER   = _svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>')
ICON_CREATOR   = _svg('<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>')
ICON_SHIELD    = _svg('<path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"/><polyline points="9 12 11 14 15 10"/>')

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def hash_grad(s):
    h = 0
    for c in (s or "x"): h = (h*31+ord(c))&0xFFFF
    return THUMB_GRADS[h % len(THUMB_GRADS)]

def cap_first(s):
    return s[:1].upper()+s[1:] if s else s

def brand_inits(name):
    words = name.strip().split()
    if len(words)>=2: return (words[0][0]+words[1][0]).upper()
    return name[:2].upper() if len(name)>=2 else name.upper()

def avatar_color(email):
    palette=[("#EBF0FF","#3B6BF5"),("#F0FDF4","#16A34A"),("#FFF7ED","#EA580C"),("#FDF4FF","#9333EA"),("#FFF1F2","#BE123C")]
    h=0
    for c in email: h=(h*31+ord(c))&0xFFFF
    return palette[h%len(palette)]

def call_groq(prompt, max_tokens=2500):
    if not GROQ_API_KEY:
        st.error("Groq API key not found. Add GROQ_API_KEY to your .env or Streamlit secrets.")
        return None
    try:
        client=Groq(api_key=GROQ_API_KEY)
        response=client.chat.completions.create(
            model=MODEL,
            messages=[{"role":"user","content":prompt}],
            temperature=0.9,max_tokens=max_tokens,
        )
        text=response.choices[0].message.content.strip()
        text=text.replace("```json","").replace("```","").strip()
        s=text.find("{"); e=text.rfind("}")+1
        if s!=-1 and e>s: text=text[s:e]
        return json.loads(text)
    except json.JSONDecodeError:
        st.error("Response parsing failed — please try again.")
        return None
    except Exception as exc:
        st.error(f"Generation failed: {exc}")
        return None

def _nav_page(page_id):
    st.session_state.page=page_id
    st.session_state.active_panel=None
    st.session_state.workspace_id=None
    st.rerun()

def open_workspace(campaign_id):
    """Navigate into the Campaign Workspace for the given campaign id."""
    st.session_state.workspace_id = campaign_id
    st.session_state.ws_panel     = None
    st.session_state.ws_gen_result= None
    st.session_state.ws_aud_result= None
    st.session_state.ws_ide_result= None
    st.session_state.ws_cus_result= None
    st.rerun()

def close_workspace():
    st.session_state.workspace_id = None
    st.session_state.ws_panel     = None
    st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# IMPORT / SAVE HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def render_import_strip(panel_key):
    brief  = st.session_state.brief
    brands = st.session_state.brands
    has_brief  = bool(brief.get("brand_name"))
    has_brands = bool(brands)

    st.markdown('<div class="import-banner">', unsafe_allow_html=True)
    st.markdown(
        '<div><div class="import-banner-title">📥 Import Data</div>'
        '<div class="import-banner-sub">Pre-fill from your saved Campaign Brief or Brand & Client Hub.</div></div>',
        unsafe_allow_html=True,
    )
    col_a, col_b = st.columns([1,1])
    with col_a:
        if st.button("📋 From Campaign Brief" if has_brief else "📋 Brief (empty)",
                     key=f"import_brief_{panel_key}", use_container_width=True,
                     type="primary" if has_brief else "secondary", disabled=not has_brief):
            st.session_state[f"{panel_key}_imported"]="brief"; st.rerun()
    with col_b:
        brand_names=["— select brand —"]+[b["name"] for b in brands]
        bsel=st.selectbox("Brand",options=brand_names,key=f"import_brand_sel_{panel_key}",label_visibility="collapsed") if has_brands else None
        if st.button("🏢 From Brand Hub",key=f"import_brand_{panel_key}",use_container_width=True,
                     type="secondary",disabled=not has_brands):
            if bsel and bsel!="— select brand —":
                st.session_state[f"{panel_key}_imported_brand"]=bsel
                st.session_state[f"{panel_key}_imported"]="brand"; st.rerun()
    st.markdown("</div>",unsafe_allow_html=True)

def get_panel_prefill(panel_key):
    brief=st.session_state.brief; brands=st.session_state.brands
    source=st.session_state.get(f"{panel_key}_imported")
    if source=="brief":
        return {"brand":brief.get("brand_name",""),"product":brief.get("product_service",""),
                "goal":brief.get("campaign_goal",""),"audience":brief.get("target_audience",""),
                "tone":brief.get("tone","Inspirational"),"platforms":brief.get("platforms",[])}
    elif source=="brand":
        bname=st.session_state.get(f"{panel_key}_imported_brand","")
        b=next((x for x in brands if x["name"]==bname),None)
        if b:
            tone_map={"Professional":"Professional","Casual & Friendly":"Casual","Inspirational":"Inspirational",
                      "Witty & Humorous":"Humorous","Bold & Edgy":"Bold","Empathetic":"Empathetic"}
            return {"brand":b.get("name",""),"product":b.get("notes","")[:60] if b.get("notes") else "",
                    "goal":"Build brand awareness","audience":"Millennials",
                    "tone":tone_map.get(b.get("tone",""),"Inspirational"),
                    "platforms":[p.replace(" / X","").replace(" /X","") for p in b.get("platforms",[])]}
    return {}

def render_save_to_campaign(panel_key, brand, platforms, tone, output_count=1):
    st.markdown('<div class="save-camp-banner">',unsafe_allow_html=True)
    col_a,col_b=st.columns([3,1])
    with col_a:
        st.markdown(
            '<div class="save-camp-title">💾 Save to Campaign</div>'
            '<div style="font-size:12px;color:#5A607A">Save this output to your Campaigns library.</div>',
            unsafe_allow_html=True)
    with col_b:
        if st.button("Save ✓",key=f"save_camp_{panel_key}",type="primary",use_container_width=True):
            cid=len(st.session_state.saved_campaigns)
            st.session_state.saved_campaigns.insert(0,{
                "id":cid,"campaign_name":(brand or "Campaign").lower(),
                "tone":tone,"platforms":platforms,"status":"Active",
                "output_count":output_count,"ago":"Just now",
            })
            st.success(f"✓ Saved '{cap_first(brand or 'Campaign')}' to your campaigns!")
    st.markdown("</div>",unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────────────────────
def nav_btn(label, icon_svg, page_id, current):
    is_active = (current==page_id and st.session_state.workspace_id is None)
    clicked=st.button(label,key=f"nav_{page_id}",use_container_width=True,
                      type="primary" if is_active else "secondary")
    if clicked: _nav_page(page_id)

with st.sidebar:
    cur=st.session_state.page
    st.markdown(f'<div class="sb-brand"><div class="sb-brand-icon">{SVG_BOLT}</div><span class="sb-brand-name">Socialyze</span></div>',unsafe_allow_html=True)

    st.markdown('<span class="sb-section">Workspace</span>',unsafe_allow_html=True)
    nav_btn("📋  Campaign Brief",   ICON_BOOK,     "brief",    cur)
    nav_btn("⊞  All Campaigns",     ICON_GRID,     "campaigns",cur)
    nav_btn("⚡  Active Campaigns", ICON_ACTIVITY, "active",   cur)
    nav_btn("↗  Shared Workspaces",ICON_SHARE,    "shared",   cur)

    st.markdown('<span class="sb-section">Library</span>',unsafe_allow_html=True)
    nav_btn("♥  Favourites",ICON_HEART,  "fav",     cur)
    nav_btn("▣  Archived",  ICON_ARCHIVE,"archived",cur)

    st.markdown('<span class="sb-section">Clients</span>',unsafe_allow_html=True)
    nav_btn("💼  Brand & Client Hub",ICON_BRIEFCASE,"brands",cur)

    st.markdown('<span class="sb-section">Tools</span>',unsafe_allow_html=True)
    nav_btn("▦  Content Planner", ICON_PLANNER,"planner",   cur)
    nav_btn("✦  Creator Studio",  ICON_CREATOR,"creator",   cur)
    nav_btn("🛡  Compliance Guard",ICON_SHIELD, "compliance",cur)

    st.markdown('<div class="sb-divider"></div>',unsafe_allow_html=True)
    if st.button("↩  Sign Out",key="nav_signout",use_container_width=True):
        st.info("Sign out not active in demo mode.")

    st.markdown("""
    <div class="sb-user">
        <div class="sb-avatar">SC</div>
        <div style="flex:1;min-width:0">
            <div class="sb-user-name">Socialyze User</div>
            <div class="sb-user-role">Member</div>
        </div>
    </div>""",unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# CAMPAIGN CARD  (pure HTML — no open button inside HTML; button below)
# ─────────────────────────────────────────────────────────────────────────────
def campaign_card_html(c):
    name  =cap_first(c.get("campaign_name","Campaign"))
    status=c.get("status","Draft")
    plats =c.get("platforms",[])
    grad  =hash_grad(c.get("campaign_name",""))
    sc    =STATUS_COLORS.get(status,STATUS_COLORS["Draft"])
    oc    =c.get("output_count",0)

    plat_pills=""
    for p in plats[:4]:
        ps=PLATFORM_STYLE.get(p,{"bg":"#F1F5F9","color":"#475569"})
        plat_pills+=f'<span class="camp-plat-pill" style="background:{ps["bg"]};color:{ps["color"]}">{p}</span>'
    if len(plats)>4:
        plat_pills+=f'<span class="camp-plat-pill" style="background:#F1F5F9;color:#475569">+{len(plats)-4}</span>'

    return f"""
    <div class="camp-card">
        <div class="camp-thumb" style="background:{grad}">
            <span class="camp-status" style="background:{sc['bg']};color:{sc['color']}">{status}</span>
            <span class="camp-initial">{name[0]}</span>
        </div>
        <div class="camp-body">
            <div class="camp-name">{name}</div>
            <div class="camp-plat-row">{plat_pills}</div>
            <div class="camp-foot">
                <span class="camp-meta">🕐 {c.get('ago','')}</span>
                <span class="camp-meta">⊕ {oc} output{'s' if oc!=1 else ''}</span>
            </div>
        </div>
    </div>"""

def render_campaign_grid(campaigns, source="dash"):
    """Render campaign cards with working Open Workspace buttons."""
    if not campaigns: return
    n=min(len(campaigns),3)
    cols=st.columns(n)
    for i,c in enumerate(campaigns):
        cid=c.get("id",i)
        with cols[i%n]:
            st.markdown(campaign_card_html(c),unsafe_allow_html=True)
            if st.button("Open Workspace →",key=f"open_ws_{source}_{cid}_{i}",
                         type="primary",use_container_width=True):
                open_workspace(cid)

# ─────────────────────────────────────────────────────────────────────────────
# CAMPAIGN WORKSPACE PAGE
# ─────────────────────────────────────────────────────────────────────────────
def page_workspace():
    cid=st.session_state.workspace_id
    campaigns=st.session_state.saved_campaigns

    # Find campaign by id
    campaign=next((c for c in campaigns if c.get("id")==cid),None)
    if campaign is None:
        st.error("Campaign not found.")
        if st.button("← Back to All Campaigns"):
            close_workspace()
        return

    name  =cap_first(campaign.get("campaign_name","Campaign"))
    status=campaign.get("status","Draft")
    plats =campaign.get("platforms",[])
    grad  =hash_grad(campaign.get("campaign_name",""))
    sc    =STATUS_COLORS.get(status,STATUS_COLORS["Draft"])

    # ── Back link
    if st.button("← All Campaigns",key="ws_back"):
        close_workspace()
        return

    # ── Header card
    plat_pills="".join(f'<span class="ws-plat-pill">{p}</span>' for p in plats)
    st.markdown(f"""
    <div class="ws-header">
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
        </div>
    </div>""",unsafe_allow_html=True)

    # ── Generation panels section
    st.markdown('<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9BA3BB;margin-bottom:10px">Generate for this campaign</div>',unsafe_allow_html=True)

    ws_panel=st.session_state.ws_panel

    if ws_panel is None:
        btn_cols=st.columns(4)
        for col,(pw) in zip(btn_cols,WS_PANELS):
            with col:
                if st.button(pw["label"],key=f"ws_open_{pw['id']}",use_container_width=True):
                    st.session_state.ws_panel=pw["id"]
                    st.session_state.ws_gen_result=None
                    st.session_state.ws_aud_result=None
                    st.session_state.ws_ide_result=None
                    st.session_state.ws_cus_result=None
                    st.rerun()
    else:
        if ws_panel=="ai":     _ws_panel_generate(campaign)
        elif ws_panel=="audience":  _ws_panel_audience(campaign)
        elif ws_panel=="ideation":  _ws_panel_ideation(campaign)
        elif ws_panel=="custom":    _ws_panel_custom(campaign)

    # ── Saved outputs timeline
    st.markdown("<br>",unsafe_allow_html=True)
    outputs=st.session_state.ws_outputs.get(str(cid),[])
    count=len(outputs)
    st.markdown(f'<div class="ws-timeline-label">Output History <span class="ws-output-count">{count} item{"s" if count!=1 else ""}</span></div>',unsafe_allow_html=True)

    if not outputs:
        st.markdown("""
        <div class="empty-state" style="padding:32px 0">
            <div class="empty-icon">📭</div>
            <div class="empty-title">No outputs yet</div>
            <div class="empty-sub">Use one of the 4 panels above to generate and save content for this campaign.</div>
        </div>""",unsafe_allow_html=True)
    else:
        OUTPUT_META={
            "ai":      {"label":"AI Post Generator","color":"#3B6BF5","bg":"#EBF0FF","emoji":"⚡"},
            "audience":{"label":"Audience Targeting","color":"#16A34A","bg":"#F0FDF4","emoji":"👥"},
            "ideation":{"label":"Campaign Ideation", "color":"#EA580C","bg":"#FFF7ED","emoji":"💡"},
            "custom":  {"label":"Custom Flow",        "color":"#9333EA","bg":"#FDF4FF","emoji":"⚙"},
        }
        if "ws_expanded" not in st.session_state:
            st.session_state.ws_expanded={}

        for i,out in enumerate(outputs):
            meta=OUTPUT_META.get(out.get("type","ai"),OUTPUT_META["ai"])
            eid=f"{cid}_{i}"
            is_open=st.session_state.ws_expanded.get(eid,i==0)

            hdr_cols=st.columns([6,1])
            with hdr_cols[0]:
                st.markdown(f"""
                <div class="ws-output-card" style="margin-bottom:0">
                    <div class="ws-output-hdr">
                        <span class="ws-output-type" style="background:{meta['bg']};color:{meta['color']}">{meta['emoji']} {meta['label']}</span>
                        <span style="font-size:12px;color:#9BA3BB">{out.get('saved_at','')}</span>
                    </div>
                </div>""",unsafe_allow_html=True)
            with hdr_cols[1]:
                tog_label="▲ Hide" if is_open else "▼ Show"
                if st.button(tog_label,key=f"ws_tog_{eid}",use_container_width=True):
                    st.session_state.ws_expanded[eid]=not is_open; st.rerun()

            if is_open:
                with st.expander("",expanded=True):
                    data=out.get("data",{})
                    if out.get("type")=="ai":
                        _render_ws_ai_output(data)
                    elif out.get("type")=="audience":
                        _render_ws_audience_output(data)
                    elif out.get("type")=="ideation":
                        _render_ws_ideation_output(data)
                    elif out.get("type")=="custom":
                        _render_ws_custom_output(data)
                    else:
                        st.json(data)

    st.markdown('<div class="footer"><strong>Socialyze</strong> — Sourcesys Technologies</div>',unsafe_allow_html=True)

# ── Workspace output renderers ───────────────────────────────────────────────
def _render_ws_ai_output(data):
    if data.get("campaign_tagline"):
        st.markdown(f'<div class="result-tagline">&ldquo;{data["campaign_tagline"]}&rdquo;</div>',unsafe_allow_html=True)
    if data.get("campaign_summary"):
        st.markdown(f'<div class="result-summary">{data["campaign_summary"]}</div>',unsafe_allow_html=True)
    platforms=data.get("platforms",{})
    if isinstance(platforms,list):
        pmap={}
        for p in platforms:
            if p.get("platform_name"): pmap[p["platform_name"]]={"posts":p.get("posts",[])}
        platforms=pmap
    if platforms:
        tabs=st.tabs(list(platforms.keys()))
        for tab,plat in zip(tabs,platforms.keys()):
            with tab:
                for i,post in enumerate(platforms[plat].get("posts",[]),1):
                    tags=" ".join(post.get("hashtags",[]))
                    hook_html=f"<div class='post-hook'><span class='hook-label'>HOOK</span>{post.get('hook','')}</div>" if post.get("hook") else ""
                    st.markdown(f"""
                    <div class="post-card">
                        <div class="post-num">VARIATION {i} · {post.get('content_type','Post').upper()}</div>
                        {hook_html}
                        <div class="post-caption">{post.get('caption','')}</div>
                        <div class="post-tags">{tags}</div>
                        <div class="meta-grid">
                            <div><span class="meta-key">CTA</span><span class="meta-val">{post.get('cta','')}</span></div>
                            <div><span class="meta-key">Best Time</span><span class="meta-val">{post.get('best_time','N/A')}</span></div>
                        </div>
                    </div>""",unsafe_allow_html=True)

def _render_ws_audience_output(data):
    pp=data.get("primary_persona",{})
    sp=data.get("secondary_persona",{})
    for p,lbl in [(pp,"Primary"),(sp,"Secondary")]:
        if not p: continue
        st.markdown(f"""
        <div class="result-card">
            <div class="result-name">{lbl}: {p.get('name','')}</div>
            <div class="insight-label">Interests</div><div class="insight-text">{', '.join(p.get('interests',[]))}</div>
            <div class="insight-label">Pain Points</div><div class="insight-text">{', '.join(p.get('pain_points',[]))}</div>
            <div class="insight-label">Best Platforms</div><div class="insight-text">{', '.join(p.get('best_platforms',[]))}</div>
        </div>""",unsafe_allow_html=True)
    for tip in data.get("targeting_tips",[]):
        st.markdown(f'<div class="tip">💡 {tip}</div>',unsafe_allow_html=True)

def _render_ws_ideation_output(data):
    for c in data.get("campaign_concepts",[]):
        vir=f"<div class='idea-viral'>⚡ {c.get('viral_mechanism','')}</div>" if c.get("viral_mechanism") else ""
        st.markdown(f"""
        <div class="idea-card">
            <div class="idea-title">{c.get('title','')}</div>
            <div class="idea-desc">{c.get('big_idea','')}</div>
            {vir}
            <div class="idea-impact">📈 {c.get('expected_impact','')}</div>
        </div>""",unsafe_allow_html=True)

def _render_ws_custom_output(data):
    if data.get("campaign_name"):
        st.markdown(f'<div class="result-name">{data["campaign_name"]}</div>',unsafe_allow_html=True)
    if data.get("campaign_objective"):
        st.markdown(f'<div class="result-summary">{data["campaign_objective"]}</div>',unsafe_allow_html=True)
    for phase in data.get("phases",[]):
        acts="".join(f"<li style='font-size:12.5px;color:#334155'>{a}</li>" for a in phase.get("activities",[]))
        st.markdown(f"""
        <div class="post-card">
            <div class="post-num">PHASE {phase.get('phase_number','')} — {phase.get('duration','')}</div>
            <div class="post-caption">{phase.get('name','')}</div>
            <ul style="margin:8px 0 0 16px">{acts}</ul>
        </div>""",unsafe_allow_html=True)

# ── Workspace generation panels ──────────────────────────────────────────────
def _ws_save_output(cid, panel_type, data):
    import datetime
    key=str(cid)
    if key not in st.session_state.ws_outputs:
        st.session_state.ws_outputs[key]=[]
    st.session_state.ws_outputs[key].insert(0,{
        "type":panel_type,"data":data,
        "saved_at":datetime.datetime.now().strftime("%d %b %Y, %I:%M %p"),
    })
    # update output count on campaign
    for c in st.session_state.saved_campaigns:
        if c.get("id")==cid:
            c["output_count"]=c.get("output_count",0)+1
            c["ago"]="Just now"
            break

def _ws_panel_generate(campaign):
    cid=campaign.get("id")
    pre=get_panel_prefill("ws_gp")
    brand_default=pre.get("brand",cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚡ AI Post Generator</div><div class="gen-panel-sub">Multi-platform captions & hashtags via Groq</div></div>',unsafe_allow_html=True)
    render_import_strip("ws_gp")

    if st.session_state.ws_gen_result is None:
        c1,c2=st.columns(2)
        with c1:
            brand   =st.text_input("Brand",value=brand_default,key="ws_gp_brand")
            product =st.text_input("Product/Service",value=pre.get("product",""),key="ws_gp_product")
            goal    =st.text_input("Campaign Goal",value=pre.get("goal",""),key="ws_gp_goal")
        with c2:
            camp_type=st.selectbox("Campaign Type",CAMP_TYPES,key="ws_gp_ct")
            tone_def=pre.get("tone","Inspirational")
            tone    =st.selectbox("Tone",TONES,index=TONES.index(tone_def) if tone_def in TONES else 2,key="ws_gp_tone")
            variations=st.slider("Variations per Platform",1,5,2,key="ws_gp_var")
        st.markdown("**Platforms**")
        init_plats=pre.get("platforms",campaign.get("platforms",["Instagram"]))
        sel_plats=[]
        plat_cols=st.columns(len(PLATFORMS))
        for i,p in enumerate(PLATFORMS):
            if plat_cols[i].checkbox(p,value=p in init_plats,key=f"ws_gp_p_{p}"): sel_plats.append(p)
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Close Panel",key="ws_gp_cancel"):
                st.session_state.ws_panel=None; st.rerun()
        with c2:
            if st.button("⚡ Generate",type="primary",use_container_width=True,key="ws_gp_gen"):
                if not brand or not product or not goal: st.warning("Fill Brand, Product, and Goal.")
                elif not sel_plats: st.warning("Select at least one platform.")
                else:
                    prompt=f"""Social media Creative Director. Agency-quality campaign.
Brief: {brand} | {product} | {camp_type} | Goal: {goal} | Tone: {tone} | Platforms: {', '.join(sel_plats)} | {variations} variation(s) per platform
Return ONLY valid JSON:
{{"campaign_tagline":"","campaign_summary":"","brand_voice_guide":"","audience_insight":"","platforms":[{{"platform_name":"{sel_plats[0]}","posts":[{{"hook":"","caption":"","hashtags":[],"cta":"","content_type":"","best_time":""}}]}}],"kpis":[]}}"""
                    with st.spinner("Generating…"):
                        parsed=call_groq(prompt,2000)
                    if parsed:
                        if isinstance(parsed.get("platforms"),list):
                            pmap={}
                            for p in parsed["platforms"]:
                                if p.get("platform_name"): pmap[p["platform_name"]]={"posts":p.get("posts",[])}
                            parsed["platforms"]=pmap
                        parsed["_brand"]=brand; parsed["_platforms"]=sel_plats; parsed["_tone"]=tone
                        st.session_state.ws_gen_result=parsed; st.rerun()
    else:
        r=st.session_state.ws_gen_result
        tl=f"<div class='result-tagline'>&ldquo;{r['campaign_tagline']}&rdquo;</div>" if r.get("campaign_tagline") else ""
        st.markdown(f'<div class="result-card"><div class="result-name">{r.get("_brand","Campaign")}</div>{tl}<div class="result-summary">{r.get("campaign_summary","")}</div></div>',unsafe_allow_html=True)
        _render_ws_ai_output(r)
        c1,c2,c3=st.columns(3)
        with c1:
            if st.button("← Generate Another",key="ws_gp_regen"):
                st.session_state.ws_gen_result=None; st.rerun()
        with c2:
            if st.button("💾 Save to This Campaign",type="primary",use_container_width=True,key="ws_gp_save"):
                _ws_save_output(cid,"ai",r)
                st.session_state.ws_gen_result=None
                st.session_state.ws_panel=None
                st.success("✓ Output saved to campaign workspace!"); st.rerun()
        with c3:
            if st.button("✕ Close",key="ws_gp_close"):
                st.session_state.ws_panel=None; st.rerun()

def _ws_panel_audience(campaign):
    cid=campaign.get("id")
    pre=get_panel_prefill("ws_at")
    brand_default=pre.get("brand",cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">👥 Audience Targeting</div><div class="gen-panel-sub">Persona-matched messaging strategy</div></div>',unsafe_allow_html=True)
    render_import_strip("ws_at")

    if st.session_state.ws_aud_result is None:
        c1,c2=st.columns(2)
        with c1:
            brand  =st.text_input("Brand",value=brand_default,key="ws_at_brand")
            product=st.text_input("Product",value=pre.get("product",""),key="ws_at_product")
        with c2:
            goal =st.text_input("Goal",value=pre.get("goal",""),key="ws_at_goal")
            plats=st.multiselect("Platforms",PLATFORMS,default=[p for p in pre.get("platforms",campaign.get("platforms",["Instagram"])) if p in PLATFORMS],key="ws_at_plats")
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Close",key="ws_at_cancel"): st.session_state.ws_panel=None; st.rerun()
        with c2:
            if st.button("👥 Generate",type="primary",use_container_width=True,key="ws_at_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt=f"""Digital marketing strategist. Audience strategy:
Brand: {brand} | Product: {product} | Goal: {goal or 'Build awareness'} | Platforms: {', '.join(plats) if plats else 'Instagram'}
Return ONLY valid JSON:
{{"primary_persona":{{"name":"","age_range":"","interests":[],"pain_points":[],"motivations":[],"best_platforms":[]}},"secondary_persona":{{"name":"","age_range":"","interests":[],"pain_points":[],"motivations":[],"best_platforms":[]}},"messaging_pillars":[{{"pillar":"","message":"","content_angle":""}}],"targeting_tips":[]}}"""
                    with st.spinner("Generating…"):
                        result=call_groq(prompt,1500)
                    if result:
                        result["_brand"]=brand; result["_platforms"]=plats
                        st.session_state.ws_aud_result=result; st.rerun()
    else:
        r=st.session_state.ws_aud_result
        _render_ws_audience_output(r)
        c1,c2,c3=st.columns(3)
        with c1:
            if st.button("← Again",key="ws_at_regen"): st.session_state.ws_aud_result=None; st.rerun()
        with c2:
            if st.button("💾 Save to Campaign",type="primary",use_container_width=True,key="ws_at_save"):
                _ws_save_output(cid,"audience",r)
                st.session_state.ws_aud_result=None; st.session_state.ws_panel=None
                st.success("✓ Saved!"); st.rerun()
        with c3:
            if st.button("✕ Close",key="ws_at_close"): st.session_state.ws_panel=None; st.rerun()

def _ws_panel_ideation(campaign):
    cid=campaign.get("id")
    pre=get_panel_prefill("ws_ci")
    brand_default=pre.get("brand",cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">💡 Campaign Ideation</div><div class="gen-panel-sub">Creative concepts & calendar ideas</div></div>',unsafe_allow_html=True)
    render_import_strip("ws_ci")

    if st.session_state.ws_ide_result is None:
        c1,c2=st.columns(2)
        with c1:
            brand  =st.text_input("Brand",value=brand_default,key="ws_ci_brand")
            product=st.text_input("Product",value=pre.get("product",""),key="ws_ci_product")
        with c2:
            goal=st.text_input("Goal",value=pre.get("goal",""),key="ws_ci_goal")
            tone_def=pre.get("tone","Inspirational")
            tone=st.selectbox("Tone",TONES,index=TONES.index(tone_def) if tone_def in TONES else 2,key="ws_ci_tone")
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Close",key="ws_ci_cancel"): st.session_state.ws_panel=None; st.rerun()
        with c2:
            if st.button("💡 Generate",type="primary",use_container_width=True,key="ws_ci_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt=f"""Creative director. 5 campaign concepts:
Brand: {brand} | Product: {product} | Goal: {goal or 'Build awareness'} | Tone: {tone}
Return ONLY valid JSON:
{{"campaign_concepts":[{{"title":"","big_idea":"","viral_mechanism":"","content_formats":[],"expected_impact":""}}],"hashtag_strategy":{{"branded":[],"trending":[],"niche":[]}},"collab_ideas":[]}}"""
                    with st.spinner("Generating…"):
                        result=call_groq(prompt,1800)
                    if result:
                        result["_brand"]=brand; result["_tone"]=tone
                        st.session_state.ws_ide_result=result; st.rerun()
    else:
        r=st.session_state.ws_ide_result
        _render_ws_ideation_output(r)
        c1,c2,c3=st.columns(3)
        with c1:
            if st.button("← Again",key="ws_ci_regen"): st.session_state.ws_ide_result=None; st.rerun()
        with c2:
            if st.button("💾 Save to Campaign",type="primary",use_container_width=True,key="ws_ci_save"):
                _ws_save_output(cid,"ideation",r)
                st.session_state.ws_ide_result=None; st.session_state.ws_panel=None
                st.success("✓ Saved!"); st.rerun()
        with c3:
            if st.button("✕ Close",key="ws_ci_close"): st.session_state.ws_panel=None; st.rerun()

def _ws_panel_custom(campaign):
    cid=campaign.get("id")
    pre=get_panel_prefill("ws_cf")
    brand_default=pre.get("brand",cap_first(campaign.get("campaign_name","")))
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚙ Custom Flow</div><div class="gen-panel-sub">AI-generated bespoke campaign skeleton</div></div>',unsafe_allow_html=True)
    render_import_strip("ws_cf")

    if st.session_state.ws_cus_result is None:
        brand  =st.text_input("Brand",value=brand_default,key="ws_cf_brand")
        product=st.text_input("Product/Service",value=pre.get("product",""),key="ws_cf_product")
        goal   =st.text_input("Goal",value=pre.get("goal",""),key="ws_cf_goal")
        custom_inst=st.text_area("Custom Instructions",key="ws_cf_inst",height=80)
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Close",key="ws_cf_cancel"): st.session_state.ws_panel=None; st.rerun()
        with c2:
            if st.button("⚙ Build Skeleton",type="primary",use_container_width=True,key="ws_cf_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt=f"""Campaign architect. Bespoke skeleton:
Brand: {brand} | Product: {product} | Goal: {goal or 'Grow'} | Custom: {custom_inst or 'None'}
Return ONLY valid JSON:
{{"campaign_name":"","campaign_objective":"","unique_angle":"","phases":[{{"phase_number":1,"name":"","duration":"","activities":[],"deliverables":[],"success_metrics":[]}}],"messaging_framework":{{"core_message":"","tone_guide":"","words_to_use":[],"words_to_avoid":[]}},"risk_mitigation":[]}}"""
                    with st.spinner("Building…"):
                        result=call_groq(prompt,1800)
                    if result:
                        result["_brand"]=brand
                        st.session_state.ws_cus_result=result; st.rerun()
    else:
        r=st.session_state.ws_cus_result
        _render_ws_custom_output(r)
        c1,c2,c3=st.columns(3)
        with c1:
            if st.button("← Again",key="ws_cf_regen"): st.session_state.ws_cus_result=None; st.rerun()
        with c2:
            if st.button("💾 Save to Campaign",type="primary",use_container_width=True,key="ws_cf_save"):
                _ws_save_output(cid,"custom",r)
                st.session_state.ws_cus_result=None; st.session_state.ws_panel=None
                st.success("✓ Saved!"); st.rerun()
        with c3:
            if st.button("✕ Close",key="ws_cf_close"): st.session_state.ws_panel=None; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# GENERATE PANELS (Dashboard)
# ─────────────────────────────────────────────────────────────────────────────
def panel_generate():
    pkey="gp"; pre=get_panel_prefill(pkey)
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚡ AI Post Generator</div><div class="gen-panel-sub">Multi-platform captions & hashtags via Groq</div></div>',unsafe_allow_html=True)
    render_import_strip(pkey)

    if st.session_state.gen_result is None:
        c1,c2=st.columns(2)
        with c1:
            brand   =st.text_input("Brand / Company",value=pre.get("brand",""),placeholder="e.g. Nike, Zomato",key="gp_brand")
            product =st.text_input("Product / Service",value=pre.get("product",""),placeholder="e.g. Running Shoes",key="gp_product")
            goal    =st.text_input("Campaign Goal",value=pre.get("goal",""),placeholder="e.g. Drive 10K app installs",key="gp_goal")
            keywords=st.text_input("Keywords / Themes",placeholder="e.g. speed, performance",key="gp_kw")
        with c2:
            camp_type=st.selectbox("Campaign Type",CAMP_TYPES,key="gp_ct")
            tone_def =pre.get("tone","Inspirational")
            tone     =st.selectbox("Tone",TONES,index=TONES.index(tone_def) if tone_def in TONES else 2,key="gp_tone")
            aud_def  =pre.get("audience","Millennials")
            audience =st.selectbox("Target Audience",AUDIENCES,index=AUDIENCES.index(aud_def) if aud_def in AUDIENCES else 1,key="gp_aud")
            variations=st.slider("Variations per Platform",1,5,3,key="gp_var")
        st.markdown("**Platforms**")
        init_plats=pre.get("platforms",["Instagram","Twitter"])
        sel_plats=[]
        plat_cols=st.columns(len(PLATFORMS))
        for i,p in enumerate(PLATFORMS):
            if plat_cols[i].checkbox(p,value=p in init_plats,key=f"gp_p_{p}"): sel_plats.append(p)
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Cancel",key="gp_cancel"): st.session_state.active_panel=None; st.rerun()
        with c2:
            gen=st.button("⚡ Generate Campaign",type="primary",use_container_width=True,key="gp_gen")
        if gen:
            if not brand or not product or not goal: st.warning("Please fill in Brand, Product, and Goal.")
            elif not sel_plats: st.warning("Select at least one platform.")
            else:
                plat_hints={"Instagram":"Reels-first, hook line 1, 3-5 hashtags","Twitter":"Under 280 chars, opinionated hook, 1-2 hashtags","LinkedIn":"Personal story hook, data-backed, 3 hashtags max","Facebook":"Community-first, shareable emotional angle","TikTok":"Hook in 2s, POV/challenge format","YouTube":"Title = 90% clicks, hook in 30s"}
                plat_lines="\n".join(f"{p}: {plat_hints.get(p,'platform-native best practices')}" for p in sel_plats)
                prompt=f"""Social media Creative Director. Agency-quality campaign.
Brief: {brand} | {product} | {camp_type} | Goal: {goal} | Audience: {audience} | Tone: {tone}{(' | Keywords: '+keywords) if keywords else ''}
Platforms: {', '.join(sel_plats)} | {variations} variation(s)
Platform rules:
{plat_lines}
Return ONLY valid JSON:
{{"campaign_tagline":"","campaign_summary":"","brand_voice_guide":"","audience_insight":"","platforms":[{{"platform_name":"{sel_plats[0]}","posts":[{{"hook":"","caption":"","hashtags":[],"cta":"","content_type":"","best_time":"","visual_direction":"","engagement_tactic":""}}]}}],"campaign_ideas":[{{"title":"","big_idea":"","viral_mechanism":"","expected_impact":""}}],"kpis":[],"budget_tips":[]}}"""
                with st.spinner(f"Generating with Groq ({MODEL})…"):
                    parsed=call_groq(prompt,2500)
                if parsed:
                    if isinstance(parsed.get("platforms"),list):
                        pmap={}
                        for p in parsed["platforms"]:
                            if p.get("platform_name"): pmap[p["platform_name"]]={"posts":p.get("posts",[])}
                        parsed["platforms"]=pmap
                    parsed["_brand"]=brand; parsed["_product"]=product
                    parsed["_tone"]=tone; parsed["_platforms"]=sel_plats; parsed["_variations"]=variations
                    st.session_state.gen_result=parsed; st.rerun()
    else:
        result=st.session_state.gen_result
        kpi_pills=" ".join(f'<span class="kpi-pill">{k}</span>' for k in result.get("kpis",[]))
        bv=f"<div class='insight-label'>Brand Voice</div><div class='insight-text'>{result['brand_voice_guide']}</div>" if result.get("brand_voice_guide") else ""
        ai_insight=f"<div class='insight-label'>Audience Insight</div><div class='insight-text'>{result['audience_insight']}</div>" if result.get("audience_insight") else ""
        tl=f"<div class='result-tagline'>&ldquo;{result['campaign_tagline']}&rdquo;</div>" if result.get("campaign_tagline") else ""
        st.markdown(f'<div class="result-card"><div class="result-name">{result.get("_brand","Campaign")}</div>{tl}<div class="result-summary">{result.get("campaign_summary","")}</div>{bv}{ai_insight}<div class="kpi-row">{kpi_pills}</div></div>',unsafe_allow_html=True)
        plat_keys=list(result.get("platforms",{}).keys())
        if plat_keys:
            tabs=st.tabs(plat_keys)
            for tab,platform in zip(tabs,plat_keys):
                with tab:
                    posts=result["platforms"][platform].get("posts",[])
                    for i,post in enumerate(posts,1):
                        tags_s=" ".join(post.get("hashtags",[]))
                        hook_html=f"<div class='post-hook'><span class='hook-label'>HOOK</span>{post.get('hook','')}</div>" if post.get("hook") else ""
                        vis=f"<div class='meta-full'><span class='meta-key'>Visual Direction</span><span class='meta-val'>{post.get('visual_direction','')}</span></div>" if post.get("visual_direction") else ""
                        eng=f"<div class='meta-full'><span class='meta-key'>Engagement Tactic</span><span class='meta-val'>{post.get('engagement_tactic','')}</span></div>" if post.get("engagement_tactic") else ""
                        st.markdown(f"""<div class="post-card"><div class="post-num">VARIATION {i} · {post.get('content_type','Post').upper()}</div>{hook_html}<div class="post-caption">{post.get('caption','')}</div><div class="post-tags">{tags_s}</div><div class="meta-grid"><div><span class="meta-key">CTA</span><span class="meta-val">{post.get('cta','')}</span></div><div><span class="meta-key">Best Time</span><span class="meta-val">{post.get('best_time','N/A')}</span></div>{vis}{eng}</div></div>""",unsafe_allow_html=True)
        ideas=result.get("campaign_ideas",[])
        if ideas:
            st.markdown("<br><div class='sec-title'>Creative Campaign Concepts</div>",unsafe_allow_html=True)
            ic=st.columns(min(len(ideas),3))
            for col,idea in zip(ic,ideas):
                with col:
                    vir=f"<div class='idea-viral'>⚡ {idea.get('viral_mechanism','')}</div>" if idea.get("viral_mechanism") else ""
                    st.markdown(f'<div class="idea-card"><div class="idea-title">{idea.get("title","")}</div><div class="idea-desc">{idea.get("big_idea","")}</div>{vir}<div class="idea-impact">📈 {idea.get("expected_impact","")}</div></div>',unsafe_allow_html=True)
        for tip in result.get("budget_tips",[]): st.markdown(f'<div class="tip">✅ {tip}</div>',unsafe_allow_html=True)
        render_save_to_campaign("gp",brand=result.get("_brand",""),platforms=result.get("_platforms",[]),tone=result.get("_tone",""),output_count=result.get("_variations",3)*len(result.get("_platforms",[])))
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Generate Another",key="gp_regen"): st.session_state.gen_result=None; st.rerun()
        with c2:
            if st.button("Done ✓",type="primary",use_container_width=True,key="gp_done"):
                st.session_state.active_panel=None; st.session_state.gen_result=None; st.rerun()


def panel_audience():
    pkey="at"; pre=get_panel_prefill(pkey)
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">👥 Audience Targeting</div><div class="gen-panel-sub">Persona-matched messaging strategy — powered by Groq</div></div>',unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.audience_result is None:
        c1,c2=st.columns(2)
        with c1:
            brand  =st.text_input("Brand",value=pre.get("brand",""),key="at_brand")
            product=st.text_input("Product",value=pre.get("product",""),key="at_product")
        with c2:
            goal =st.text_input("Campaign Goal",value=pre.get("goal",""),key="at_goal")
            default_plats=pre.get("platforms",["Instagram","Twitter"])
            plats=st.multiselect("Platforms",PLATFORMS,default=[p for p in default_plats if p in PLATFORMS],key="at_plats")
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Cancel",key="at_cancel"): st.session_state.active_panel=None; st.rerun()
        with c2:
            if st.button("👥 Generate Audience Strategy",type="primary",use_container_width=True,key="at_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt=f"""Digital marketing strategist:
Brand: {brand} | Product: {product} | Goal: {goal or 'Build awareness'} | Platforms: {', '.join(plats) if plats else 'Instagram'}
Return ONLY valid JSON:
{{"primary_persona":{{"name":"","age_range":"","interests":[],"pain_points":[],"motivations":[],"best_platforms":[]}},"secondary_persona":{{"name":"","age_range":"","interests":[],"pain_points":[],"motivations":[],"best_platforms":[]}},"messaging_pillars":[{{"pillar":"","message":"","content_angle":""}}],"platform_strategy":[{{"platform":"","content_type":"","posting_frequency":"","best_times":[],"tone":""}}],"targeting_tips":[]}}"""
                    with st.spinner("Generating…"):
                        result=call_groq(prompt,1800)
                    if result:
                        result["_brand"]=brand; result["_platforms"]=plats
                        st.session_state.audience_result=result; st.rerun()
    else:
        r=st.session_state.audience_result
        st.markdown(f'<div class="topbar-title">Audience Strategy: {r.get("_brand","")}</div>',unsafe_allow_html=True)
        tabs=st.tabs(["Personas","Messaging Pillars","Platform Strategy","Targeting Tips"])
        with tabs[0]:
            for p,lbl in [(r.get("primary_persona",{}),"Primary"),(r.get("secondary_persona",{}),"Secondary")]:
                st.markdown(f'<div class="result-card"><div class="result-name">{lbl}: {p.get("name","")}</div><div class="insight-label">Interests</div><div class="insight-text">{", ".join(p.get("interests",[]))}</div><div class="insight-label">Pain Points</div><div class="insight-text">{", ".join(p.get("pain_points",[]))}</div><div class="insight-label">Best Platforms</div><div class="insight-text">{", ".join(p.get("best_platforms",[]))}</div></div>',unsafe_allow_html=True)
        with tabs[1]:
            for pillar in r.get("messaging_pillars",[]): st.markdown(f'<div class="post-card"><div class="post-num">{pillar.get("pillar","")}</div><div class="post-caption">{pillar.get("message","")}</div><div class="post-tags">{pillar.get("content_angle","")}</div></div>',unsafe_allow_html=True)
        with tabs[2]:
            for ps in r.get("platform_strategy",[]): st.markdown(f'<div class="post-card"><div class="post-num">{ps.get("platform","")}</div><div class="post-caption">{ps.get("content_type","")} — {ps.get("tone","")}</div><span class="meta-key">Frequency</span><span class="meta-val">{ps.get("posting_frequency","")}</span><br><span class="meta-key">Best Times</span><span class="meta-val">{", ".join(ps.get("best_times",[]))}</span></div>',unsafe_allow_html=True)
        with tabs[3]:
            for tip in r.get("targeting_tips",[]): st.markdown(f'<div class="tip">💡 {tip}</div>',unsafe_allow_html=True)
        render_save_to_campaign("at",brand=r.get("_brand",""),platforms=r.get("_platforms",[]),tone="Professional",output_count=2)
        if st.button("← Back",key="at_back"): st.session_state.audience_result=None; st.session_state.active_panel=None; st.rerun()


def panel_ideation():
    pkey="ci"; pre=get_panel_prefill(pkey)
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">💡 Campaign Ideation</div><div class="gen-panel-sub">Creative concepts & content calendar ideas — powered by Groq</div></div>',unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.ideation_result is None:
        c1,c2=st.columns(2)
        with c1:
            brand  =st.text_input("Brand",value=pre.get("brand",""),key="ci_brand")
            product=st.text_input("Product",value=pre.get("product",""),key="ci_product")
        with c2:
            goal    =st.text_input("Goal",value=pre.get("goal",""),key="ci_goal")
            tone_def=pre.get("tone","Inspirational")
            tone    =st.selectbox("Tone",TONES,index=TONES.index(tone_def) if tone_def in TONES else 2,key="ci_tone")
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Cancel",key="ci_cancel"): st.session_state.active_panel=None; st.rerun()
        with c2:
            if st.button("💡 Generate Ideas",type="primary",use_container_width=True,key="ci_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt=f"""Senior creative director. 6 innovative campaign concepts:
Brand: {brand} | Product: {product} | Goal: {goal or 'Build brand awareness'} | Tone: {tone}
Return ONLY valid JSON:
{{"campaign_concepts":[{{"title":"","big_idea":"","cultural_hook":"","viral_mechanism":"","content_formats":[],"expected_impact":""}}],"content_calendar":[{{"week":1,"theme":"","posts":[""],"platforms":[]}}],"hashtag_strategy":{{"branded":[],"trending":[],"niche":[]}},"collab_ideas":[]}}"""
                    with st.spinner("Generating…"):
                        result=call_groq(prompt,2000)
                    if result:
                        result["_brand"]=brand; result["_tone"]=tone
                        st.session_state.ideation_result=result; st.rerun()
    else:
        r=st.session_state.ideation_result
        st.markdown(f'<div class="topbar-title">Campaign Ideas: {r.get("_brand","")}</div>',unsafe_allow_html=True)
        tabs=st.tabs(["Concepts","Content Calendar","Hashtag Strategy","Collab Ideas"])
        with tabs[0]:
            for c in r.get("campaign_concepts",[]):
                vir=f"<div class='idea-viral'>⚡ {c.get('viral_mechanism','')}</div>" if c.get("viral_mechanism") else ""
                st.markdown(f'<div class="idea-card"><div class="idea-title">{c.get("title","")}</div><div class="idea-desc">{c.get("big_idea","")}</div>{vir}<div class="idea-impact">📈 {c.get("expected_impact","")}</div></div>',unsafe_allow_html=True)
        with tabs[1]:
            for week in r.get("content_calendar",[]):
                posts_html="".join(f"<div style='font-size:12.5px;color:#334155;margin-top:4px'>• {p}</div>" for p in week.get("posts",[]))
                st.markdown(f'<div class="kanban-task"><div class="task-title">Week {week.get("week","")} — {week.get("theme","")}</div><div class="task-meta">{" · ".join(week.get("platforms",[]))}</div>{posts_html}</div>',unsafe_allow_html=True)
        with tabs[2]:
            hs=r.get("hashtag_strategy",{})
            c1,c2,c3=st.columns(3)
            with c1: st.markdown("**Branded**"); st.code(" ".join(hs.get("branded",[])))
            with c2: st.markdown("**Trending**"); st.code(" ".join(hs.get("trending",[])))
            with c3: st.markdown("**Niche**"); st.code(" ".join(hs.get("niche",[])))
        with tabs[3]:
            for idea in r.get("collab_ideas",[]): st.markdown(f'<div class="tip">🤝 {idea}</div>',unsafe_allow_html=True)
        render_save_to_campaign("ci",brand=r.get("_brand",""),platforms=["Instagram","Twitter"],tone=r.get("_tone","Inspirational"),output_count=6)
        if st.button("← Back",key="ci_back"): st.session_state.ideation_result=None; st.session_state.active_panel=None; st.rerun()


def panel_custom():
    pkey="cf"; pre=get_panel_prefill(pkey)
    st.markdown('<div class="gen-panel"><div class="gen-panel-title">⚙ Custom Flow</div><div class="gen-panel-sub">AI-generated bespoke campaign skeleton — powered by Groq</div></div>',unsafe_allow_html=True)
    render_import_strip(pkey)
    if st.session_state.custom_result is None:
        brand      =st.text_input("Brand / Company",value=pre.get("brand",""),key="cf_brand",placeholder="e.g. Sourcesys")
        product    =st.text_input("Product / Service",value=pre.get("product",""),key="cf_product",placeholder="e.g. AI Platform")
        goal       =st.text_input("Campaign Goal",value=pre.get("goal",""),key="cf_goal",placeholder="e.g. 50K sign-ups in Q1")
        custom_inst=st.text_area("Custom Instructions",key="cf_inst",placeholder="Focus on B2B decision makers…",height=90)
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Cancel",key="cf_cancel"): st.session_state.active_panel=None; st.rerun()
        with c2:
            if st.button("⚙ Build Custom Skeleton",type="primary",use_container_width=True,key="cf_gen"):
                if not brand or not product: st.warning("Fill Brand and Product.")
                else:
                    prompt=f"""Campaign architect. Bespoke skeleton:
Brand: {brand} | Product: {product} | Goal: {goal or 'Grow market share'} | Custom: {custom_inst or 'None'}
Return ONLY valid JSON:
{{"campaign_name":"","campaign_objective":"","unique_angle":"","phases":[{{"phase_number":1,"name":"","duration":"","activities":[],"deliverables":[],"success_metrics":[]}}],"messaging_framework":{{"core_message":"","supporting_messages":[],"tone_guide":"","words_to_use":[],"words_to_avoid":[]}},"channel_mix":[{{"channel":"","role":"","budget_allocation":"","kpi":""}}],"risk_mitigation":[]}}"""
                    with st.spinner("Building skeleton…"):
                        result=call_groq(prompt,2000)
                    if result:
                        result["_brand"]=brand; result["_product"]=product
                        st.session_state.custom_result=result; st.rerun()
    else:
        r=st.session_state.custom_result
        ua=f"<div class='insight-label'>Unique Angle</div><div class='insight-text'>{r.get('unique_angle','')}</div>" if r.get("unique_angle") else ""
        st.markdown(f'<div class="result-card"><div class="result-name">{r.get("campaign_name",r.get("_brand",""))}</div><div class="result-summary">{r.get("campaign_objective","")}</div>{ua}</div>',unsafe_allow_html=True)
        tabs=st.tabs(["Campaign Phases","Messaging Framework","Channel Mix","Risk Mitigation"])
        with tabs[0]:
            for phase in r.get("phases",[]):
                acts="".join(f"<div style='font-size:12.5px;color:#334155;margin-top:3px'>• {a}</div>" for a in phase.get("activities",[]))
                dels="".join(f"<div style='font-size:12.5px;color:#334155;margin-top:3px'>• {d}</div>" for d in phase.get("deliverables",[]))
                kpis="".join(f"<div style='font-size:12.5px;color:#334155;margin-top:3px'>• {m}</div>" for m in phase.get("success_metrics",[]))
                st.markdown(f'<div class="post-card"><div class="post-num">PHASE {phase.get("phase_number","")} — {phase.get("duration","")}</div><div class="post-caption">{phase.get("name","")}</div><span class="meta-key">Activities</span>{acts}<span class="meta-key" style="margin-top:8px;display:block">Deliverables</span>{dels}<span class="meta-key" style="margin-top:8px;display:block">Metrics</span>{kpis}</div>',unsafe_allow_html=True)
        with tabs[1]:
            mf=r.get("messaging_framework",{})
            st.markdown(f'<div class="result-card"><div class="insight-label">Core Message</div><div class="insight-text">{mf.get("core_message","")}</div><div class="insight-label" style="margin-top:10px">Tone Guide</div><div class="insight-text">{mf.get("tone_guide","")}</div><div class="insight-label" style="margin-top:10px">Words to Use</div><div class="post-tags">{" · ".join(mf.get("words_to_use",[]))}</div><div class="insight-label">Words to Avoid</div><div style="font-size:12.5px;color:#DC2626">{" · ".join(mf.get("words_to_avoid",[]))}</div></div>',unsafe_allow_html=True)
        with tabs[2]:
            for ch in r.get("channel_mix",[]): st.markdown(f'<div class="post-card"><div class="post-num">{ch.get("channel","")}</div><div class="post-caption">{ch.get("role","")}</div><div class="meta-grid"><div><span class="meta-key">Budget</span><span class="meta-val">{ch.get("budget_allocation","")}</span></div><div><span class="meta-key">KPI</span><span class="meta-val">{ch.get("kpi","")}</span></div></div></div>',unsafe_allow_html=True)
        with tabs[3]:
            for risk in r.get("risk_mitigation",[]): st.markdown(f'<div class="tip">⚠️ {risk}</div>',unsafe_allow_html=True)
        render_save_to_campaign("cf",brand=r.get("_brand",""),platforms=["Instagram","LinkedIn"],tone="Professional",output_count=len(r.get("phases",[])))
        if st.button("← Back",key="cf_back"): st.session_state.custom_result=None; st.session_state.active_panel=None; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ALL CAMPAIGNS
# ─────────────────────────────────────────────────────────────────────────────
def page_campaigns():
    campaigns=st.session_state.saved_campaigns
    c1,c2=st.columns([3,1])
    with c1:
        st.markdown('<div class="topbar-title">All Campaigns</div><div class="topbar-sub">AI-powered social media generation — Socialyze</div>',unsafe_allow_html=True)
    with c2:
        if st.button("＋ New Campaign",type="primary",key="dash_new",use_container_width=True):
            st.session_state.active_panel="generate"; st.rerun()

    total  =len(campaigns)
    outputs=sum(c.get("output_count",1) for c in campaigns)
    plat_set=set(p for c in campaigns for p in c.get("platforms",[]))
    tones  =[c.get("tone","") for c in campaigns if c.get("tone")]
    top_tone=max(set(tones),key=tones.count) if tones else "—"

    st.markdown(f"""
    <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Campaigns</div><div class="stat-value">{total}</div><span class="stat-change {'stat-up' if total>0 else 'stat-down'}">{total} total</span></div>
        <div class="stat-card"><div class="stat-label">Posts Generated</div><div class="stat-value">{outputs}</div><span class="stat-change {'stat-up' if outputs>0 else 'stat-down'}">{outputs} outputs saved</span></div>
        <div class="stat-card"><div class="stat-label">Platforms Used</div><div class="stat-value">{len(plat_set)}</div><span class="stat-change {'stat-up' if plat_set else 'stat-down'}">{len(plat_set)} platforms active</span></div>
        <div class="stat-card"><div class="stat-label">Avg. Tone</div><div class="stat-value" style="font-size:18px">{top_tone}</div><span class="stat-change {'stat-up' if top_tone!='—' else 'stat-down'}">Most used tone</span></div>
    </div>""",unsafe_allow_html=True)

    panel=st.session_state.active_panel
    if panel=="generate": panel_generate(); return
    if panel=="audience": panel_audience(); return
    if panel=="ideation": panel_ideation(); return
    if panel=="custom":   panel_custom();   return

    st.markdown('<div class="sec-title">Start Generating</div><div class="sec-sub">Select a framework to bootstrap your campaign.</div>',unsafe_allow_html=True)
    fw_defs=[("generate","#EBF0FF","⚡","AI Post Generator","Multi-platform captions & hashtags via Groq"),
             ("audience","#F0FDF4","👥","Audience Targeting","Persona-matched messaging strategy"),
             ("ideation","#FFF7ED","💡","Campaign Ideation","Creative concepts & content calendar ideas"),
             ("custom",  "#FDF4FF","⚙","Custom Flow","AI-generated bespoke campaign skeleton")]
    fw_cols=st.columns(4)
    for col,(pid,bg,emoji,name,desc) in zip(fw_cols,fw_defs):
        with col:
            st.markdown(f'<div class="fw-card"><div class="fw-icon" style="background:{bg}">{emoji}</div><div class="fw-name">{name}</div><div class="fw-desc">{desc}</div></div>',unsafe_allow_html=True)
            if st.button("Open",key=f"fw_{pid}",use_container_width=True):
                st.session_state.active_panel=pid; st.rerun()

    st.markdown("<br><div class='sec-title' style=\"font-family:'Syne',sans-serif;font-size:16px;font-weight:700\">Recent Campaigns</div>",unsafe_allow_html=True)

    if not campaigns:
        st.markdown('<div class="empty-state"><div class="empty-icon">🚀</div><div class="empty-title">No campaigns yet</div><div class="empty-sub">Click a framework above to generate your first campaign!</div></div>',unsafe_allow_html=True)
    else:
        render_campaign_grid(campaigns[:4],source="dash")

    st.markdown('<div class="footer"><strong>Socialyze</strong> — Sourcesys Technologies</div>',unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ACTIVE CAMPAIGNS
# ─────────────────────────────────────────────────────────────────────────────
def page_active():
    campaigns=st.session_state.saved_campaigns
    c1,c2=st.columns([4,1])
    with c1:
        st.markdown(f'<div class="page-hdr"><div><div class="page-title">Active Campaigns</div><div class="page-sub">All your AI-generated campaigns · {len(campaigns)} total</div></div></div>',unsafe_allow_html=True)
    with c2:
        if st.button("↺ Refresh",key="act_refresh",use_container_width=True): st.rerun()

    search  =st.text_input("",placeholder="🔍  Search by brand or campaign name…",key="act_search",label_visibility="collapsed")
    filtered=[c for c in campaigns if search.lower() in c.get("campaign_name","").lower()] if search else campaigns

    if not campaigns:
        st.markdown('<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No campaigns yet</div><div class="empty-sub">Generate content from All Campaigns to see it here.</div></div>',unsafe_allow_html=True)
    elif not filtered:
        st.markdown(f'<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No matches for "{search}"</div><div class="empty-sub">Try a different name.</div></div>',unsafe_allow_html=True)
    else:
        render_campaign_grid(filtered,source="active")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: CAMPAIGN BRIEF
# ─────────────────────────────────────────────────────────────────────────────
def page_brief():
    brief    =st.session_state.brief
    has_brief=bool(brief.get("brand_name"))
    st.markdown(f'<div class="page-hdr"><div style="display:flex;align-items:flex-start;gap:14px"><div><div class="page-title">Campaign Brief</div><div class="page-sub">{"Your default campaign brief is saved. Edit and re-save anytime." if has_brief else "Set up default campaign inputs to pre-fill any AI panel automatically."}</div></div></div>{"<span class=\"saved-badge\">✓ Brief Saved</span>" if has_brief else ""}</div>',unsafe_allow_html=True)
    st.markdown('<div class="info-banner">ℹ️ &nbsp; Campaign Brief is <strong>optional</strong>. When saved, click <strong>"📋 From Campaign Brief"</strong> inside any AI service panel to pre-fill its fields instantly.</div>',unsafe_allow_html=True)
    st.markdown('<div class="form-card"><div class="card-title">Campaign Details</div>',unsafe_allow_html=True)
    c1,c2=st.columns(2)
    with c1:
        brand_name     =st.text_input("Brand / Company Name *",value=brief.get("brand_name",""),placeholder="e.g. Nike, Zomato, Sourcesys",key="br_brand")
        product_service=st.text_input("Product / Service *",value=brief.get("product_service",""),placeholder="e.g. Running Shoes",key="br_prod")
    with c2:
        campaign_goal  =st.text_input("Campaign Goal *",value=brief.get("campaign_goal",""),placeholder="e.g. Drive app installs",key="br_goal")
        target_audience=st.text_input("Target Audience *",value=brief.get("target_audience",""),placeholder="e.g. Millennials in metro cities",key="br_aud")
    st.markdown("**Default Tone**")
    current_tone=brief.get("tone","Inspirational")
    tone_cols=st.columns(len(TONES))
    selected_tone=current_tone
    for i,t in enumerate(TONES):
        with tone_cols[i]:
            if st.button(t,key=f"br_tone_{t}",type="primary" if t==current_tone else "secondary",use_container_width=True):
                selected_tone=t
    st.markdown("**Platforms** (optional)")
    current_plats=brief.get("platforms",[])
    plat_cols=st.columns(len(PLATFORMS)); selected_plats=[]
    for i,p in enumerate(PLATFORMS):
        with plat_cols[i]:
            if st.checkbox(p,value=p in current_plats,key=f"br_plat_{p}"): selected_plats.append(p)
    st.markdown("</div>",unsafe_allow_html=True)
    if st.button("💾 "+("Update Brief" if has_brief else "Save Brief"),type="primary",key="br_save"):
        if not brand_name.strip() or not product_service.strip() or not campaign_goal.strip() or not target_audience.strip():
            st.error("All fields marked * are required.")
        else:
            st.session_state.brief={"brand_name":brand_name.strip(),"product_service":product_service.strip(),"campaign_goal":campaign_goal.strip(),"target_audience":target_audience.strip(),"tone":selected_tone,"platforms":selected_plats}
            st.success("✓ Campaign Brief saved! Use 'Import Data' in any AI panel to auto-fill from this brief.")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: CONTENT PLANNER
# ─────────────────────────────────────────────────────────────────────────────
def page_planner():
    tasks=st.session_state.content_tasks
    c1,c2=st.columns([4,1])
    with c1: st.markdown('<div class="page-hdr"><div><div class="page-title">Content Planner</div><div class="page-sub">Plan, track, and manage your content tasks across all platforms.</div></div></div>',unsafe_allow_html=True)
    with c2:
        st.markdown("<br>",unsafe_allow_html=True)
        add_task_open=st.button("＋ Add Task",type="primary",key="planner_add_btn",use_container_width=True)
    if add_task_open: st.session_state["planner_show_form"]=not st.session_state.get("planner_show_form",False)

    if st.session_state.get("planner_show_form",False):
        with st.container():
            st.markdown('<div class="form-card"><div class="card-title">Add Content Task</div>',unsafe_allow_html=True)
            c1,c2,c3=st.columns(3)
            with c1:
                t_title =st.text_input("Task Title *",key="nt_title",placeholder="e.g. Instagram Reel — Product Launch")
                t_type  =st.text_input("Task Type *",key="nt_type",placeholder="e.g. Reel, Story, Blog Post")
            with c2:
                t_platform=st.selectbox("Platform",["Instagram","Twitter / X","LinkedIn","Facebook","TikTok","YouTube","Pinterest","Threads","Other"],key="nt_plat")
                t_status  =st.selectbox("Column",["Planned","In Progress","Completed"],key="nt_status")
            with c3:
                t_date=st.date_input("Date",key="nt_date")
                t_time=st.time_input("Time",key="nt_time")
            t_desc=st.text_area("Description (optional)",key="nt_desc",placeholder="Brief notes…",height=70)
            ca,cb=st.columns(2)
            with ca:
                if st.button("Cancel",key="nt_cancel"): st.session_state["planner_show_form"]=False; st.rerun()
            with cb:
                if st.button("✔ Add Task",type="primary",use_container_width=True,key="nt_add"):
                    if not t_title.strip() or not t_type.strip(): st.warning("Task Title and Type are required.")
                    else:
                        st.session_state.content_tasks.append({"id":len(tasks),"title":t_title.strip(),"platform":t_platform,"task_type":t_type,"date":str(t_date),"time":str(t_time)[:5],"status":t_status,"description":t_desc})
                        st.session_state["planner_show_form"]=False; st.success(f"✓ Task '{t_title}' added!"); st.rerun()
            st.markdown("</div>",unsafe_allow_html=True)

    st.markdown("<br>",unsafe_allow_html=True)
    cols=st.columns(3)
    for col_widget,kc in zip(cols,KANBAN_COLS):
        col_tasks=[t for t in tasks if t.get("status")==kc["id"]]
        with col_widget:
            st.markdown(f'<div class="kanban-col"><div class="kanban-col-hdr"><span style="width:8px;height:8px;border-radius:50%;background:{kc["color"]};display:inline-block;margin-right:4px;flex-shrink:0"></span><span class="kanban-col-label">{kc["label"]}</span><span class="kanban-col-count" style="background:{kc["bg"]};color:{kc["color"]}">{len(col_tasks)}</span></div>',unsafe_allow_html=True)
            if not col_tasks: st.markdown('<div class="task-empty">⊕ Drop tasks here</div>',unsafe_allow_html=True)
            else:
                for t in col_tasks:
                    type_pill=f'<span class="task-type-pill">{t.get("task_type","")}</span>' if t.get("task_type") else ""
                    plat_pill=f'<span class="task-plat-pill">{t.get("platform","")}</span>' if t.get("platform") else ""
                    desc_html=f"<p style='font-size:12px;color:#5A607A;margin-top:6px;line-height:1.5'>{t.get('description','')[:80]}{'…' if len(t.get('description',''))>80 else ''}</p>" if t.get("description") else ""
                    st.markdown(f'<div class="kanban-task"><div class="task-title">{t["title"]}</div><div class="task-meta">{type_pill} {plat_pill}</div>{desc_html}<div class="task-footer"><span>📅 {t.get("date","")}</span><span>🕐 {t.get("time","")}</span></div></div>',unsafe_allow_html=True)
                    move_opts=[s["id"] for s in KANBAN_COLS if s["id"]!=kc["id"]]
                    new_status=st.selectbox("",["— keep —"]+move_opts,key=f"mv_{t['id']}_{kc['id']}",label_visibility="collapsed")
                    if new_status!="— keep —":
                        for task in st.session_state.content_tasks:
                            if task["id"]==t["id"]: task["status"]=new_status
                        st.rerun()
            st.markdown("</div>",unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: COMPLIANCE GUARD
# ─────────────────────────────────────────────────────────────────────────────
def page_compliance():
    PLATFORM_ICONS={"Instagram":"📷","Twitter":"𝕏","LinkedIn":"in","TikTok":"♪","Facebook":"f","YouTube":"▶"}
    st.markdown('<div class="page-hdr"><div><span class="page-badge">🛡 Compliance Guard</span><div class="page-title">Compliance Guard</div><div class="page-sub">Paste your post copy and check it against platform rules, character limits, hashtag policies, brand tone, and copyright risk signals.</div></div></div>',unsafe_allow_html=True)

    left,right=st.columns([5,6])
    with left:
        st.markdown('<div class="compliance-step-block"><div class="compliance-step-label"><span class="compliance-step-num">1</span> CAMPAIGN <span style="font-size:10px;color:#9BA3BB;font-weight:400;text-transform:none;letter-spacing:0">optional</span></div></div>',unsafe_allow_html=True)
        campaigns=st.session_state.saved_campaigns
        camp_options=["No campaign (generic check)"]+[cap_first(c.get("campaign_name","")) for c in campaigns]
        st.selectbox("Campaign",camp_options,key="cg_camp",label_visibility="collapsed")
        st.markdown('<div class="compliance-step-block" style="margin-top:16px"><div class="compliance-step-label"><span class="compliance-step-num">2</span> PLATFORM</div></div>',unsafe_allow_html=True)
        platform=st.session_state.get("compliance_platform","Instagram")
        plat_row1=st.columns(3); plat_row2=st.columns(3)
        all_plats=["Instagram","Twitter","LinkedIn","TikTok","Facebook","YouTube"]
        for col_w,p in zip(plat_row1+plat_row2,all_plats):
            with col_w:
                if st.button(f"{PLATFORM_ICONS.get(p,'•')} {p}",key=f"cg_plat_{p}",use_container_width=True,type="primary" if platform==p else "secondary"):
                    st.session_state.compliance_platform=p; st.session_state.compliance_checked=False; st.session_state.compliance_result=None; st.rerun()
        st.markdown('<div class="compliance-step-block" style="margin-top:16px"><div class="compliance-step-label"><span class="compliance-step-num">3</span> POST COPY</div></div>',unsafe_allow_html=True)
        platform=st.session_state.get("compliance_platform","Instagram")
        char_limit={"Instagram":2200,"Twitter":280,"LinkedIn":3000,"Facebook":63206,"TikTok":2200,"YouTube":5000}.get(platform,9999)
        post_text=st.text_area("",value=st.session_state.compliance_text,placeholder=f"Paste your {platform} post copy here…",height=200,key="cg_text",label_visibility="collapsed")
        char_count=len(post_text); over_limit=char_count>char_limit
        st.markdown(f"<div style='font-size:12px;color:{'#DC2626' if over_limit else '#9BA3BB'};margin-bottom:4px'>{char_count:,} / {char_limit:,} chars {'⚠ Over limit' if over_limit else ''}</div>",unsafe_allow_html=True)
        run_btn=st.button("🛡 Run Compliance Check",type="primary",use_container_width=True,key="cg_check",disabled=not post_text.strip())
        if run_btn and post_text.strip():
            st.session_state.compliance_text=post_text; st.session_state.compliance_checked=True
            rules=PLATFORM_RULES.get(platform,[]); passed=[]; failed=[]; warnings=[]
            for rule_id,label,check_fn,msg in rules:
                ok=check_fn(post_text)
                if ok: passed.append((rule_id,label,msg))
                elif rule_id in ("has_cta","optimal_len"): warnings.append((rule_id,label,msg))
                else: failed.append((rule_id,label,msg))
            score=int((len(passed)/max(len(rules),1))*100)
            hashtags=[w for w in post_text.split() if w.startswith("#")]
            risk_level="High" if (len(failed)>=3 or over_limit) else "Medium" if len(failed)>=1 else "Low"
            st.session_state.compliance_result={"passed":passed,"failed":failed,"warnings":warnings,"score":score,"hashtags":hashtags,"platform":platform,"char_count":char_count,"risk_level":risk_level}
            st.rerun()
        if st.session_state.compliance_checked:
            if st.button("↺ Clear & Reset",key="cg_reset"):
                st.session_state.compliance_text=""; st.session_state.compliance_checked=False; st.session_state.compliance_result=None; st.rerun()

    with right:
        result=st.session_state.compliance_result
        if not st.session_state.compliance_checked or result is None:
            plat_preview=st.session_state.get("compliance_platform","Instagram")
            rules_preview=PLATFORM_RULES.get(plat_preview,[])
            rule_items="".join(f'<div class="rule-preview-item"><span class="rule-preview-dot" style="background:#3B6BF5"></span>{label}</div>' for _,label,_,_ in rules_preview)
            st.markdown(f'<div style="text-align:center;padding:40px 20px 20px"><div style="font-size:40px;margin-bottom:16px">🛡</div><div style="font-family:\'Syne\',sans-serif;font-size:16px;font-weight:700;color:#0D0F1A;margin-bottom:8px">Your compliance report will appear here</div><div style="font-size:13px;color:#9BA3BB;line-height:1.6;max-width:300px;margin:0 auto">Checks your post against {plat_preview}\'s platform rules.</div></div><div class="rule-preview"><div class="rule-preview-title" style="color:#3B6BF5">{plat_preview.upper()} QUALITY RULES</div>{rule_items}</div>',unsafe_allow_html=True)
        else:
            score=result["score"]; risk_level=result["risk_level"]
            sc_class="score-green" if score>=80 else "score-amber" if score>=50 else "score-red"
            risk_class="risk-low" if risk_level=="Low" else "risk-medium" if risk_level=="Medium" else "risk-high"
            risk_emoji="✅" if risk_level=="Low" else "⚠️" if risk_level=="Medium" else "🔴"
            risk_sub="Safe to publish" if risk_level=="Low" else "Review before posting" if risk_level=="Medium" else "Immediate action needed"
            st.markdown(f'<div class="score-card"><div style="flex:1"><div class="score-label">Compliance Score</div><div class="score-value {sc_class}">{score}%</div><div style="font-size:12px;color:#9BA3BB;margin-top:4px">{result["platform"]} · {result["char_count"]:,} chars</div></div><div style="flex:1;text-align:center"><div class="score-label">Risk Level</div><div class="risk-badge {risk_class}" style="margin:6px 0;display:inline-flex">{risk_emoji} {risk_level}</div><div style="font-size:11.5px;color:#9BA3BB">{risk_sub}</div></div><div style="flex-shrink:0"><svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="none" stroke="#F0F2F8" stroke-width="8"/><circle cx="40" cy="40" r="30" fill="none" stroke="{"#16A34A" if score>=80 else "#D97706" if score>=50 else "#DC2626"}" stroke-width="8" stroke-dasharray="{(score/100)*188.5} 188.5" stroke-linecap="round" transform="rotate(-90 40 40)"/><text x="40" y="46" text-anchor="middle" font-size="15" font-weight="700" fill="{"#16A34A" if score>=80 else "#D97706" if score>=50 else "#DC2626"}" font-family="DM Sans, sans-serif">{score}%</text></svg></div></div>',unsafe_allow_html=True)
            tabs=st.tabs(["✓ Quality Checks","⚠ Policy & Risk"])
            with tabs[0]:
                if result["failed"]:
                    st.markdown(f"<div style='font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px'>● Issues to Fix ({len(result['failed'])})</div>",unsafe_allow_html=True)
                    for _,label,msg in result["failed"]: st.markdown(f'<div class="check-item"><span style="font-size:16px;flex-shrink:0">❌</span><div><div class="check-label">{label}</div><div class="check-msg">{msg}</div></div></div>',unsafe_allow_html=True)
                if result["warnings"]:
                    st.markdown(f"<div style='font-size:12px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:.07em;margin:14px 0 8px'>● Suggestions ({len(result['warnings'])})</div>",unsafe_allow_html=True)
                    for _,label,msg in result["warnings"]: st.markdown(f'<div class="check-item"><span style="font-size:16px;flex-shrink:0">⚠️</span><div><div class="check-label">{label}</div><div class="check-msg">{msg}</div></div></div>',unsafe_allow_html=True)
                if result["passed"]:
                    st.markdown(f"<div style='font-size:12px;font-weight:700;color:#16A34A;text-transform:uppercase;letter-spacing:.07em;margin:14px 0 8px'>● Passing ({len(result['passed'])})</div>",unsafe_allow_html=True)
                    pass_cols=st.columns(2)
                    for i,(_,label,_) in enumerate(result["passed"]):
                        with pass_cols[i%2]: st.markdown(f'<div style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#16A34A;padding:5px 0">✅ {label}</div>',unsafe_allow_html=True)
            with tabs[1]:
                ht_count=len(result["hashtags"]); rec_max={"Instagram":30,"Twitter":2,"LinkedIn":5,"Facebook":10,"TikTok":8,"YouTube":3}.get(result["platform"],10)
                ht_color="#16A34A" if ht_count<=rec_max else "#D97706"
                st.markdown(f'<div class="result-card"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px"><div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:10px"><div style="font-size:22px;font-weight:700;color:#0D0F1A">{result["char_count"]:,}</div><div style="font-size:10.5px;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-top:3px">Characters</div></div><div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:10px"><div style="font-size:22px;font-weight:700;color:{ht_color}">{ht_count}</div><div style="font-size:10.5px;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-top:3px">Hashtags</div></div><div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:10px"><div style="font-size:14px;font-weight:700;color:{ht_color}">{"✅ Good" if ht_count<=rec_max else "⚠️ Too many"}</div><div style="font-size:10.5px;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-top:3px">Hashtag Check</div></div></div></div>',unsafe_allow_html=True)
                if result["hashtags"]: st.markdown(f'<div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;margin-top:8px"><div style="font-size:11px;font-weight:700;color:#9BA3BB;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Detected Hashtags</div><div style="font-size:13px;color:#3B82F6;font-weight:500;line-height:1.9">{" ".join(result["hashtags"][:30])}</div></div>',unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: SHARED WORKSPACES
# ─────────────────────────────────────────────────────────────────────────────
def page_shared():
    campaigns=st.session_state.saved_campaigns
    c1,c2=st.columns([4,1])
    with c1: st.markdown('<div class="page-hdr"><div><div class="page-title">Shared Workspaces</div><div class="page-sub">Collaborate on campaigns with your team in real time.</div></div></div>',unsafe_allow_html=True)
    with c2:
        st.markdown("<br>",unsafe_allow_html=True)
        if st.button("＋ Share a Campaign",type="primary",key="sw_share_btn",use_container_width=True):
            st.session_state.shared_tab="share"; st.rerun()
    tab=st.session_state.shared_tab; shares=st.session_state.my_shares; out_count=len(shares)
    t_cols=st.columns(3)
    tab_defs=[("incoming","📨  Shared With Me"),("outgoing",f"📤  My Shares  {out_count if out_count else ''}".strip()),("share","✦  New Share")]
    for col_w,(tid,lbl) in zip(t_cols,tab_defs):
        with col_w:
            if st.button(lbl,key=f"sh_tab_{tid}",type="primary" if tab==tid else "secondary",use_container_width=True):
                st.session_state.shared_tab=tid; st.rerun()
    st.markdown("<br>",unsafe_allow_html=True)
    if tab=="incoming":
        st.markdown('<div class="empty-state"><div class="empty-icon">📨</div><div class="empty-title">No campaigns shared with you yet</div><div class="empty-sub">When a teammate shares a campaign with your email, it will appear here.</div></div>',unsafe_allow_html=True)
    elif tab=="outgoing":
        if not shares:
            st.markdown('<div class="empty-state"><div class="empty-icon">📤</div><div class="empty-title">You haven\'t shared any campaigns yet</div><div class="empty-sub">Use the \'New Share\' tab to invite a teammate.</div></div>',unsafe_allow_html=True)
            if st.button("→ Share a Campaign",type="primary",key="sw_goto_share"): st.session_state.shared_tab="share"; st.rerun()
        else:
            for i,s in enumerate(shares):
                av_bg,av_fg=avatar_color(s["email"])
                perm_class="perm-badge-edit" if s["permission"]=="edit" else "perm-badge-view"
                perm_label="✎ Edit" if s["permission"]=="edit" else "👁 View"
                st.markdown(f'<div class="share-row-card"><div class="share-avatar-sm" style="background:{av_bg};color:{av_fg}">{s["email"][:2].upper()}</div><div style="flex:1"><div class="share-email">{s["email"]}</div><div class="share-camp-name">⚡ {cap_first(s["campaign"])}</div></div><span class="{perm_class}">{perm_label}</span></div>',unsafe_allow_html=True)
                if st.button("Revoke",key=f"sw_revoke_{i}",type="secondary"):
                    st.session_state.my_shares=[x for x in shares if x!=s]; st.rerun()
    else:
        st.markdown('<div class="share-form-wrap"><div class="share-form-title">Invite a Teammate</div><p class="share-form-sub">Share any campaign with a team member.</p>',unsafe_allow_html=True)
        camp_names=[c.get("campaign_name","") for c in campaigns]
        if not camp_names: st.info("No campaigns found. Generate one first from All Campaigns.")
        else:
            camp_options_disp=[cap_first(n) for n in camp_names]
            sel_idx=st.selectbox("Campaign",range(len(camp_options_disp)),format_func=lambda x:camp_options_disp[x],key="sw_camp_sel")
            sel_camp=camp_names[sel_idx]; inv_email=st.text_input("Teammate's Email",placeholder="teammate@company.com",key="sw_email")
            st.markdown("**Permission**")
            perm_state=st.session_state.get("sw_perm","view"); perm_cols=st.columns(2)
            with perm_cols[0]:
                if st.button("👁 View only",key="sw_perm_view",use_container_width=True,type="primary" if perm_state=="view" else "secondary"): st.session_state["sw_perm"]="view"; st.rerun()
            with perm_cols[1]:
                if st.button("✎ Can edit",key="sw_perm_edit",use_container_width=True,type="primary" if perm_state=="edit" else "secondary"): st.session_state["sw_perm"]="edit"; st.rerun()
            st.markdown("<br>",unsafe_allow_html=True)
            if st.button("📤 Send Invite",type="primary",key="sw_submit",use_container_width=True):
                if not inv_email or "@" not in inv_email: st.error("Please enter a valid email address.")
                else:
                    st.session_state.my_shares.append({"email":inv_email.strip(),"campaign":sel_camp,"permission":st.session_state.get("sw_perm","view")})
                    st.success(f"✓ Invite sent to {inv_email.strip()}!"); st.session_state.shared_tab="outgoing"; st.rerun()
        st.markdown('<div class="feature-list"><div class="feature-item"><span>📨</span><span>Invite by email — view or edit permissions</span></div><div class="feature-item"><span>🔒</span><span>Only the owner can save or delete the campaign</span></div><div class="feature-item"><span>🔔</span><span>Revoke access at any time from "My Shares"</span></div></div></div>',unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: FAVOURITES
# ─────────────────────────────────────────────────────────────────────────────
def page_fav():
    campaigns=st.session_state.saved_campaigns; fav_ids=st.session_state.fav_ids
    favs=[c for c in campaigns if c.get("id") in fav_ids]
    st.markdown(f'<div class="page-hdr"><div><div class="page-title">Favourites</div><div class="page-sub">{"Star any campaign to pin it here." if not favs else str(len(favs))+" pinned campaign"+("" if len(favs)==1 else "s")}</div></div></div>',unsafe_allow_html=True)
    if not favs:
        st.markdown('<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-title">No favourites yet</div><div class="empty-sub">Click ☆ on any campaign to favourite it.</div></div>',unsafe_allow_html=True)
        if campaigns:
            st.markdown("**All Campaigns**")
            n=min(len(campaigns),3); cols=st.columns(n)
            for i,c in enumerate(campaigns):
                with cols[i%n]:
                    st.markdown(campaign_card_html(c),unsafe_allow_html=True)
                    cid=c.get("id",i); is_fav=cid in fav_ids
                    if st.button("★ Favourited" if is_fav else "☆ Favourite",key=f"fav_{cid}_{i}",type="primary" if is_fav else "secondary",use_container_width=True):
                        if is_fav: st.session_state.fav_ids=[x for x in fav_ids if x!=cid]
                        else: st.session_state.fav_ids=fav_ids+[cid]
                        st.rerun()
    else:
        search=st.text_input("🔍 Search favourites…",key="fav_search")
        shown=[c for c in favs if search.lower() in c.get("campaign_name","").lower()] if search else favs
        n=min(len(shown),3)
        if n:
            cols=st.columns(n)
            for i,c in enumerate(shown):
                with cols[i%n]:
                    st.markdown(campaign_card_html(c),unsafe_allow_html=True)
                    cid=c.get("id",i)
                    col_a,col_b=st.columns(2)
                    with col_a:
                        if st.button("Open →",key=f"fav_open_{cid}_{i}",use_container_width=True,type="primary"): open_workspace(cid)
                    with col_b:
                        if st.button("★ Remove",key=f"unfav_{cid}_{i}",use_container_width=True): st.session_state.fav_ids=[x for x in fav_ids if x!=cid]; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: ARCHIVED
# ─────────────────────────────────────────────────────────────────────────────
def page_archived():
    campaigns=st.session_state.saved_campaigns; arc_ids=st.session_state.archived_ids
    archived=[c for c in campaigns if c.get("id") in arc_ids]
    st.markdown(f'<div class="page-hdr"><div><div class="page-title">Archived</div><div class="page-sub">{"Archive campaigns to keep but step back from." if not archived else str(len(archived))+" archived campaign"+("" if len(archived)==1 else "s")}</div></div></div>',unsafe_allow_html=True)
    if not archived:
        st.markdown('<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No archived campaigns</div><div class="empty-sub">Click 📦 on any campaign to archive it.</div></div>',unsafe_allow_html=True)
        if campaigns:
            st.markdown("**All Campaigns**")
            n=min(len(campaigns),3); cols=st.columns(n)
            for i,c in enumerate(campaigns):
                with cols[i%n]:
                    st.markdown(campaign_card_html(c),unsafe_allow_html=True)
                    cid=c.get("id",i); is_arc=cid in arc_ids
                    if st.button("📦 Archived" if is_arc else "📦 Archive",key=f"arc_{cid}_{i}",type="primary" if is_arc else "secondary",use_container_width=True):
                        if is_arc: st.session_state.archived_ids=[x for x in arc_ids if x!=cid]
                        else: st.session_state.archived_ids=arc_ids+[cid]
                        st.rerun()
    else:
        search=st.text_input("🔍 Search archive…",key="arc_search")
        shown=[c for c in archived if search.lower() in c.get("campaign_name","").lower()] if search else archived
        n=min(len(shown),3)
        if n:
            cols=st.columns(n)
            for i,c in enumerate(shown):
                with cols[i%n]:
                    st.markdown(campaign_card_html(c),unsafe_allow_html=True)
                    cid=c.get("id",i)
                    if st.button("↩ Unarchive",key=f"unarc_{cid}_{i}",type="primary",use_container_width=True):
                        st.session_state.archived_ids=[x for x in arc_ids if x!=cid]; st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: BRANDS
# ─────────────────────────────────────────────────────────────────────────────
def page_brands():
    brands=st.session_state.brands
    st.markdown('<div class="page-hdr"><div><div class="page-title">Brand &amp; Client Hub</div><div class="page-sub">Manage all your brand profiles. Each brand pre-fills your campaign brief automatically.</div></div></div>',unsafe_allow_html=True)
    if brands:
        brand_cols=st.columns(min(len(brands),3))
        for i,b in enumerate(brands):
            color=b.get("color",BRAND_COLORS[i%len(BRAND_COLORS)]); inits=brand_inits(b.get("name","BR"))
            plat_pills="".join(f'<span class="brand-plat-pill">{p}</span>' for p in b.get("platforms",[])[:4])
            with brand_cols[i%3]:
                st.markdown(f'<div class="brand-card"><div class="brand-top" style="background:{color}20;border-bottom:3px solid {color}"><span class="brand-inits" style="color:{color}">{inits}</span></div><div class="brand-body"><div class="brand-name">{b["name"]}</div><div class="brand-industry">{b.get("industry","")}</div><div class="brand-plat-row">{plat_pills}</div></div></div>',unsafe_allow_html=True)
    st.markdown("---")
    st.markdown('<div class="card-title">➕ Add New Brand</div>',unsafe_allow_html=True)
    c1,c2=st.columns(2)
    with c1:
        b_name    =st.text_input("Brand Name *",key="nb_name",placeholder="e.g. Nike")
        b_industry=st.selectbox("Industry",INDUSTRIES,key="nb_industry")
    with c2:
        b_tone =st.selectbox("Tone of Voice",["Professional","Casual & Friendly","Inspirational","Witty & Humorous","Bold & Edgy"],key="nb_tone")
        b_notes=st.text_area("Notes",key="nb_notes",placeholder="Key messaging, goals…",height=80)
    st.markdown("**Platforms**")
    b_plats=[]; all_plats_b=["Instagram","Twitter / X","LinkedIn","Facebook","TikTok","YouTube","Pinterest","Threads"]
    plat_cols_b=st.columns(len(all_plats_b))
    for i,p in enumerate(all_plats_b):
        with plat_cols_b[i]:
            if st.checkbox(p,key=f"nb_plat_{p}"): b_plats.append(p)
    if st.button("💾 Save Brand",type="primary",key="nb_save"):
        if not b_name.strip(): st.error("Brand Name is required.")
        else:
            st.session_state.brands.append({"name":b_name.strip(),"industry":b_industry,"tone":b_tone,"platforms":b_plats,"notes":b_notes,"color":BRAND_COLORS[len(brands)%len(BRAND_COLORS)]})
            st.success(f"✓ Brand '{b_name}' saved!"); st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: CREATOR STUDIO
# ─────────────────────────────────────────────────────────────────────────────
def page_creator():
    pkey="cs"; pre=get_panel_prefill(pkey); campaigns=st.session_state.saved_campaigns
    st.markdown('<div class="page-hdr"><div><span class="page-badge">✦ Creator Studio</span><div class="page-title">Creator Studio</div><div class="page-sub">Reads your brand data — outputs a 100% personalised editing guide.</div></div></div>',unsafe_allow_html=True)
    render_import_strip(pkey)
    FORMATS=["reel","carousel","photo","story","thread"]
    FORMAT_LABELS={"reel":"Reel / Short Video","carousel":"Carousel Slides","photo":"Photo Post","story":"Story Frames","thread":"Twitter Thread"}
    st.markdown('<div class="form-card">',unsafe_allow_html=True)
    camp_names=["(None)"]+[cap_first(c.get("campaign_name","")) for c in campaigns]
    st.selectbox("Campaign (optional)",camp_names,key="cs_camp")
    c1,c2=st.columns(2)
    with c1:
        brand  =st.text_input("Brand",value=pre.get("brand",""),key="cs_brand",placeholder="e.g. Nike")
        product=st.text_input("Product",value=pre.get("product",""),key="cs_product",placeholder="e.g. Running Shoes")
        tone_def=pre.get("tone","Inspirational")
        tone_cs=st.selectbox("Tone",TONES,index=TONES.index(tone_def) if tone_def in TONES else 2,key="cs_tone")
    with c2:
        fmt    =st.selectbox("Content Format",FORMATS,format_func=lambda x:FORMAT_LABELS[x],key="cs_fmt")
        plat_cs=st.selectbox("Platform",PLATFORMS,key="cs_plat")
        aud_cs =st.selectbox("Audience",AUDIENCES,index=1,key="cs_aud")
    hint=st.text_area("Content Hint (optional)",key="cs_hint",placeholder="e.g. a 30-sec Instagram Reel for product launch…",height=70)
    st.markdown("</div>",unsafe_allow_html=True)
    if st.button("✦ Generate Personalised Guide",type="primary",key="cs_gen"):
        if not brand or not product: st.warning("Fill Brand and Product.")
        else:
            fmt_name=FORMAT_LABELS[fmt]
            prompt=f"""Social media content creator and creative director.
Brand: {brand} | Product: {product} | Format: {fmt_name} | Platform: {plat_cs} | Tone: {tone_cs} | Audience: {aud_cs}
{('Content Hint: '+hint) if hint else ''}
Return ONLY valid JSON:
{{"script":"Full {fmt_name.lower()} with scene-by-scene breakdown.","editing_steps":"Step-by-step editing guide for {plat_cs}.","canva_layout":"Detailed Canva layout with dimensions, fonts, hex colors.","thumbnail":"Thumbnail concept — composition, text overlay, font, colors.","common_mistakes":"5 common mistakes with {fmt_name.lower()} on {plat_cs} and how to avoid each."}}"""
            with st.spinner(f"Building guide with Groq ({MODEL})…"):
                result=call_groq(prompt,2500)
            if result:
                result["_brand"]=brand; result["_format"]=fmt; result["_platforms"]=[plat_cs]; result["_tone"]=tone_cs
                st.session_state.creator_result=result; st.rerun()
    if st.session_state.creator_result:
        r=st.session_state.creator_result; fmt_r=r.get("_format","reel"); fmt_lbl=FORMAT_LABELS.get(fmt_r,"Reel Script")
        st.markdown(f'<div style="display:flex;align-items:center;gap:10px;background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;padding:12px 18px;margin-bottom:16px;"><span style="font-size:11px;color:#9BA3BB">Guide personalised for</span><span style="font-size:13px;font-weight:700;color:#0D0F1A">{r.get("_brand","")}</span><span class="kpi-pill">{fmt_lbl}</span></div>',unsafe_allow_html=True)
        tab_labels=[f"✦ {fmt_lbl}","✦ Editing Steps","✦ Canva Layout","✦ Thumbnail","✦ Mistakes to Avoid"]
        key_map={tab_labels[0]:"script",tab_labels[1]:"editing_steps",tab_labels[2]:"canva_layout",tab_labels[3]:"thumbnail",tab_labels[4]:"common_mistakes"}
        tabs=st.tabs(tab_labels)
        for tab,lbl in zip(tabs,tab_labels):
            with tab:
                content=r.get(key_map.get(lbl,"script"),"")
                st.markdown(f'<div class="creator-result-card"><div class="creator-content">{content}</div></div>',unsafe_allow_html=True)
        render_save_to_campaign("cs",brand=r.get("_brand",""),platforms=r.get("_platforms",[]),tone=r.get("_tone",""),output_count=5)
        c1,c2=st.columns(2)
        with c1:
            if st.button("← Generate Another",key="cs_regen"): st.session_state.creator_result=None; st.rerun()
        with c2:
            if st.button("Open in Canva →",type="primary",key="cs_canva",use_container_width=True):
                st.markdown('<script>window.open("https://www.canva.com/create/","_blank")</script>',unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE: TEAM
# ─────────────────────────────────────────────────────────────────────────────
def page_team():
    st.markdown('<div class="page-hdr"><div><div class="page-title">Team</div><div class="page-sub">Sourcesys Technologies — manage your workspace members.</div></div></div>',unsafe_allow_html=True)
    st.markdown('<div class="member-card"><div class="member-avatar">SC</div><div><div class="member-name">Sourcesys</div><div class="member-email">sourcesys@example.com</div></div><span class="role-badge">You · Member</span></div>',unsafe_allow_html=True)
    st.markdown('<div class="coming-soon-card"><div style="font-family:\'Syne\',sans-serif;font-size:17px;font-weight:700;color:#0D0F1A;margin-bottom:10px">Team Collaboration — Coming Soon</div><div style="font-size:13.5px;color:#5A607A;line-height:1.7;margin-bottom:16px;max-width:520px">Grow your workspace into a full team environment. Invite colleagues, assign roles, and track who generated what.</div><div style="font-size:13px;color:#334155;margin-bottom:7px">👤  Invite team members by email</div><div style="font-size:13px;color:#334155;margin-bottom:7px">🔐  Role-based access: Admin / Editor / Viewer</div><div style="font-size:13px;color:#334155;margin-bottom:16px">📁  Shared brand briefs across the whole team</div><span style="display:inline-flex;align-items:center;background:#FFF7ED;color:#EA580C;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;border:1px solid #FED7AA">In Development</span></div>',unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# ROUTER  — workspace takes priority over page routing
# ─────────────────────────────────────────────────────────────────────────────
if st.session_state.workspace_id is not None:
    page_workspace()
else:
    page=st.session_state.page
    if   page=="campaigns":  page_campaigns()
    elif page=="brief":      page_brief()
    elif page=="active":     page_active()
    elif page=="fav":        page_fav()
    elif page=="archived":   page_archived()
    elif page=="shared":     page_shared()
    elif page=="brands":     page_brands()
    elif page=="planner":    page_planner()
    elif page=="creator":    page_creator()
    elif page=="compliance": page_compliance()
    elif page=="team":       page_team()
    else:                    page_campaigns()

    if page!="campaigns":
        st.markdown('<div class="footer"><strong>Socialyze</strong> — Sourcesys Technologies<br>Team: Subasri B &nbsp;·&nbsp; Gautham Krishnan K &nbsp;·&nbsp; Ashwin D &nbsp;·&nbsp; Vinjarapu Ajay Kumar</div>',unsafe_allow_html=True)
