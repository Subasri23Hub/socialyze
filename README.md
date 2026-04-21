# 🚀 Socialyze

> Generate multi-platform post variations, captions, hashtags, and campaign ideas — powered by **Google Gemini 2.0 Flash**.

**Team:** Subasri B · Gautham Krishnan K · Ashwin D · Vinjarapu Ajay Kumar  
**Company:** Sourcesys Technologies

---

## 🧠 Project Overview

**Project Title:** Socialyze  
**Project Description:** Develop a system that generates post variations, captions, hashtags, and campaign ideas for different audiences — automatically, intelligently, and at scale.

---

## 🗺️ Project Workflow — 7 Stages

### Stage 1 — Understand the Problem Statement
- Define what the AI should generate: post variations, captions, hashtags, campaign ideas
- Identify target audiences: Gen Z, Millennials, Professionals, Students, Parents, Entrepreneurs
- Define supported platforms: Instagram, Twitter, LinkedIn, Facebook, TikTok
- Track all changes and progress using **Git** for version control
- Document requirements before writing any code

### Stage 2 — Data Collection
- Collect raw data in multiple formats: **Text** (CSVs, JSONs), **Images**, **Audio**
- Sources: Kaggle datasets (LinkedIn enriched posts, Instagram Reels, Sentiment data, Social Media Advertising), manual curation
- Store raw data in `data/raw/text/`, `data/raw/images/`, `data/raw/audio/`

### Stage 3 — Data Preprocessing
- Clean, format, and structure all raw datasets using **Pandas** and **NumPy**
- Tokenise captions and remove stopwords using **NLTK**
- Encode categorical labels (tone, platform, audience, engagement) with **Scikit-learn LabelEncoder**
- Output train/test splits, cleaned CSVs, and hashtag maps to `data/processed/text/`
- Script: `preprocess.py`

### Stage 4 — LLM Model Selection
- Primary model: **Google Gemini 2.0 Flash** via `google-genai` SDK
- Used for: campaign generation, synthetic data creation, post/caption writing
- Supporting model: **DistilBERT** (HuggingFace Transformers) for tone classification fine-tuning
- API orchestration via **LangChain**-compatible prompt templates (backend `config.js`)

### Stage 5 — Train the Model
- Fine-tune **DistilBERT** (`distilbert-base-uncased`) on the merged dataset for 5-class tone classification
- Training framework: **HuggingFace Transformers + Datasets**
- Parameters: 3 epochs, batch size 8, learning rate 2e-5, early stopping
- Script: `training/train.py`
- Output: `data/models/tone_classifier/`

### Stage 6 — Evaluation — Testing for Quality and Accuracy
- Evaluate the trained model on the held-out test set
- Metrics: **Accuracy, Precision, Recall, F1 Score** (Scikit-learn)
- Text quality metric: **BLEU Score** (NLTK)
- Per-platform accuracy breakdown
- Script: `evaluation/evaluate.py`
- Outputs: `data/evaluation/evaluation_report.json`, `data/evaluation/metrics_summary.csv`

### Stage 7 — Integration and Deployment
- **Frontend:** Streamlit app (`app.py`) — deployed on **Streamlit Cloud**
- **Backend:** Express REST API (`backend/server.js`) — deployable to any **Node.js cloud** (Railway, Render, etc.)
- **Version Control:** GitHub repository with `.gitignore` protecting secrets and large files
- **Secrets Management:** `.env` files and Streamlit secrets (never committed)
- CI/CD: push to GitHub → auto-deploy on Streamlit Cloud

---

## 🛠️ Full Technology Stack

| Layer | Technology |
|---|---|
| **Data Handling** | Pandas, NumPy |
| **NLP Preprocessing** | NLTK (tokenisation, stopwords, BLEU) |
| **Generative AI** | Google Gemini 2.0 Flash (`google-genai`), HuggingFace Transformers |
| **Model Training** | HuggingFace Trainer API, DistilBERT, PyTorch |
| **Evaluation** | Scikit-learn (train/test split, metrics), NLTK BLEU |
| **API / Orchestration** | LangChain-style prompt templates, Express.js REST API |
| **Frontend** | Streamlit (Python) |
| **Deployment** | Streamlit Cloud, GitHub, Node.js Cloud (backend) |

---

## ✨ Features

