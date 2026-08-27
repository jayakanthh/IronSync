import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { colors, spacing, radius } from '../../theme/colors';
import { ChevronRight } from 'lucide-react-native';
import MuscleHeatmapCard from '../overview/MuscleHeatmapCard';
import RecentExercisesCard from '../overview/RecentExercisesCard';

import type { Community, CommunityMember, CommunityChallenge, CommunityAchievement, Exercise } from '../../models/index';
import { 
  getTrainingNowMembers, 
  getCommunityChallenge, 
  getCommunityAchievements,
  getCommunityWorkouts
} from '../../services/community/community';
import { getWorkoutById } from '../../services/workouts/workouts';
import { getExercisesByIds } from '../../services/exercises/exercises';
import { useCurrentUser } from '../../context/CurrentUser';
import { currentUserId } from '../../services/index';
import { getAvatarBg } from '../../utils/formatting/avatarColors';

interface Props {
  community: Community;
  onTabChange: (tab: string) => void;
}

function isMachineExercise(exercise: Exercise): boolean {
  if (!exercise) return false;
  const name = exercise.name.toLowerCase();
  const eq = (exercise.equipment || '').toLowerCase();
  
  if (eq === 'cable' || eq === 'machine' || eq === 'smith machine' || eq === 'pulley') {
    return true;
  }
  
  // If it's explicitly labeled as barbell or dumbbell, it's NOT a machine.
  if (eq === 'barbell' || eq === 'dumbbell' || eq === 'kettlebell' || eq === 'body weight') {
    return false;
  }
  
  const machineKeywords = [
    'machine', 'cable', 'smith', 'pulldown', 'pec deck', 'peck deck', 
    'leg extension', 'leg curl', 'hack squat', 'assisted pull', 'crossover'
  ];
  
  return machineKeywords.some(keyword => name.includes(keyword));
}

