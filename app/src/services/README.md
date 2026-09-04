# services/ — jaikanth's world (backend access from the app)

This is the layer between the UI and Firebase. Screens call these functions; they never touch Firestore directly.

Firebase init now lives one level up in `src/config/`:
- `../config/firebase.ts` — initializes Firebase (auth with AsyncStorage persistence + Firestore).
- `../config/firebaseConfig.ts` — your project's config (gitignored; `cp src/config/firebaseConfig.example.ts src/config/firebaseConfig.ts`).

Each module exposes clean async functions (e.g. `logWorkout(userId, workout)`) that return the shared types from `../models`. That's the contract Pruthvi builds UI against.

### Layout
Import anything from the barrel: `import { logWorkout, getStreakBoard } from '../services';`

- `auth/auth.ts` — `signUp`, `signIn`, `signOutUser`, `currentUserId`, `onAuthChange`.
- `users/users.ts` — `createUserProfile`, `getUser`, `updateUser`, `setTrainingDays`.
- `users/profile.ts` — 🔒 measurements & health notes (owner-only data).
- `users/friends.ts`, `users/follow.ts` — friend requests/friendships and follows.
- `workouts/workouts.ts` — `logWorkout` (saves + detects est-1RM PRs + updates streak + syncs crew boards), `getWorkoutHistory`, `getWorkoutById`, `getPersonalRecords`, `getPreviousPerformance`, `getUserWorkoutsInRange`.
- `workouts/streaks.ts` — pure streak engine (scheduled-days model).
- `workouts/plans.ts` — training plans (create, adopt, set active).
- `exercises/exercises.ts` — library reads, search, custom exercises.
- `nutrition/nutrition.ts` — targets, food log, food search, custom/favourite/recent foods.
- `measurements/` — `measurements.ts` (logs + goals), `energy.ts` (TDEE/targets), `trend.ts`.
- `community/community.ts` — communities, members, challenges, posts, achievements.
- `duo/duoSession.ts` — live duo/group sessions (invites, ready-state, set streaming, summaries).
- `duo/groups.ts` — crews: `createGroup`, `joinGroup`, `getLeaderboard`, `getStreakBoard`, plus the board-sync helpers.
- `notifications/notification.ts` — in-app notification feed.
- Day helpers (`YYYY-MM-DD`) live in `../utils/formatting/dates.ts` and are re-exported from the barrel.

### Client-side vs Cloud Functions (Spark plan reality)
We're on the free **Spark** plan, which can't run Cloud Functions. So crew-board updates (streak board + PR leaderboards) currently run **client-side** inside transactions (`duo/groups.ts`). That works for small crews.

The production version lives in `../../backend/functions/` and needs the **Blaze** plan. It owns the boards authoritatively and sends the "someone beat your PR" **push** (which genuinely needs a server). When you enable Blaze and deploy it, **remove the client-side board-sync calls** in `workouts/workouts.ts` so boards aren't written twice.
