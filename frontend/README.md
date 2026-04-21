# Socialyze — React Frontend

Professional dashboard UI for Socialyze.

## Tech Stack
- **React 18** (Vite)
- **CSS Modules** (scoped styles per component)
- **DM Sans + Syne** (Google Fonts)
- Connects to the **Express backend** on `http://localhost:3000`
- Falls back to **direct Claude API** if backend is offline

## Folder Structure

```
src/
├── main.jsx                  ← Entry point
├── index.css                 ← Global reset + CSS variables
├── App.jsx                   ← Root layout (Sidebar + Dashboard)
├── App.module.css
└── components/
    ├── Sidebar.jsx            ← Left nav with brand, links, user
    ├── Sidebar.module.css
    ├── Dashboard.jsx          ← Stats, framework cards, campaign grid
    ├── Dashboard.module.css
    ├── CampaignCard.jsx       ← Individual campaign card with chart
    ├── CampaignCard.module.css
    ├── GeneratePanel.jsx      ← Full AI generation form + results
    └── GeneratePanel.module.css
```

## How to Run

### Step 1 — Install dependencies
```bash
cd "D:\Sourcesys\SOCIAL MEDIA PROJECT\frontend"
npm install
```

### Step 2 — Start the backend (optional but recommended)
```bash
cd "D:\Sourcesys\SOCIAL MEDIA PROJECT\backend"
npm install
npm start
```
Backend runs on → `http://localhost:3000`

### Step 3 — Start the frontend
```bash
cd "D:\Sourcesys\SOCIAL MEDIA PROJECT\frontend"
npm run dev
```
Frontend runs on → `http://localhost:5173`

Open your browser at **http://localhost:5173**

## Features
- Sidebar navigation with workspace, library, team sections
- Live stats row (campaigns, posts generated, platforms, avg tone)
- 4 framework starter cards (AI Generator, Audience, Ideation, Custom)
- Active campaign cards with gradient thumbnails and engagement line charts
- Full campaign generation form — brand, product, goal, tone, audience, platforms
- Results view with per-platform post variations, KPIs, ideas, and budget tips
- Delete campaigns from the grid
- New campaigns auto-added to the grid after generation