export default function OverviewTab({ community, onTabChange }: Props) {
  const navigation = useNavigation<any>();
  const { profile } = useCurrentUser();
  const userId = profile?.id || currentUserId() || '';
  const [loading, setLoading] = useState(true);
  const [trainingNow, setTrainingNow] = useState<CommunityMember[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CommunityChallenge | null>(null);
  const [achievements, setAchievements] = useState<CommunityAchievement[]>([]);
  
  // Insights state
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [hourlyPopularity, setHourlyPopularity] = useState<number[]>(new Array(24).fill(0));
  const [maxCount, setMaxCount] = useState<number>(0);
  const [peakTime, setPeakTime] = useState<string | null>(null);
  const [topMachines, setTopMachines] = useState<{name: string, count: number, pct: number}[]>([]);
  const [topBodyParts, setTopBodyParts] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [members, challenges, achs] = await Promise.all([
          getTrainingNowMembers(community.id),
          getCommunityChallenge(community.id),
          getCommunityAchievements(community.id, 3)
        ]);
        setTrainingNow(members);
        setActiveChallenge(challenges.length > 0 ? challenges[0] : null);
        setAchievements(achs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [community.id]);

  useEffect(() => {
    let active = true;
    async function loadInsights() {
      try {
        setInsightsLoading(true);
        // Fetch up to 100 posts to get a meaningful 30-day window
        const posts = await getCommunityWorkouts(community.id, 100);
        if (!active) return;

        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recentPosts = posts.filter(post => post.createdAt >= thirtyDaysAgo);
        
        if (recentPosts.length < 3) {
          setHourlyPopularity(new Array(24).fill(0));
          setMaxCount(0);
          setPeakTime(null);
          setTopMachines([]);
          setTopBodyParts([]);
          setInsightsLoading(false);
          return;
        }

        // Fetch workout documents in parallel to avoid N+1 query loop
        const workoutsResults = await Promise.all(
          recentPosts.map(post => 
            getWorkoutById(post.authorId, post.workoutId)
              .catch(() => null)
          )
        );
        if (!active) return;

        const workouts = workoutsResults.filter((w): w is NonNullable<typeof w> => w !== null);
        if (workouts.length < 3) {
          setHourlyPopularity(new Array(24).fill(0));
          setMaxCount(0);
          setPeakTime(null);
          setTopMachines([]);
          setTopBodyParts([]);
          setInsightsLoading(false);
          return;
        }

        // 1. Calculate Busiest Hours
        const hourlyCounts = new Array(24).fill(0);
        workouts.forEach(w => {
          const date = new Date(w.createdAt || Date.now());
          hourlyCounts[date.getHours()]++;
        });

        const peakMaxCount = Math.max(...hourlyCounts);

        // Find busiest 2-hour consecutive block
        let maxTwoHourSum = -1;
        let peakHourStart = 18; // Default to 6 PM
        for (let i = 0; i < 24; i++) {
          const sum = hourlyCounts[i] + hourlyCounts[(i + 1) % 24];
          if (sum > maxTwoHourSum) {
            maxTwoHourSum = sum;
            peakHourStart = i;
          }
        }

        const formatHour = (h: number) => {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hr = h % 12 || 12;
          return `${hr} ${ampm}`;
        };
        const peakRangeText = `${formatHour(peakHourStart)} – ${formatHour((peakHourStart + 2) % 24)}`;

        setHourlyPopularity(hourlyCounts);
        setMaxCount(peakMaxCount);
        setPeakTime(peakRangeText);

        // 2. Fetch exercise metadata in batch to prevent N+1 query loop
        const uniqueExIds = new Set<string>();
        workouts.forEach(w => w.entries.forEach(e => uniqueExIds.add(e.exerciseId)));

        const exList = await getExercisesByIds(Array.from(uniqueExIds));
        if (!active) return;
        const exMap = new Map(exList.map(e => [e.id, e]));

        // 3. Calculate Most Used Machines and Most Trained Body Parts
        const machineCounts: Record<string, number> = {};
        const muscleCounts: Record<string, number> = {};
        let totalMachinesCount = 0;

        workouts.forEach(w => {
          w.entries.forEach(e => {
            const exercise = exMap.get(e.exerciseId);
            if (exercise) {
              // Muscle groups
              if (exercise.muscleGroup) {
                muscleCounts[exercise.muscleGroup] = (muscleCounts[exercise.muscleGroup] || 0) + 1;
              }
              // Machine exercise verification
              if (isMachineExercise(exercise)) {
                machineCounts[exercise.name] = (machineCounts[exercise.name] || 0) + 1;
                totalMachinesCount++;
              }
            }
          });
        });

        // Map and rank top 3 machines
        const sortedMachines = Object.entries(machineCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => ({
            name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
            count,
            pct: totalMachinesCount > 0 ? Math.round((count / Math.max(1, totalMachinesCount)) * 100) : 0
          }));
        setTopMachines(sortedMachines);

        // Rank top 3 muscles
        const sortedMuscles = Object.entries(muscleCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
        setTopBodyParts(sortedMuscles);

      } catch (err) {
        console.error(err);
      } finally {
        if (active) setInsightsLoading(false);
      }
    }

    loadInsights();
    return () => {
      active = false;
    };
  }, [community.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* TRAINING NOW */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Typography variant="bodyBold" style={styles.cardTitle}>TRAINING NOW</Typography>
        </View>
        <Typography variant="body" color={colors.textMuted} style={styles.subtitle}>
          {trainingNow.length} people are training
        </Typography>

        {trainingNow.length === 0 ? (
          <Typography variant="caption" color={colors.textMuted} style={styles.empty}>
            No one is training right now.
          </Typography>
        ) : (
          <View style={styles.list}>
            {trainingNow.slice(0, 3).map(m => (
              <TouchableOpacity 
                key={m.userId} 
                style={styles.row}
                onPress={() => navigation.navigate('UserProfile', { userId: m.userId })}
              >
                <View style={[styles.avatar, { backgroundColor: getAvatarBg(m.displayName) }]}>
                  <Typography style={styles.avatarText}>{m.displayName.slice(0, 2).toUpperCase()}</Typography>
                </View>
                <View style={styles.rowContent}>
                  <Typography variant="bodyBold">{m.displayName}</Typography>
                  <Typography variant="caption" color={colors.textMuted}>
                    {m.currentActivity || 'Working out'}
                  </Typography>
                </View>
                <View style={styles.dot} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <TouchableOpacity style={styles.viewAll} onPress={() => onTabChange('people')}>
          <Typography variant="caption" color={colors.primary}>View all</Typography>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
            </Card>

      {/* MUSCLES WORKED */}
      <MuscleHeatmapCard userId={userId} />

      {/* RECENT EXERCISES */}
      <RecentExercisesCard userId={userId} />

     

      {/* COMMUNITY INSIGHTS */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Typography variant="bodyBold" style={styles.cardTitle}>COMMUNITY INSIGHTS</Typography>
        </View>
        <Typography variant="caption" color={colors.textMuted} style={styles.subtitle}>
          Based on recent community activity
        </Typography>
        
        {insightsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
        ) : !peakTime ? (
          <Typography variant="caption" color={colors.textMuted} style={styles.empty}>
            Not enough activity yet.
          </Typography>
        ) : (
          <View style={styles.insights}>
            {/* BUSIEST HOURS */}
            <View style={styles.insightBlock}>
              <Typography variant="caption" style={styles.insightBlockTitle}>BUSIEST HOURS</Typography>
              
              <View style={styles.chartContainer}>
                <View style={styles.barsRow}>
                  {hourlyPopularity.map((count, hour) => {
                    const isMax = maxCount > 0 && count === maxCount;
                    const heightPercent = maxCount > 0 ? (count / maxCount) : 0;
                    const barHeight = Math.max(4, heightPercent * 40); // 4px min, 40px max
                    
                    let barColor = colors.surfaceAlt; // Quiet
                    if (count > 0) {
                      if (isMax) {
                        barColor = colors.primary; // Busiest (primary)
                      } else if (heightPercent >= 0.6) {
                        barColor = colors.primary + 'b3'; // Busy (primary with opacity)
                      } else if (heightPercent >= 0.2) {
                        barColor = colors.textMuted; // Normal
                      } else {
                        barColor = colors.surfaceAlt; // Quiet but active
                      }
                    }

                    return (
                      <View key={hour} style={styles.barColumn}>
                        <View style={[styles.bar, { height: barHeight, backgroundColor: barColor }]} />
                      </View>
                    );
                  })}
                </View>
                <View style={styles.labelsRow}>
                  <Typography variant="label" style={styles.chartLabel}>12 AM</Typography>
                  <Typography variant="label" style={styles.chartLabel}>6 AM</Typography>
                  <Typography variant="label" style={styles.chartLabel}>12 PM</Typography>
                  <Typography variant="label" style={styles.chartLabel}>6 PM</Typography>
                  <Typography variant="label" style={styles.chartLabel}>11 PM</Typography>
                </View>
              </View>

              <View style={styles.busiestLabelRow}>
                <Typography variant="caption" color={colors.textMuted}>Usually busiest</Typography>
                <Typography variant="bodyBold" style={styles.busiestTimeText}>{peakTime}</Typography>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* MOST USED MACHINES */}
            <View style={styles.insightBlock}>
              <Typography variant="caption" style={styles.insightBlockTitle}>MOST USED MACHINES</Typography>
              {topMachines.length > 0 ? topMachines.map((m, i) => (
                <View key={i} style={styles.machineItemRow}>
                  <View style={styles.machineInfo}>
                    <Typography variant="bodyBold" style={styles.machineName} numberOfLines={1}>
                      {i + 1}. {m.name}
                    </Typography>
                    <Typography variant="caption" color={colors.textMuted}>
                      {m.count} {m.count === 1 ? 'log' : 'logs'}
                    </Typography>
                  </View>
                  <View style={styles.eqBarBg}>
                    <View style={[styles.eqBarFill, { width: `${m.pct}%` }]} />
                  </View>
                </View>
              )) : (
                <Typography variant="caption" color={colors.textMuted}>No machine data yet.</Typography>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* MOST TRAINED BODY PARTS */}
            <View style={styles.insightBlock}>
              <Typography variant="caption" style={styles.insightBlockTitle}>MOST TRAINED BODY PARTS</Typography>
              <Typography variant="bodyBold" style={styles.bodyPartsText}>
                {topBodyParts.join(' · ') || 'Not enough data'}
              </Typography>
            </View>
          </View>
        )}
      </Card>

      {/* ACTIVE CHALLENGE */}
      <Card style={styles.card}>
        <Typography variant="bodyBold" style={styles.cardTitle}>ACTIVE CHALLENGE</Typography>
        
        {!activeChallenge ? (
          <Typography variant="caption" color={colors.textMuted} style={styles.empty}>
            No active challenges.
          </Typography>
        ) : (
          <View style={styles.challengeBlock}>
            <Typography variant="bodyBold" style={{ textTransform: 'uppercase' }}>
              {activeChallenge.name}
            </Typography>
            <View style={styles.challengeMeta}>
              <Typography variant="caption" color={colors.textMuted}>
                {activeChallenge.participantIds.length} participants
              </Typography>
            </View>
          </View>
        )}
        
        <TouchableOpacity style={styles.viewAll} onPress={() => onTabChange('challenges')}>
          <Typography variant="caption" color={colors.primary}>View Challenge</Typography>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </Card>

      {/* RECENT ACHIEVEMENTS */}
      <Card style={styles.card}>
        <Typography variant="bodyBold" style={styles.cardTitle}>RECENT ACHIEVEMENTS</Typography>
        
        {achievements.length === 0 ? (
          <Typography variant="caption" color={colors.textMuted} style={styles.empty}>
            No achievements yet.
          </Typography>
        ) : (
          <View style={styles.list}>
            {achievements.map(ach => (
              <View key={ach.id} style={styles.achRow}>
                <Typography variant="bodyBold" style={{ width: 80 }} numberOfLines={1}>
                  {ach.displayName}
                </Typography>
                <Typography variant="caption" style={{ flex: 1 }} color={colors.textMuted}>
                  {ach.type.replace('_', ' ').toUpperCase()}
                </Typography>
                <Typography variant="bodyBold">
                  {ach.value} {ach.type.includes('pr') ? 'kg' : ''}
                </Typography>
              </View>
            ))}
          </View>
        )}
        
        <TouchableOpacity style={styles.viewAll} onPress={() => onTabChange('achievements')}>
          <Typography variant="caption" color={colors.primary}>View all</Typography>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  empty: {
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rowContent: {
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  insights: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  insightBlock: {
    gap: 4,
  },
  insightBlockTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chartContainer: {
    backgroundColor: '#0b0d0f',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 48,
    justifyContent: 'space-between',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  chartLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  busiestLabelRow: {
    marginTop: spacing.sm,
    gap: 2,
  },
  busiestTimeText: {
    color: colors.primary,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  machineItemRow: {
    marginTop: spacing.xs,
    gap: 4,
  },
  machineInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  machineName: {
    color: colors.text,
    fontSize: 13,
  },
  eqBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  eqBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  bodyPartsText: {
    color: colors.text,
    fontSize: 15,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  challengeBlock: {
    marginTop: spacing.sm,
  },
  challengeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  achRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  }
});
