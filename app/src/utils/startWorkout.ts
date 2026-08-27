import { Alert } from 'react-native';
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

/**
 * Ask the user how they want to train — a blank Free Workout, or their default
 * plan preloaded — then hand the LogWorkout params to `goToLog` (each screen
 * supplies its own navigation, since the route lives in the Workouts stack).
 */
export function promptStartWorkout(
  profile: User | null | undefined,
  goToLog: (params: LogWorkoutParams) => void,
): void {
  Alert.alert('Start Workout', 'How do you want to train?', [
    {
      text: 'Free Workout',
      onPress: () => goToLog({ exercises: [], sourceLabel: 'Free Workout' }),
    },
    {
      text: 'Follow Default Plan',
      onPress: async () => {
        if (!profile) return;
        try {
          const params = await buildDefaultPlanParams(profile);
          if (!params) {
            Alert.alert(
              'No plan to follow',
              'Create a routine and set it as your default (tap the star on a routine in Workouts) first.',
            );
            return;
          }
          goToLog(params);
        } catch {
          Alert.alert('Error', 'Could not load your plan. Please try again.');
        }
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