| Feature | Details |
|---|---|
| 🤖 AI Generation | Google Gemini 2.0 Flash via `google-genai` |
| 📱 Platforms | Instagram, Twitter, LinkedIn, Facebook, TikTok |
| 🎨 Tones | Casual, Professional, Inspirational, Humorous, Urgent |
| 👥 Audiences | Gen Z, Millennials, Professionals, Students, Parents, Entrepreneurs |
| 📊 Dataset Pipeline | Preprocessing → Synthetic Generation → Training → Evaluation |
| 🌐 Frontend | Streamlit (Python) + Express REST API (Node.js) |

---

## 🗂️ Project Structure

```
SOCIAL MEDIA PROJECT/
├── app.py                        # Streamlit app (main entry point)
├── preprocess.py                 # Data preprocessing pipeline
├── generate_synthetic_data.py    # Gemini synthetic data generator
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment variable template
├── .gitignore
│
├── training/
│   └── train.py                  # HuggingFace DistilBERT fine-tuning
│
├── evaluation/
│   └── evaluate.py               # Scikit-learn + BLEU evaluation
│
├── scripts/
│   └── evaluator.js              # Node.js metric utilities
│
├── backend/
│   ├── server.js                 # Express REST API
│   ├── config.js                 # Gemini config + prompt templates
│   ├── package.json
│   └── .env.example
│
├── data/
│   ├── raw/
│   │   ├── text/                 # Raw Kaggle + manual CSVs/JSONs (gitignored)
│   │   ├── images/
│   │   └── audio/
│   ├── processed/
│   │   ├── text/                 # Cleaned datasets, train/test splits
│   │   ├── images/
│   │   └── audio/
│   ├── models/
│   │   └── label_mapping.json
│   └── evaluation/
│       ├── evaluation_report.json
│       └── metrics_summary.csv
│
├── public/
│   └── index.html                # Static landing page for Express
│
└── .streamlit/
    └── secrets.toml              # Streamlit secrets (gitignored)
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- A free Google Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### 1 — Clone & configure

```bash
git clone <your-repo-url>
cd "SOCIAL MEDIA PROJECT"

# Create your .env
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

### 2 — Run the Streamlit app

```bash
pip install -r requirements.txt
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501)

### 3 — (Optional) Run the Express API

```bash
cd backend
cp .env.example .env   # add your GEMINI_API_KEY
npm install
npm start
```

API runs on [http://localhost:3000](http://localhost:3000)

---

## 📊 ML Pipeline

Run these scripts in order to build the full dataset and model:

```bash
# Step 1 — Place raw datasets in data/raw/text/
# Step 2 — Preprocess & create train/test splits
python preprocess.py

# Step 3 — Generate 300 synthetic posts via Gemini
python generate_synthetic_data.py

# Step 4 — Fine-tune DistilBERT tone classifier (optional, needs GPU)
python training/train.py

# Step 5 — Evaluate the model
python evaluation/evaluate.py
```

### Required raw datasets (place in `data/raw/text/`)

| File | Source |
|---|---|
| `enriched_posts.json` | Kaggle — LinkedIn enriched posts |
| `Instagram_Reels_Data_Cleaned.csv` | Kaggle — Instagram Reels |
| `sentimentdataset.csv` | Kaggle — Social media sentiment |
| `Social_Media_Advertising.csv` | Kaggle — Social media advertising |
| `manual_dataset.csv` | Manual curation |
| `image_dataset.csv` | Manual — visual style annotations |

---

## 🌐 API Reference

### `POST /generate`

```json
{
  "campaign_name": "Nike Air Max 2025",
  "campaign_type": "product launch",
  "target_audience": "Gen Z",
  "campaign_goal": "Drive online sales",
  "tone": "inspirational",
  "platforms": ["Instagram", "Twitter"],
  "include_hashtags": true,
  "custom_hashtags": []
}
```

**Response:** Platform-keyed object with `post`, `caption`, and `hashtags` for each platform.

### `GET /health`

Returns `{ "status": "healthy", "timestamp": "..." }`

---

## 🔐 Security Notes

- **Never commit real API keys.** Use `.env` files (gitignored) or Streamlit secrets.
- Raw datasets may contain personal data — keep them out of version control (`data/raw/` is gitignored).
- Trained model weights (`data/models/tone_classifier/`) are gitignored due to size.

---

## 🚢 Deployment (Streamlit Cloud)

1. Push repo to GitHub (ensure `.env` and `data/raw/` are gitignored)
2. Go to [share.streamlit.io](https://share.streamlit.io) → New app
3. Set main file: `app.py`
4. Under **Settings → Secrets**, add:
   ```toml
   GOOGLE_API_KEY = "your_key_here"
   ```

---

## 📄 License

MIT © Sourcesys Technologies
