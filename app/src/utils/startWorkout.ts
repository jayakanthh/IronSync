import { getPlan, getMyPlans, getExercisesByIds } from '../services/index';
import type { User } from '../models/index';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface LogWorkoutParams {
  exercises: { exerciseId: string; name: string; targetSets: number; targetReps: number }[];
  sourceLabel: string;
}

/**
 * Build LogWorkout params from the user's default (active) plan. Picks the day
 * whose label matches today's weekday, else the first day. Returns null if the
 * user has no plan to follow.
 */
async function buildDefaultPlanParams(profile: User): Promise<LogWorkoutParams | null> {
  let plan = profile.activePlanId ? await getPlan(profile.activePlanId) : null;
  if (!plan) {
    const mine = await getMyPlans(profile.id);
    plan = mine[0] ?? null;
  }
  if (!plan || !plan.days.length) return null;

  const todayLabel = DAY_LABELS[new Date().getDay()];
  const day = plan.days.find((d) => d.label === todayLabel) ?? plan.days[0];
  const ids = day.exercises.map((e) => e.exerciseId);
  const exList = await getExercisesByIds(ids);
  const nameById = new Map(exList.map((e) => [e.id, e.name]));

  return {
    exercises: day.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: nameById.get(e.exerciseId) ?? e.exerciseId,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
    })),
    sourceLabel: plan.name,
  };
}

const FREE_WORKOUT: LogWorkoutParams = { exercises: [], sourceLabel: 'Free Workout' };

/**
 * Start a workout straight away: from the user's default (active) plan if they
 * have one, otherwise a blank free workout. `goToLog` navigates to LogWorkout
 * (each screen supplies its own, since the route lives in the Workouts stack).
 */
export async function startWorkout(
  profile: User | null | undefined,
  goToLog: (params: LogWorkoutParams) => void,
): Promise<void> {
  if (!profile) {
    goToLog(FREE_WORKOUT);
    return;
  }
  try {
    const params = await buildDefaultPlanParams(profile);
    goToLog(params ?? FREE_WORKOUT);
  } catch {
    goToLog(FREE_WORKOUT);
  }
}
