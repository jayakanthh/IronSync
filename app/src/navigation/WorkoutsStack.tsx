import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutsScreen from '../screens/workouts/WorkoutsScreen';
import PlanBuilderScreen from '../screens/workouts/PlanBuilderScreen';
import AdoptPlanScreen from '../screens/workouts/AdoptPlanScreen';
import LogWorkoutScreen from '../screens/workouts/LogWorkoutScreen';
import RoutinePreviewScreen from '../screens/workouts/RoutinePreviewScreen';
import ProgressAnalyticsScreen from '../screens/measurements/ProgressAnalyticsScreen';

const Stack = createNativeStackNavigator();

/** Workouts tab as a stack so "Create"/"Adopt" can push full-screen flows. */
export default function WorkoutsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutsHome" component={WorkoutsScreen} />
      <Stack.Screen
        name="PlanBuilder"
        component={PlanBuilderScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="AdoptPlan"
        component={AdoptPlanScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="RoutinePreview" component={RoutinePreviewScreen} />
      <Stack.Screen
        name="LogWorkout"
        component={LogWorkoutScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ProgressAnalytics"
        component={ProgressAnalyticsScreen}
      />
    </Stack.Navigator>
  );
}
