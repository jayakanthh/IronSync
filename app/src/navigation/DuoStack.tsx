import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DuoInviteScreen from '../screens/duo/DuoInviteScreen';
import DuoLobbyScreen from '../screens/duo/DuoLobbyScreen';
import LogWorkoutScreen from '../screens/workouts/LogWorkoutScreen';
import DuoCompleteScreen from '../screens/duo/DuoCompleteScreen';

const Stack = createNativeStackNavigator();

export default function DuoStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="DuoLobby" component={DuoLobbyScreen} />
      <Stack.Screen name="DuoInvite" component={DuoInviteScreen} />
      <Stack.Screen name="DuoWorkout" component={LogWorkoutScreen} />
      <Stack.Screen name="DuoComplete" component={DuoCompleteScreen} />
    </Stack.Navigator>
  );
}
