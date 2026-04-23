# Socialyze — AI Social Media Campaign Generator

<div align="center">

**Organisation:** Sourcesys Technologies &nbsp;|&nbsp; **Version:** 1.0.0 &nbsp;|&nbsp; **Status:** Production-Ready &nbsp;|&nbsp; **Licence:** MIT

**Project Team:** Subasri B · Gautham Krishnan K · Ashwin D · Vinjarapu Ajay Kumar

---

### Technology Stack

[![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq-llama--3.1--8b--instant-F55036?style=for-the-badge)](https://console.groq.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.32-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white)](https://streamlit.io/)

</div>

---

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Sign In</strong><br/><br/>
      <img src="docs/screenshots/signin.png" alt="Socialyze Sign In" width="100%"/>
      <br/><sub>Supabase-authenticated sign-in with Google OAuth support</sub>
    </td>
    <td align="center" width="50%">
      <strong>All Campaigns Dashboard</strong><br/><br/>
      <img src="docs/screenshots/all_campaigns.png" alt="All Campaigns" width="100%"/>
      <br/><sub>Summary metrics, quick-start frameworks, and recent campaign cards</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Active Campaigns</strong><br/><br/>
      <img src="docs/screenshots/active_campaigns.png" alt="Active Campaigns" width="100%"/>
      <br/><sub>All AI-generated campaigns with platform tags and output counts</sub>
    </td>
    <td align="center" width="50%">
      <strong>Shared Workspaces</strong><br/><br/>
      <img src="docs/screenshots/shared_workspaces.png" alt="Shared Workspaces" width="100%"/>
      <br/><sub>Invite teammates with View only or Can edit permissions</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Content Planner</strong><br/><br/>
      <img src="docs/screenshots/content_planner.png" alt="Content Planner" width="100%"/>
      <br/><sub>Kanban-style task board — Planned, In Progress, Completed</sub>
    </td>
    <td align="center" width="50%">
      <strong>Compliance Guard</strong><br/><br/>
      <img src="docs/screenshots/compliance_guard.png" alt="Compliance Guard" width="100%"/>
      <br/><sub>Rule-based compliance checks against platform policies and brand safety</sub>
    </td>
  </tr>
</table>

> **Note:** Screenshots are stored in `docs/screenshots/`. If they do not render in your viewer, the images are also included directly in this repository's `docs/` directory.

---

## Table of Contents

- [Project Overview](#1-project-overview)
- [System Architecture](#2-system-architecture)
- [Directory Structure](#3-directory-structure)
- [Technology Stack](#4-technology-stack)
- [Database Schema](#5-database-schema)
- [API Reference](#6-api-reference)
- [Frontend Module Reference](#7-frontend-module-reference)
- [Machine Learning Pipeline](#8-machine-learning-pipeline)
- [Installation and Quick Start](#9-installation-and-quick-start)
- [Environment Variables](#10-environment-variables)
- [Email Service](#11-email-service)
- [Security Notes](#12-security-notes)
- [Deployment](#13-deployment)
- [Required Raw Datasets](#14-required-raw-datasets)
- [Licence and Team](#15-licence-and-team)

---

## 1. Project Overview

Socialyze is a full-stack AI-powered social media campaign generation platform. The system combines a Groq-backed REST API (running `llama-3.1-8b-instant`), a React single-page application with Supabase authentication and persistence, a Python-based machine learning pipeline for tone classification, and a content planning module — all working in concert to help marketing teams produce multi-platform campaign content at scale.

**Key capabilities at a glance:**

- Generate multi-platform campaign posts, captions, and hashtags across Instagram, Twitter, LinkedIn, Facebook, TikTok, and YouTube in a single request
- Target content to eight audience segments: Gen Z, Millennials, Professionals, Students, Parents, Entrepreneurs, Executives, and Creators
- Apply nine distinct content tones: Casual, Professional, Inspirational, Humorous, Urgent, Bold, Empathetic, Witty, and Provocative
- Schedule and track content production with a Kanban-based Content Planner backed by Supabase
- Run rule-based compliance checks against platform policies, copyright signals, and brand tone guidelines
- Export campaign reports as print-ready PDFs directly from the browser — no external dependency
- Share campaign workspaces with teammates under configurable View only or Can edit permissions
- Fine-tune a DistilBERT tone classifier on a custom dataset of 4,566 social media posts

All AI generation routes through a single Groq API call (`llama-3.1-8b-instant`) with domain-specific structured fallback content served if Groq is unavailable. Both the Express backend and the React frontend independently implement the Groq call, so the system remains resilient whether requests originate from the API server or directly from the browser.

---

## 2. System Architecture

### 2.1 High-Level Architecture

Socialyze is structured as three decoupled layers that communicate over standard HTTP and PostgreSQL row-level security policies.

- **Frontend (React + Vite):** Single-page application served on port 5173. All API calls are proxied to the Express backend via `vite.config.js` to eliminate browser CORS issues during development. Authentication state is managed through the Supabase JS client with persistent JWT sessions and automatic token refresh. The frontend also contains its own Groq caller (`lib/generateWithFallback.js`) and domain-specific fallback service (`lib/fallbackService.js`) as a secondary path for direct browser-to-Groq calls.

- **Backend (Express + Node.js):** REST API server on port 3000. Wraps the Groq API (`https://api.groq.com/openai/v1/chat/completions`), handles generation for all four service routes and two inline routes, and dispatches collaboration invite emails via Nodemailer.

- **Data Layer (Supabase):** Managed PostgreSQL database with Row Level Security enforced at the SQL policy level. Stores user profiles, campaigns, campaign outputs, content calendar tasks, and shared workspace invitations.

- **ML Pipeline (Python):** Standalone scripts for data preprocessing, synthetic data generation, DistilBERT fine-tuning, and model evaluation. Decoupled from the web application — runs independently on demand.

### 2.2 Groq Generation Flow

When a request arrives, the backend (or frontend fallback path) makes a single call to the Groq API with `llama-3.1-8b-instant`. If Groq responds with valid JSON, that response is returned immediately. If Groq fails for any reason (auth error, network timeout, unparseable response), a domain-specific structured fallback object is returned so the UI always displays coherent, usable content.

| Priority | Provider | Role |
|---|---|---|
| 1 — Primary | Groq `llama-3.1-8b-instant` | Real AI response |
| 2 — Static | Domain fallback content | Structured hardcoded response (emergency only) |

---

## 3. Directory Structure

```
SOCIAL MEDIA PROJECT/
├── app.py                          Streamlit app (ML demo / legacy frontend)
├── preprocess.py                   Data preprocessing pipeline
├── generate_synthetic_data.py      Synthetic data generator
├── requirements.txt                Python dependencies
├── supabase_schema.sql             Core database schema + RLS
├── content_calendar_migration.sql  Content calendar table + RLS
├── shared_workspaces_migration.sql Collaboration tables + cross-user RLS
├── .env                            Root environment variables (gitignored)
├── .gitignore
│
├── config/
│   ├── __init__.py
│   └── settings.py                 Centralised Python configuration
│
├── backend/
│   ├── server.js                   Express API + Groq integration
│   ├── config.js                   Groq config + platform/tone/campaign-type helpers
│   ├── emailService.js             Nodemailer invite email service
│   ├── test-groq.js                Groq API key tester (run: node test-groq.js)
│   ├── package.json
│   ├── .env                        Backend environment variables (gitignored)
│   └── routes/
│       ├── audienceTargeting.js    POST /audience-targeting
│       ├── campaignIdeation.js     POST /campaign-ideation
│       ├── creatorStudio.js        POST /creator-studio (6 content formats)
│       └── customFlow.js           POST /custom-flow
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js              Dev server + API proxy configuration
│   ├── index.html
│   └── src/
│       ├── App.jsx                 Root component — auth gate + page routing
│       ├── supabaseClient.js       Supabase client singleton
│       ├── main.jsx
│       ├── lib/
│       │   ├── campaignService.js  Supabase CRUD — campaigns, outputs, brief, sharing
│       │   ├── fallbackService.js  Domain-specific structured fallback content (all panels)
│       │   ├── generateWithFallback.js  Frontend Groq caller + JSON parser
│       │   └── safeParseJSON.js    JSON sanitiser for Groq responses
│       ├── components/
│       │   ├── Auth.jsx            Sign-in / sign-up UI
│       │   ├── Dashboard.jsx       Home dashboard
│       │   ├── Sidebar.jsx         Navigation sidebar
│       │   ├── GeneratePanel.jsx   Multi-platform campaign generator panel
│       │   ├── AudienceTargetingPanel.jsx
│       │   ├── CampaignIdeationPanel.jsx
│       │   ├── CustomFlowPanel.jsx
│       │   ├── FillFromBriefButton.jsx
│       │   ├── QuickCampaignPanel.jsx
│       │   └── CampaignCard.jsx
│       └── pages/
│           ├── CampaignWorkspace.jsx      Full campaign workspace
│           ├── ActiveCampaignsPage.jsx
│           ├── CampaignBriefPage.jsx
│           ├── ContentPlannerPage.jsx
│           ├── CreatorStudioPage.jsx
│           ├── ComplianceGuardPage.jsx
│           ├── ExportPanel.jsx            Print-ready PDF export modal
│           ├── BrandsPage.jsx
│           ├── SharedWorkspacesPage.jsx
│           ├── FavouritesPage.jsx
│           ├── ArchivedPage.jsx
│           └── TeamPage.jsx
│
├── training/
│   └── train.py                    DistilBERT fine-tuning script
│
├── evaluation/
│   └── evaluate.py                 Model evaluation — Accuracy, F1, BLEU
│
├── scripts/
│   └── evaluator.js                Node.js metric utilities
│
├── docs/
│   ├── PREPROCESSING.md            Preprocessing pipeline documentation
│   └── screenshots/                UI screenshots referenced in this README
│
└── data/
    ├── raw/          Raw datasets (gitignored)
    ├── processed/    Cleaned CSVs, train/test splits, hashtag map
    ├── models/       Label mappings + DistilBERT tone classifier weights
    └── evaluation/   evaluation_report.json, metrics_summary.csv
```

---

## 4. Technology Stack

| Technology | Version | Role |
|---|---|---|
| [React](https://react.dev/) | 18.2.0 | Frontend SPA with CSS Modules for component-scoped styling |
| [Vite](https://vitejs.dev/) | 5.0.0 | Frontend build tool and dev server with API proxy |
| [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) | 2.103.0 | Client-side auth, session management, database access |
| [Express](https://expressjs.com/) | 4.19.2 | REST API server — routing, middleware, static file serving |
| [Groq API](https://console.groq.com/) | — | LLM provider — `llama-3.1-8b-instant` for all AI generation |
| [Nodemailer](https://nodemailer.com/) | 8.0.5 | SMTP email dispatch for collaboration invites |
| [Supabase (PostgreSQL)](https://supabase.com/) | Managed | Relational database with Row Level Security |
| [Python](https://www.python.org/) | 3.10+ | ML pipeline runtime |
| [HuggingFace Transformers](https://huggingface.co/docs/transformers) | 4.40.0 | DistilBERT fine-tuning for tone classification |
| [Scikit-learn](https://scikit-learn.org/) | 1.4.0 | Label encoding, train/test split, evaluation metrics |
| [NLTK](https://www.nltk.org/) | 3.8.1 | Tokenisation, stopword removal, BLEU score |
| [Pandas](https://pandas.pydata.org/) | 2.0.0 | Dataset loading, normalisation, schema unification |
| [NumPy](https://numpy.org/) | 1.26.0 | Numerical operations in preprocessing and evaluation |
| [Streamlit](https://streamlit.io/) | 1.32.0 | Python UI for ML pipeline demo |

---

## 5. Database Schema

All tables reside in the `public` schema of a Supabase-managed PostgreSQL instance. Row Level Security is enabled on every table. Three SQL files must be executed in order to provision the full schema.

### 5.1 Schema Files — Execute in Order

```
1. supabase_schema.sql             Core tables + RLS + auto-profile trigger
2. content_calendar_migration.sql  Content calendar table + per-user RLS
3. shared_workspaces_migration.sql Collaboration tables + cross-user RLS
```

Run each file in: **Supabase Dashboard → SQL Editor → New Query**

### 5.2 Table Reference

| Table | Description |
|---|---|
| `profiles` | One row per authenticated user. Auto-created by a trigger on `auth.users` INSERT. Columns: `id`, `full_name`, `email`, `avatar_url`, `created_at`. |
| `campaigns` | Core campaign record. Columns: `id` (UUID), `user_id`, `campaign_name`, `status` (Draft/Active/Archived), `platforms` (text[]), `tone`, `created_at`, `updated_at`. Unique constraint on `(user_id, campaign_name)`. |
| `campaign_outputs` | Generated AI output per campaign per feature. `output_type` is constrained to: `post_generator`, `audience`, `ideation`, `custom_flow`. `generated_data` stored as JSONB. |
| `content_calendar` | Scheduled content tasks. Columns: `title`, `task_type`, `platform`, `description`, `date`, `time`, `status` (Planned / In Progress / Completed). Optionally linked to a campaign. |
| `shared_workspaces` | Collaboration share records. Columns: `campaign_id`, `owner_id`, `invitee_email`, `invitee_id`, `permission` (view / edit), `status` (pending / accepted). Unique on `(campaign_id, invitee_email)`. |

---

## 6. API Reference

The Express server exposes the following HTTP endpoints. All POST endpoints accept and return JSON. The server injects `callGroqJSON`, `callGroqText`, and `generateWithFallback` helpers into `res.locals` so route modules can access Groq without direct imports.

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns server status, timestamp, active LLM provider, model name, and API key status. |
| POST | `/generate` | Multi-platform campaign generator. Returns per-platform `post`, `caption`, and `hashtags`. |
| POST | `/generate-post` | Single-platform AI post generator. Returns `post_variations[]`, `caption_variations[]`, `hashtags[]`, `cta`. |
| POST | `/audience-targeting` | Generates 3 psychographic audience personas with `motivations`, `pain_points`, `behavior`, `content_preferences`, `buying_trigger`. |
| POST | `/campaign-ideation` | Generates 5 creatively distinct campaign concepts scaled from safe to bold. Returns `title`, `tagline`, `idea`, `why_it_works`, `execution`. |
| POST | `/custom-flow` | Full integrated campaign skeleton: name, pillars, platform strategy, posting plan, captions, hashtags, calendar hooks. |
| POST | `/creator-studio` | Platform-specific content editing guide. Supports 6 content formats — reel, carousel, photo, story, short (YouTube Shorts), and thread. |
| POST | `/send-invite` | Sends an HTML invite email for workspace collaboration. Accepts `toEmail`, `ownerEmail`, `campaignName`, `permission`. |

### POST /generate — Request Body

```json
{
  "campaign_name": "Brand Name",
  "campaign_type": "product launch",
  "target_audience": "Gen Z",
  "campaign_goal": "Drive online sales",
  "tone": "inspirational",
  "platforms": ["Instagram", "Twitter", "LinkedIn"],
  "include_hashtags": true,
  "custom_hashtags": []
}
```

### POST /generate-post — Required Fields

`brand_name`, `campaign_goal`, `product_or_service`, `target_audience`, `key_message`, `call_to_action`, `tone` (optional, default: `"professional"`), `platform` (optional, default: `"Instagram"`)

### POST /audience-targeting — Required Fields

`brand_name`, `product_or_service`, `campaign_objective`, `industry`, `age_group`, `region`, `customer_type`, `pain_points`

### POST /campaign-ideation — Required Fields

`brand_name`, `product_or_service`, `campaign_goal`, `target_audience`, `tone`, `season_or_event`, `platform_focus`

### POST /custom-flow — Required Fields

`brand_name`, `product_or_service`, `business_objective`, `target_audience`, `tone`, `platforms`, `campaign_duration`, `key_message`, `call_to_action`

### POST /creator-studio — Content Formats

The route auto-detects the requested format from a `contentHint` string inside the request body `ctx` object. Supported formats:

| Format | Detected from `contentHint` keywords | Output key |
|---|---|---|
| `reel` | reel, tiktok, video, film, clip | `reelScript` |
| `carousel` | carousel, slide, swipe, multi-slide, document | `carouselSlides` |
| `photo` | post, photo, image, static, infograph | `photoPost` |
| `story` | story, stories | `storyFrames` |
| `short` | short, youtube short, yt short | `reelScript` |
| `thread` | thread, tweet thread, twitter thread | `twitterThread` |

---

## 7. Frontend Module Reference

### 7.1 Application Routing

`App.jsx` manages all client-side navigation through a single `activeNav` state string. There is no React Router dependency; routing is handled by conditional rendering. Supabase auth state is resolved asynchronously on mount — the app renders a boot spinner until the session is confirmed or denied.

| Route Key | Page |
|---|---|
| `campaigns` (default) | Home dashboard — summary metrics and quick campaign launcher |
| `brief` | Campaign Brief input form |
| `active` | Active Campaigns filtered by status |
| `planner` | Content Planner — Kanban board |
| `fav` | Favourited campaigns |
| `archived` | Archived campaigns |
| `shared` | Shared With Me |
| `brands` | Brand profiles |
| `team` | Team management |
| `creator` | Creator Studio |
| `compliance` | Compliance Guard |

### 7.2 Frontend Service Library (`src/lib/`)

| Module | Responsibility |
|---|---|
| `campaignService.js` | All Supabase data operations: save/fetch campaigns, outputs, brief, sharing, collaboration. |
| `fallbackService.js` | Domain-specific structured fallback content for all panels when Groq is unavailable. Never returns null. |
| `generateWithFallback.js` | Frontend Groq caller. Single call to `llama-3.1-8b-instant`, returns parsed JSON or null. |
| `safeParseJSON.js` | JSON sanitiser for raw Groq responses. Strips fences, extracts JSON block, fixes trailing commas. |

---

## 8. Machine Learning Pipeline

The ML pipeline is a seven-stage data engineering and model training workflow that runs entirely in Python. It is decoupled from the web application and can be executed independently.

### 8.1 Pipeline Stages

| Stage | Description |
|---|---|
| Stage 1 — Problem Definition | Define generation targets, identify audience segments, select platforms. |
| Stage 2 — Data Collection | Collect raw datasets from Kaggle (LinkedIn, Instagram Reels, Social Media Advertising, Sentiment) and manual curation. Store in `data/raw/text/`. |
| Stage 3 — Preprocessing | Unify 6 raw datasets into a 9-column schema. Clean with NLTK. Encode labels with Scikit-learn `LabelEncoder`. |
| Stage 4 — Model Selection | DistilBERT (`distilbert-base-uncased`) for supervised 5-class tone classification. |
| Stage 5 — Training | Fine-tune DistilBERT via HuggingFace Trainer API. Output saved to `data/models/tone_classifier/`. |
| Stage 6 — Evaluation | Evaluate on held-out test set. Metrics: Accuracy, Precision, Recall, F1 Score, BLEU Score. |
| Stage 7 — Integration | Streamlit app exposes the pipeline as a UI. Express backend serves generation endpoints. |

### 8.2 Preprocessing Output — Last Run

| Metric | Value |
|---|---|
| Total rows | 4,566 |
| Training set | 3,652 rows (80%) |
| Test set | 914 rows (20%) |
| Tone classes | 5 (Casual, Professional, Inspirational, Humorous, Urgent) |
| Hashtag map topics | 26 |

### 8.3 ML Training Configuration

| Parameter | Value |
|---|---|
| Base model | `distilbert-base-uncased` |
| Max token length | 128 |
| Batch size | 8 |
| Epochs | 3 |
| Learning rate | 2e-5 |
| Test split | 0.20 |

---

## 9. Installation and Quick Start

### 9.1 Prerequisites

- [Node.js 18](https://nodejs.org/) or later
- A Groq API key — free from [console.groq.com](https://console.groq.com)
- A Supabase project — free tier at [supabase.com](https://supabase.com) (project URL and anon key required)
- [Python 3.10](https://www.python.org/downloads/) or later (ML pipeline only)

### 9.2 Start the Express Backend

```bash
cd backend
npm install
# backend/.env is already configured — do not commit it
npm run dev        # development (nodemon hot-reload)
npm start          # production
# Server at http://localhost:3000
```

### 9.3 Start the React Frontend

```bash
cd frontend
npm install
# frontend/.env is already configured — do not commit it
npm run dev        # development at http://localhost:5173
npm run build      # production build → dist/
```

### 9.4 Test the Groq API Key

```bash
cd backend
node test-groq.js
```

### 9.5 Run the Python ML Pipeline

```bash
pip install -r requirements.txt
python preprocess.py
python training/train.py
python evaluation/evaluate.py
streamlit run app.py   # optional — Streamlit demo
```

### 9.6 Provision the Supabase Database

In **Supabase Dashboard → SQL Editor → New Query**, execute in order:

```
1. supabase_schema.sql
2. content_calendar_migration.sql
3. shared_workspaces_migration.sql
```

---

## 10. Environment Variables

### 10.1 Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key from [console.groq.com/keys](https://console.groq.com/keys) |
| `PORT` | — | Express port (default: `3000`) |
| `APP_URL` | — | Frontend base URL for invite email links (default: `http://localhost:5173`) |
| `EMAIL_PROVIDER` | — | `gmail` / `brevo` / `smtp` (default: `gmail`) |
| `GMAIL_USER` | — | Gmail address (Gmail provider) |
| `GMAIL_APP_PASS` | — | 16-char Gmail App Password |
| `BREVO_SMTP_USER` | — | Brevo login email (Brevo provider) |
| `BREVO_SMTP_KEY` | — | Brevo SMTP key |
| `SMTP_HOST` | — | Generic SMTP hostname |
| `SMTP_PORT` | — | Generic SMTP port (default: `587`) |
| `SMTP_USER` | — | Generic SMTP username |
| `SMTP_PASS` | — | Generic SMTP password |
| `EMAIL_FROM_NAME` | — | Sender display name (default: `Socialyze`) |
| `EMAIL_FROM_EMAIL` | — | Sender email address |

### 10.2 Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_GROQ_API_KEY` | ✅ | Groq API key for direct browser-to-Groq calls (fallback path) |
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL (`https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key |
| `VITE_API_URL` | — | Backend base URL (default: `http://localhost:3000`) |

> **Note:** In production, prefer routing all Groq calls through the Express backend and omitting `VITE_GROQ_API_KEY` from the frontend bundle.

---

## 11. Email Service

The collaboration invite system uses [Nodemailer](https://nodemailer.com/) with a configurable transport provider selected via `EMAIL_PROVIDER`. The service verifies its SMTP connection on startup but does not crash the server if misconfigured — it logs a warning and continues.

| Provider | Setup |
|---|---|
| Gmail App Password | Enable 2-Step Verification → generate App Password at `myaccount.google.com/apppasswords`. Set `EMAIL_PROVIDER=gmail`. |
| Brevo SMTP | Sign up at [brevo.com](https://www.brevo.com/) → generate SMTP key. 300 free emails/day. Set `EMAIL_PROVIDER=brevo`. |
| Generic SMTP | Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Set `EMAIL_PROVIDER=smtp`. |

---

## 12. Security Notes

- **API keys:** Never commit real API keys. All `.env` files are gitignored at both root, `backend/`, and `frontend/` levels.
- **Raw datasets:** `data/raw/` is gitignored. Raw datasets may contain personal or licensed data.
- **Model weights:** `data/models/tone_classifier/` is gitignored due to binary file size.
- **Row Level Security:** All Supabase tables enforce RLS. Users cannot read, write, or delete rows they do not own.
- **CORS:** The Express backend uses the `cors` middleware with permissive defaults. For production, restrict: `cors({ origin: 'https://your-domain.com' })`.
- **Frontend Groq key:** `VITE_GROQ_API_KEY` is embedded in the browser bundle. For production deployments, proxy all AI calls through the backend and remove this variable.
- **Input validation:** Every POST endpoint validates required fields and returns HTTP 400 before any AI call is made.

---

## 13. Deployment

### 13.1 Node.js Backend (Railway / Render / Fly.io)

- Root directory: `backend/`
- Start command: `node server.js`
- Add all backend environment variables via the provider's secrets panel.
- Set `APP_URL` to the deployed frontend URL.

### 13.2 React Frontend (Vercel / Netlify)

- Root directory: `frontend/`
- Build command: `npm run build`
- Output directory: `dist/`
- Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GROQ_API_KEY`, and `VITE_API_URL` as environment variables.
- Set `VITE_API_URL` to the deployed backend URL.

### 13.3 Streamlit Cloud (Python ML Demo)

- Push to GitHub. Confirm `.env` and `data/raw/` are gitignored.
- Create app at [share.streamlit.io](https://share.streamlit.io) pointing to `app.py`.
- Add secrets under **Settings → Secrets**.

---

## 14. Required Raw Datasets

Place all raw dataset files in `data/raw/text/` before running `preprocess.py`. These files are gitignored.

| Filename | Source |
|---|---|
| `enriched_posts.json` | [Kaggle](https://www.kaggle.com/) — LinkedIn enriched posts |
| `Instagram_Reels_Data_Cleaned.csv` | [Kaggle](https://www.kaggle.com/) — Instagram Reels engagement |
| `sentimentdataset.csv` | [Kaggle](https://www.kaggle.com/) — Social media sentiment |
| `Social_Media_Advertising.csv` | [Kaggle](https://www.kaggle.com/) — Social media advertising |
| `manual_dataset.csv` | Manual curation — platform-specific annotated posts |
| `image_dataset.csv` | Manual — visual style annotations |

---

## 15. Licence and Team

This project is released under the **MIT Licence**. Copyright Sourcesys Technologies.

| Team Member | Role |
|---|---|
| Subasri B | ML Pipeline, Data Preprocessing, Model Training & Evaluation |
| Gautham Krishnan K | Backend API, Groq Integration, Express Server Architecture |
| Ashwin D | Frontend React Application, UI/UX, Supabase Integration |
| Vinjarapu Ajay Kumar | Compliance System, Creator Studio, Content Planner |

---

*This document reflects the production state of the codebase. All module descriptions are derived directly from source code analysis.*
