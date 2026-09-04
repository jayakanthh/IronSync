# IronSync — Roadmap

We build in phases so there's always something working we can actually use. Each phase should be usable on its own before we move to the next. Ship small, use it ourselves, then expand.

The golden rule: **the fastest way to kill this project is to try to build everything at once.** Get the daily loop working first.

**Status (Sep 2026):** Phases 0–3 are essentially shipped and running on our phones. Phase 4 is partly done, and we picked up a few things that were never on this list — see [Beyond the plan](#-beyond-the-plan) at the bottom. Unticked boxes below are what's genuinely still open.

---

## 🎯 Phase 0 — Foundations (setup)

Before any feature code.

- [x] Decide the frontend stack (see [ARCHITECTURE.md](ARCHITECTURE.md)) — mobile vs web. → React Native + Expo (SDK 54, pinned).
- [x] Create the Firebase project and add both of us as members. → `ironsync-d58ed`, Spark plan.
- [x] Get a "hello world" build running on both our machines.
- [x] Agree on how we split work & branch (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## 🟢 Phase 1 — MVP: the daily loop

**Goal:** open the app, log today's workout, see your streak go up. If this feels good to use, we're onto something.

- [x] User profile (name, age, height, weight, goal)
- [x] Body measurements + health notes
- [x] Exercise library (seeded from free-exercise-db, with search + custom exercises)
- [x] Log a workout (exercises, sets, reps, weight) — `LogWorkoutScreen`, incl. warmup/drop/superset set types
- [x] Workout history by date
- [x] Streak counter (scheduled-days model, `workouts/streaks.ts`)

**Definition of done:** both of us can log our real workouts for a week and watch our streaks. ✅ **Done.**

## 🔵 Phase 2 — PRs & the crew

**Goal:** the social hook — friendly competition.

- [x] Auto-detect and store PRs per exercise (estimated 1RM, in `logWorkout`)
- [x] Create/join a friend group (crews) + 1:1 friends and follows
- [x] PR leaderboard across the crew (client-side sync — Spark plan, see below)
- [x] "Someone beat your PR" notification — **in-app only.** The feed works; the **push** half needs Blaze.
- [x] Follow a training plan (create, adopt a public plan, set a default that drives today's workout)
- [ ] Streak reminders — needs scheduled push, so it's blocked on Blaze too.

**Definition of done:** beating a friend's PR sends them a notification, and we can both see the leaderboard. ✅ **Done in-app**; push is blocked on the Blaze upgrade.

> ⚠️ **The Blaze cliff.** Cloud Functions can't deploy on the free Spark plan, so board updates run client-side in `app/src/services/duo/groups.ts` and nothing sends a real push (`expo-notifications` isn't even installed yet). The server-side version is written and waiting in `backend/functions/`. When we upgrade: deploy it, install `expo-notifications` + store `expoPushToken` on the profile, **remove the client-side board-sync calls** in `workouts/workouts.ts`, and tighten the board `write` rules to `false`.

## 🟡 Phase 3 — Nutrition

**Goal:** track eating alongside training.

- [x] Set calorie & macro targets from a goal (cut/maintain/bulk) — first-open goal setup + `measurements/energy.ts`
- [x] Log food & count calories against target
- [x] Macro tracking (protein/carbs/fat — plus fibre, with macro rings)
- [x] Food log history (7-day and month progress views)
- [x] Progress & measurement charts (`ProgressAnalyticsScreen`, measurement graphs)

**Definition of done:** we can hit a daily calorie target and see the day's totals. ✅ **Done.**

## ⚪ Phase 4 — Supplements & polish

**Goal:** the extras that make it feel complete.

- [ ] Supplement results sharing in the crew — backend is done (`postSupplement` / `getSupplementPosts`), **no UI yet**.
- [x] Activity feed & reactions (community posts with likes + celebrates)
- [x] Milestones / badges (community achievements)
- [ ] Weekly recap
- [x] Food database — `foods` collection with search, custom foods, favourites & recents.
- [ ] Barcode scan
- [ ] Progress photos

---

## 🎁 Beyond the plan

Things we built that were never on the roadmap — worth writing down so they don't look accidental:

- **Duo & group live sessions** — real-time shared workouts: invites, ready-state, heartbeats, live set-by-set streaming between participants, rest timers, and a completion summary (`services/duo/duoSession.ts` + `screens/duo/`). Easily the most ambitious piece of the app.
- **Communities** — bigger-than-a-crew groups with admins, join requests, challenges with per-user progress, posts and achievements.
- **Theme system** — 7 themes (Signature, Classic Black/White, Iron Green, Electric Blue, Cyber Purple, Batman), each with light + dark variants.
- **Muscle heatmap** — training volume painted onto a body silhouette, plus per-exercise history detail.

## 📌 How we track work

Day-to-day tasks live in **GitHub Issues** (use the templates in `.github/ISSUE_TEMPLATE/`). This roadmap is the big picture; issues are the actual to-dos. Consider a GitHub Project board once we have more than a handful of open issues.
