import React, { useEffect, useState, useCallback } from 'react';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import HomeScreen from './HomeScreen';
import { initialUserProfile } from '../../data/mockData';
import { useCurrentUser } from '../../context/CurrentUser';
import { userToProfile } from '../../adapters/adapters';
import { startWorkout } from '../../utils/startWorkout';
import StartWorkoutButton, { StartWorkoutScrollProvider } from '../../components/common/StartWorkoutButton';
import { TopHeader } from '../../components/common/TopHeader';
import {
  getPlan,
  getMyPlans,
  getFoodLog,
  sumDay,
  getWorkoutHistory,
  getCommunityWorkouts,
  getTrainingNowMembers,
  todayISO,
  subscribeToNotifications,
} from '../../services/index';
import type { UserProfile, TrainingBuddy } from '../../types/ironsync';
import type { AppNotification } from '../../models/index';
import { useTheme } from '../../theme/colors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HomeScreenContainer({ navigation }: { navigation: NavigationProp<any> }) {
  const { theme } = useTheme();
  const { profile } = useCurrentUser();
  const [today, setToday] = useState<
    { title: string; subtitle: string; state: 'workout' | 'rest' | 'none' } | undefined
  >(undefined);
  const [calories, setCalories] = useState(0);
  const [workoutsList, setWorkoutsList] = useState<any[]>([]);
  const [trainingNowList, setTrainingNowList] = useState<TrainingBuddy[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 1. Listen to real-time notifications count
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToNotifications(profile.id, (notifs: AppNotification[]) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadNotifsCount(unread);
    });
    return () => unsub();
  }, [profile?.id]);

  // 2. Fetch today's plan, calories, workouts, and training now buddies
  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Plan
      let plan = profile.activePlanId ? await getPlan(profile.activePlanId) : null;
      if (!plan) plan = (await getMyPlans(profile.id))[0] ?? null;
      if (plan) {
        const todayLabel = DAY_LABELS[new Date().getDay()];
        const day = plan.days.find((d) => d.label === todayLabel);
        setToday(
          day
            ? {
                title: `${plan.name} · ${todayLabel}`,
                subtitle: `${day.exercises.length} exercises`,
                state: 'workout',
              }
            // Your default routine schedules nothing for today.
            : { title: 'Rest day', subtitle: `${plan.name} has nothing scheduled today`, state: 'rest' },
        );
      } else {
        setToday({ title: 'No plan yet', subtitle: 'Create one in Workouts →', state: 'none' });
      }

      // Calories Today
      const foodEntries = await getFoodLog(profile.id, todayISO());
      const dailyTotals = sumDay(foodEntries);
      setCalories(dailyTotals.dailyCalories);

      // User's own workout history
      const myWorkouts = await getWorkoutHistory(profile.id, 10);
      
      // Community shared workouts (respecting visibility rules)
      const communityWorkoutsList: any[] = [];
      if (profile.communityIds && profile.communityIds.length > 0) {
        const results = await Promise.all(
          profile.communityIds.map((cid) => getCommunityWorkouts(cid, 10))
        );
        results.flat().forEach((post) => {
          // Check if workout is not private and author is not already me (to avoid duplication)
          if (post.authorId !== profile.id) {
            communityWorkoutsList.push({
              id: post.id,
              creatorName: post.authorName,
              title: post.workoutName || 'Shared Workout',
              notes: '',
              mode: post.sessionType || 'solo',
              durationMinutes: post.durationMinutes || 45,
              totalSets: post.prCount || 0, // Fallback placeholder logic for sets
              volumeKg: post.totalVolumeKg || 0,
              displayDate: new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
              createdAt: post.createdAt,
              partnerNames: post.partnerNames || [],
            });
          }
        });
      }

      // Map user's workouts to the UI representation
      const mappedMyWorkouts = myWorkouts.map((w) => ({
        id: w.id,
        creatorName: profile.displayName,
        title: w.planName || 'Workout Session',
        notes: w.notes || '',
        mode: w.sessionId ? 'duo' : 'solo',
        durationMinutes: w.durationMinutes || 45,
        totalSets: w.entries.reduce((sum, entry) => sum + entry.sets.length, 0),
        volumeKg: w.totalVolumeKg || 0,
        displayDate: new Date(w.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        createdAt: w.createdAt,
        partnerNames: [],
      }));

      // Combine and sort by date descending
      const combined = [...mappedMyWorkouts, ...communityWorkoutsList].sort(
        (a, b) => b.createdAt - a.createdAt
      );
      setWorkoutsList(combined);

      // Training Now buddies from joined communities
      const trainingNowMap = new Map<string, TrainingBuddy>();
      if (profile.communityIds && profile.communityIds.length > 0) {
        const membersList = await Promise.all(
          profile.communityIds.map((cid) => getTrainingNowMembers(cid))
        );
        membersList.flat().forEach((member) => {
          if (member.userId !== profile.id && member.isTrainingNow) {
            trainingNowMap.set(member.userId, {
              id: member.userId,
              name: member.displayName,
              avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', // placeholder avatar
              status: 'in-workout',
              activityTitle: member.currentActivity || 'Training Now',
              streakDays: 0,
            });
          }
        });
      }
      setTrainingNowList(Array.from(trainingNowMap.values()));
    } catch (e) {
      console.error('Error loading home data:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  // Construct UserProfile for the view
  const user: UserProfile = {
    ...initialUserProfile,
    id: profile.id,
    name: profile.displayName,
    email: profile.email,
    currentWeight: profile.weightKg || 75,
    caloriesToday: calories,
  };

  /**
   * Today's card opens the plan preview (what you're about to do) rather than
   * dropping straight into the logger. With no plan set there's nothing to
   * preview, so fall back to starting a free workout.
   */
  const openTodaysPlan = () => {
    const planId = profile?.activePlanId;
    if (!planId) return startWorkoutFromHome();
    navigation.navigate('Workouts', {
      screen: 'RoutinePreview',
      params: { planId },
      initial: false,
    });
  };

  const startWorkoutFromHome = () =>
    // initial: false keeps WorkoutsHome under the logger, so closing it lands
    // on the Library instead of an empty stack.
    startWorkout(profile, (params) =>
      navigation.navigate('Workouts', { screen: 'LogWorkout', params, initial: false }),
    );

  return (
    <StartWorkoutScrollProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <TopHeader
          user={user}
          unreadNotifsCount={unreadNotifsCount}
          // Profile is a screen inside the Me tab's stack, not a route the
          // Home tab can reach directly.
          onAvatarPress={() => navigation.navigate('Me', { screen: 'Profile' })}
          onNotificationPress={() => navigation.navigate('Notifications')}
          onOpenStreak={() => navigation.navigate('Streak')}
          onOpenStrengthPR={() => navigation.navigate('StrengthPR')}
        />
        <HomeScreen
          user={user}
          buddies={trainingNowList}
          history={workoutsList}
          todayTitle={today?.title}
          todaySubtitle={today?.subtitle}
          todayState={today?.state}
          onFindMatchClick={() => navigation.navigate('Workouts')} // Fallback: Route to routines
          onStartTodayPlan={openTodaysPlan}
          onSelectBuddyWorkout={(buddy) => {
            // If buddy is training, creator invites B or joins
            navigation.navigate('Community');
          }}
        />
        <StartWorkoutButton onPress={startWorkoutFromHome} />
      </View>
    </StartWorkoutScrollProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
