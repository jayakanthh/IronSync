# 💪 IronSync

> A gym & fitness companion app that helps you and your friends train smarter, eat better, and stay motivated together.

IronSync started as a simple idea between two friends who lift together: an app to track our workouts, follow a plan, keep our nutrition in check, and — most importantly — keep each other accountable and hyped. Streaks, shared PRs, supplement notes... the stuff that actually keeps a gym crew going.

This repo is where we plan, design, and build it.

---

## ✨ What IronSync does (the vision)

IronSync is built around five pillars:

### 🏋️ Workouts
- Log daily workouts
- Follow structured training plans
- Track personal records (PRs)

### 🥗 Nutrition
- Build a diet plan
- Count calories & macros
- Log what you eat

### 👤 Profile & Health
- Personal profile
- Body measurements over time
- Health issues / notes so plans train you safely

### 👥 Friend Group
- A private crew of friends
- Share supplement results
- PR leaderboard across the crew
- Streak leaderboard — see who's got the longest run going 🔥
- Get pinged when someone beats your PR

### 🔥 Motivation
- Daily streak counter
- Nudges to keep the habit alive

> 💡 **Adding an idea?** Just drop a bullet under the right pillar above — no table formatting to fight with. For the detailed breakdown with build phases, see **[docs/FEATURES.md](docs/FEATURES.md)**.

---

## 🗺️ Where we are

We build in phases so we always have something working. Short version:

1. ✅ **MVP** — profile + log a workout + streak counter (the core daily loop)
2. ✅ **PRs & Friend Group** — personal records, the crew, PR leaderboard, in-app "someone beat your PR" alerts
3. ✅ **Nutrition** — calorie & macro targets, food log, macro rings, weekly/monthly progress
4. 🚧 **Supplements & polish** — activity feed, badges and the food database are in; supplement sharing, weekly recap, barcode scan and progress photos aren't.

We also built a few things that were never on the list: **live duo/group workouts**, **communities & challenges**, a **7-theme** system, and a **muscle heatmap**.

**Still blocked:** real push notifications ("beat your PR", streak reminders) need Cloud Functions, which need the **Blaze** plan. The server code is written and waiting in `backend/functions/`; until then crew boards sync client-side.

Full plan with per-item status: **[docs/ROADMAP.md](docs/ROADMAP.md)**.

---

## 🧱 Tech stack

- **Frontend:** [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) — one codebase for iOS + Android.
- **Language:** TypeScript.
- **Backend / data:** [Firebase](https://firebase.google.com/) — authentication, Cloud Firestore database, push notifications, and Cloud Functions, so two people can ship without running our own servers.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why we picked these.

---

## 📁 Repo structure

```
IronSync/
├── README.md              ← you are here
├── app/                   ← the Expo (React Native + TS) mobile app
│   └── src/
│       ├── screens/       ← full screens         (Pruthvi / UI)
│       ├── components/    ← reusable UI pieces    (Pruthvi / UI)
│       ├── theme/         ← the 7 themes + tokens (Pruthvi / UI)
│       ├── navigation/    ← tab + stack navigators
│       ├── models/        ← shared data types     (the contract — both)
│       ├── types/         ← UI view-models        (Pruthvi / UI)
│       ├── adapters/      ← models ⇄ view-models bridge (both)
│       ├── services/      ← Firebase data access  (jaikanth / backend)
│       ├── config/        ← Firebase init + your gitignored firebaseConfig.ts
│       ├── context/       ← app-wide state (current user)
│       ├── data/          ← mock/seed data for the UI
│       └── utils/         ← formatting, heatmap & workout helpers
├── backend/               ← Firestore rules, indexes, Cloud Functions & seed scripts (jaikanth)
├── docs/                  ← all planning & design docs
│   ├── FEATURES.md        ← every feature, broken down
│   ├── ROADMAP.md         ← phased build plan & current status
│   ├── DATA_MODEL.md      ← how data is organized (Firebase sketch)
│   ├── ARCHITECTURE.md    ← tech decisions & trade-offs
│   └── CONTRIBUTING.md    ← how we work together (branches, workflow)
├── .github/               ← issue templates for tracking ideas & bugs
└── .gitignore
```

**Who owns what:** Pruthvi builds UI in `app/src/{screens,components,theme,types}`, jaikanth builds the backend in `app/src/{services,config}` + `backend/`, and both keep the shared data shapes in `app/src/models` in sync — that's the contract that lets you work in parallel.

**The three type layers** (don't collapse them): `models/` is the persisted Firestore contract and the source of truth, `types/ironsync.ts` holds the richer UI view-models, and `adapters/adapters.ts` maps between them.

---

## 🚀 Getting started

```bash
cd app
npm install
cp src/config/firebaseConfig.example.ts src/config/firebaseConfig.ts   # paste your Firebase values
npm start
```

Then scan the QR code with **Expo Go** on your phone.

> ⚠️ **Expo SDK is pinned to 54** — our phones' Expo Go can't go higher. Don't bump it without checking what Expo Go on both phones supports, or the app stops running on our devices.

`src/config/firebaseConfig.ts` is gitignored so each of us points at our own project. The web-config values in it aren't really secrets (they ship inside any client app anyway) — the actual protection is [backend/firestore.rules](backend/firestore.rules). What *is* a secret is `backend/seed/serviceAccount.json`; that must never be committed.

Also worth reading: **[docs/FEATURES.md](docs/FEATURES.md)** (what we're building), **[docs/ROADMAP.md](docs/ROADMAP.md)** (what's left), and **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** (branches & workflow).

---

## 👥 The team

Two friends who lift and wanted an app that actually fit how they train. 🤝

---

## 📄 License

Not chosen yet — see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#license) for the decision we need to make.
