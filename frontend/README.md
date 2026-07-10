# Kavach — Frontend (React + Vite + Tailwind)

Mobile-first citizen app. Every screen from the UI spec has a route; the
**Home dashboard** and **Check a Message** flow are wired to the live backend as the
reference vertical slice. Remaining screens are laid out with the shared header/layout
and design system, ready to be wired to their endpoints.

## Design system

Tokens live in [tailwind.config.js](tailwind.config.js) and [src/theme/tokens.ts](src/theme/tokens.ts):
- **navy** `#0B3D6B` dominates (top bar, primary buttons, active icons)
- **saffron** `#FF9933` / **india** `#138808` — accents only (≤5% of a screen)
- **safe / caution / highrisk** — used **only** on risk verdict cards & badges

## Run locally

```bash
npm install
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:8000
npm run dev               # http://localhost:5173
```

## Structure

```
src/
├── main.tsx, App.tsx     # app shell + router
├── index.css             # tailwind layers + base tokens
├── theme/tokens.ts       # color/radius constants for use in TS
├── api/                  # client + per-domain API modules
├── components/           # Header, StatusCard, VerdictCard, RiskBadge, ActionTile, ...
├── pages/                # one file per screen (Splash, Login, Home, CheckMessage, ...)
└── routes.tsx            # path → page map
```
