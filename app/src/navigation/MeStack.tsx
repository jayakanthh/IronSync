import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MeasurementType } from '../models/measurement';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MeasurementsScreen from '../screens/measurements/MeasurementsScreen';
import GoalSetupScreen from '../screens/measurements/GoalSetupScreen';
import GoalDetailsScreen from '../screens/measurements/GoalDetailsScreen';
import LogMeasurementScreen from '../screens/measurements/LogMeasurementScreen';
import MeasurementHistoryScreen from '../screens/measurements/MeasurementHistoryScreen';
import BodyProfileScreen from '../screens/measurements/BodyProfileScreen';
import WorkoutHistoryScreen from '../screens/workouts/WorkoutHistoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ThemesScreen from '../screens/settings/ThemesScreen';

export type MeStackParamList = {
  Profile: undefined;
  Measurements: undefined;
  GoalSetup:
    | { isProfileSetup?: boolean; prefill?: { startValue: number; targetValue: number; days: number } }
    | undefined;
  GoalDetails: { goalId: string };
  LogMeasurement: undefined;
  MeasurementHistory: { type: MeasurementType; unit: string };
  BodyProfile: undefined;
  WorkoutHistory: undefined;
  Settings: undefined;
  Themes: undefined;
};

const Stack = createNativeStackNavigator<MeStackParamList>();

export default function MeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Measurements" component={MeasurementsScreen} />
      <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
      <Stack.Screen name="GoalDetails" component={GoalDetailsScreen} />
      <Stack.Screen name="LogMeasurement" component={LogMeasurementScreen} />
      <Stack.Screen name="MeasurementHistory" component={MeasurementHistoryScreen} />
      <Stack.Screen name="BodyProfile" component={BodyProfileScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Themes" component={ThemesScreen} />
    </Stack.Navigator>
  );
}
