import React, { useRef, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, StyleSheet, Modal, Text } from 'react-native';
import { Home, Dumbbell, Users, Utensils, Plus, X, Award, TrendingUp, User, Calendar } from 'lucide-react-native';
import { colors, radius, useTheme } from '../theme/colors';
import { Typography } from '../components/ui/Typography';
import MiniWorkoutBar from '../components/common/MiniWorkoutBar';

import HomeScreenContainer from '../screens/home/HomeScreenContainer';
import WorkoutsStack from './WorkoutsStack';
import NutritionScreen from '../screens/nutrition/NutritionScreen';
import ProgressAnalyticsScreen from '../screens/measurements/ProgressAnalyticsScreen';
import MeStack from './MeStack';
import CommunityStack from './CommunityStack';
import DuoStack from './DuoStack';
import GroupWorkoutLobbyScreen from '../screens/duo/GroupWorkoutLobbyScreen';
import GroupWorkoutScreen from '../screens/duo/GroupWorkoutScreen';
import NotificationsModal from '../screens/settings/NotificationsModal';
import StrengthPRScreen from '../screens/measurements/StrengthPRScreen';
import StreakScreen from '../screens/streak/StreakScreen';
import UserProfileScreen from '../screens/community/UserProfileScreen';
import AddFriendsScreen from '../screens/community/AddFriendsScreen';
import WorkoutDetailScreen from '../screens/workouts/WorkoutDetailScreen';
import ExerciseDetailScreen from '../screens/workouts/ExerciseDetailScreen';

export const navigationRef = createNavigationContainerRef<any>();

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();


function MainTabs() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: [styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }],
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
        }}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreenContainer} 
          options={{
            tabBarIcon: ({ color }) => <Home size={20} color={color} />,
          }}
        />
        <Tab.Screen 
          name="Workouts" 
          component={WorkoutsStack} 
          options={({ route }) => ({
            // Route name stays "Workouts" — navigate('Workouts') is used all over.
            tabBarLabel: 'Library',
            tabBarIcon: ({ color }) => <Dumbbell size={20} color={color} />,
            // The logger owns the whole screen while it's open.
            tabBarStyle:
              getFocusedRouteNameFromRoute(route) === 'LogWorkout'
                ? { display: 'none' }
                : [styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }],
          })}
        />

        <Tab.Screen
          name="Diet"
          component={NutritionScreen}
          options={{
            tabBarIcon: ({ color }) => <Utensils size={20} color={color} />,
          }}
        />

        <Tab.Screen
          name="Community"
          component={CommunityStack} 
          options={{
            tabBarIcon: ({ color }) => <Users size={20} color={color} />,
          }}
        />
        <Tab.Screen 
          name="Me" 
          component={MeStack} 
          options={{
            tabBarIcon: ({ color }) => <User size={20} color={color} />,
          }}
        />
      </Tab.Navigator>

      {/* Sits above the tab bar whenever a workout has been minimised. */}
      <MiniWorkoutBar />
    </View>
  );
}

export default function RootNavigator() {
  const { theme, themeMode } = useTheme();

  const navTheme = {
    ...(themeMode === 'light' ? DefaultTheme : DarkTheme),
    colors: {
      ...(themeMode === 'light' ? DefaultTheme.colors : DarkTheme.colors),
      background: theme.colors.background,
      card: theme.colors.surface,
      border: theme.colors.border,
      primary: theme.colors.primary,
      text: theme.colors.textPrimary,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTabs" component={MainTabs} />
        
        {/* Full-screen / Modal flow screens */}
        <RootStack.Screen name="Nutrition" component={NutritionScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="Progress" component={ProgressAnalyticsScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="Notifications" component={NotificationsModal} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="StrengthPR" component={StrengthPRScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="Streak" component={StreakScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="UserProfile" component={UserProfileScreen} />
        <RootStack.Screen name="AddFriends" component={AddFriendsScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
        <RootStack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />

        
        {/* Duo Workout Stack — single entry point, internal screens navigate within */}
        <RootStack.Screen name="DuoStack" component={DuoStack} options={{ presentation: 'modal' }} />
        
        {/* Group Workout Screens */}
        <RootStack.Screen name="GroupLobby" component={GroupWorkoutLobbyScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="GroupWorkout" component={GroupWorkoutScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(18, 21, 23, 0.95)',
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    elevation: 0,
    borderTopWidth: 1,
  },
  fabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
  },
  fabMenuContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#171b1f',
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 80,
    borderWidth: 1,
    borderColor: '#2c343c',
  },
  fabMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2c343c',
    marginBottom: 8,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: '#121517',
    marginBottom: 8,
  },
  fabPrimaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  fabPrimaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fabPrimaryTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '900',
  },
  fabPrimarySubtitle: {
    color: 'rgba(14, 16, 18, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  fabSecondaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fabSecondaryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  fabSecondarySubtitle: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  fabIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  }
});

