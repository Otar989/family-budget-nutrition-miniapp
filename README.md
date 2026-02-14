# Family Budget Nutrition Planner (Telegram Mini App)

A production-ready MVP of a Telegram Mini App that helps families build nutrition plans under a selected budget (dinner/day/month), taking allergies of each family member into account.

## Features

- Budget-driven nutrition planning (`dinner`, `day`, `month`)
- Family profile with unlimited members
- Allergies per member
- Telegram account authorization with initData signature validation
- Meal recommendations with recipes and prep time
- Product basket split by stores with price estimation
- Order draft endpoint for retail checkout handoff
- Telegram WebApp initialization (`ready`, `expand`) + RU UI
- Supabase schema included
- Adaptive mobile-first UI with tab bar and light/dark liquid-glass design

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind v4 (custom CSS-driven design)
- Supabase JS client

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## Environment variables

Copy `.env.example` to `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_SESSION_SECRET=...
```

## Supabase setup

1. Create a new Supabase project in dashboard.
2. Open SQL Editor.
3. Run SQL from `supabase/schema.sql`.
4. Copy project URL + anon key to `.env.local` and Vercel env vars.

## Deploy to Vercel (skill flow)

From project root:

```bash
bash scripts/deploy.sh /Users/otaradzhiashvili/Desktop/APPS/Рекомендация\ питания/food-budget-miniapp
```

Alternative standard flow:

```bash
npm i -g vercel
vercel
vercel --prod
```

## GitHub setup

```bash
git init
git add .
git commit -m "Initial Telegram mini app MVP"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Telegram Mini App connection (next step after bot token)

1. Create bot via BotFather (you will provide token later).
2. Set Mini App URL to your Vercel production URL.
3. Configure menu button / web app button with the same URL.
4. (Optional) Enable Telegram auth validation in backend.

## Notes about retail integration

Current version uses a normalized in-app catalog and checkout handoff links per retailer.
For real ordering, replace `/api/order` with official retailer APIs (cart creation, availability by city, slot booking, payment session).
