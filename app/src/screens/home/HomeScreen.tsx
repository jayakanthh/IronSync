import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch } from 'react-native';
import { useStartWorkoutScroll } from '../../components/common/StartWorkoutButton';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles,
  Flame,
  Clock,
  Play,
  ChevronRight,
  Footprints,
  Calendar,
  Users as UsersIcon,
  User as UserIcon,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme/colors';
import { SectionHeader } from '../../components/ui/index';
import type { UserProfile, TrainingBuddy } from '../../types/ironsync';
import { WorkoutHistoryItemWithCreator } from '../../data/mockData';

interface HomeScreenProps {
  user: UserProfile;
  buddies: TrainingBuddy[];
  history: WorkoutHistoryItemWithCreator[];
  onFindMatchClick: () => void;
  onStartTodayPlan: () => void;
  onSelectBuddyWorkout: (buddy: TrainingBuddy) => void;
  todayTitle?: string; // today's workout from the active plan
  todaySubtitle?: string;
  /** 'rest' when the default routine schedules nothing for today. */
  todayState?: 'workout' | 'rest' | 'none';
}


/**
 * Matches the reference layout: greeting, progress stats, today's plan
 * (image + gradient overlay), recent workouts.
 */
export default function HomeScreen({
  user,
  buddies,
  history,
  onFindMatchClick,
  onStartTodayPlan,
  onSelectBuddyWorkout,
  todayTitle,
  todaySubtitle,
  todayState,
}: HomeScreenProps) {
  const [showFriendsWorkouts, setShowFriendsWorkouts] = useState(true);
  // Drives the floating Start-New-Workout pill: it slides away as you scroll down.
  const scrollProps = useStartWorkoutScroll();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} {...scrollProps}>
      {/* Welcome Greeting */}
      <View>
        <Text style={styles.h1}>Welcome back, {user.name}</Text>
        <Text style={styles.subtext}>Ready to crush your goals today?</Text>
      </View>

      {/* YOUR PROGRESS Section */}
      <View style={styles.section}>
        <SectionHeader>YOUR PROGRESS</SectionHeader>

        {/* Steps Card */}
        <View style={styles.statCardRow}>
          <View>
            <Text style={styles.statLabel}>STEPS</Text>
            <Text style={styles.statValueLg}>{user.stepsToday.toLocaleString()}</Text>
          </View>
          <View style={styles.ringWrap}>
            <Svg width={44} height={44} viewBox="0 0 36 36" style={StyleSheet.absoluteFill}>
              <Path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                stroke={colors.border}
                strokeWidth={2.5}
                fill="none"
              />
              <Path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                stroke={colors.primary}
                strokeWidth={2.5}
                strokeDasharray="45, 100"
                strokeLinecap="round"
                fill="none"
                rotation={-90}
                origin="18, 18"
              />
            </Svg>
            <Footprints size={16} color={colors.primary} />
          </View>
        </View>

        {/* Calories & Activity Grid */}
        <View style={styles.gridRow}>
          <View style={[styles.statCard, styles.gridCell]}>
            <View style={styles.statCardHeader}>
              <Flame size={14} color={colors.textMuted} />
              <Text style={styles.statLabel}>CALORIES</Text>
            </View>
            <View style={styles.baselineRow}>
              <Text style={styles.statValueMd}>{user.caloriesToday}</Text>
              <Text style={styles.statUnit}>kcal</Text>
            </View>
          </View>
          <View style={[styles.statCard, styles.gridCell]}>
            <View style={styles.statCardHeader}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={styles.statLabel}>ACTIVITY</Text>
            </View>
            <Text style={styles.statValueMd}>1h 5m</Text>
          </View>
        </View>
      </View>

      {/* TODAY'S PLAN Section */}
      <View style={styles.section}>
        <SectionHeader>TODAY'S PLAN</SectionHeader>
        {todayState === 'rest' ? (
          // Nothing scheduled — don't dress a rest day up as a workout.
          <View style={styles.restCard}>
            <Text style={styles.restEmoji}>😌</Text>
            <Text style={styles.restTitle}>Take a rest today</Text>
            <Text style={styles.restSubtitle}>{todaySubtitle}</Text>
          </View>
        ) : (
        <TouchableOpacity style={styles.planCard} onPress={onStartTodayPlan} activeOpacity={0.9}>
          <View style={styles.planImageWrap}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop&q=80' }}
              style={styles.planImage}
            />
            <LinearGradient
              colors={[colors.surface, colors.surface + '99', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>Strength</Text>
            </View>
          </View>
          <View style={styles.planFooter}>
            <View>
              <Text style={styles.planTitle}>{todayTitle ?? 'Upper Body'}</Text>
              <Text style={styles.planMeta}>{todaySubtitle ?? '5 exercises • 52 min'}</Text>
            </View>
            <TouchableOpacity style={styles.playBtn} onPress={onStartTodayPlan} activeOpacity={0.85}>
              <Play size={16} color={colors.primaryDark} fill={colors.primaryDark} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        )}
      </View>

      {/* RECENT WORKOUTS Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <SectionHeader>RECENT WORKOUTS</SectionHeader>
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Friends</Text>
            <Switch
              value={showFriendsWorkouts}
              onValueChange={setShowFriendsWorkouts}
              trackColor={{ false: colors.surfaceAlt, true: colors.primary + '80' }}
              thumbColor={showFriendsWorkouts ? colors.primary : colors.textMuted}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          {((history || []).filter((item) => {
            if (showFriendsWorkouts) return true;
            return item.creatorName === user.name;
          })).map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <View style={styles.historyCardLeft}>
                  {/* Mode Badge */}
                  <View style={[
                    styles.modeBadge, 
                    item.mode === 'duo' ? styles.modeDuo : item.mode === 'group' ? styles.modeGroup : styles.modeSolo
                  ]}>
                    <Text style={[
                      styles.modeBadgeText,
                      item.mode === 'duo' ? styles.modeDuoText : item.mode === 'group' ? styles.modeGroupText : styles.modeSoloText
                    ]}>
                      {item.mode.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.creatorTag}>
                    By {item.creatorName === user.name ? 'You' : item.creatorName}
                    {item.partnerNames && item.partnerNames.length > 0 ? ` w/ ${item.partnerNames.join(', ')}` : ''}
                  </Text>
                </View>
                <Text style={styles.historyDate}>{item.displayDate}</Text>
              </View>

              <Text style={styles.historyTitle}>{item.title}</Text>
              
              {item.notes ? (
                <Text style={styles.historyNotes} numberOfLines={1}>"{item.notes}"</Text>
              ) : null}

              <View style={styles.historyStatsRow}>
                <View style={styles.historyStatCol}>
                  <Text style={styles.historyStatLabel}>DURATION</Text>
                  <Text style={styles.historyStatValue}>{item.durationMinutes}m</Text>
                </View>
                <View style={styles.historyStatCol}>
                  <Text style={styles.historyStatLabel}>SETS</Text>
                  <Text style={styles.historyStatValue}>{item.totalSets}</Text>
                </View>
                <View style={styles.historyStatCol}>
                  <Text style={styles.historyStatLabel}>VOLUME</Text>
                  <Text style={styles.historyStatValue}>{(item.volumeKg || 0).toLocaleString()} kg</Text>
                </View>
              </View>
            </View>
          ))}
          {((history || []).filter((item) => {
            if (showFriendsWorkouts) return true;
            return item.creatorName === user.name;
          })).length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recent workouts logged.</Text>
            </View>
          )}
        </View>
      </View>

      {/* TRAINING NOW Section */}
      {buddies.length > 0 && (
        <View style={[styles.section, { marginBottom: spacing.xl }]}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader>TRAINING NOW</SectionHeader>
            <Text style={styles.dots}>•••</Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            {buddies.map((buddy) => (
              <TouchableOpacity
                key={buddy.id}
                style={styles.buddyRow}
                onPress={() => onSelectBuddyWorkout(buddy)}
                activeOpacity={0.9}
              >
                <View style={styles.buddyLeft}>
                  <View>
                    <Image source={{ uri: buddy.avatar }} style={styles.buddyAvatar} />
                    <View style={styles.onlineDot} />
                  </View>
                  <View>
                    <Text style={styles.buddyName}>{buddy.name}</Text>
                    <Text style={styles.buddyActivity}>{buddy.activityTitle}</Text>
                  </View>
                </View>
                <View style={styles.buddyRight}>
                  {buddy.activityTitle.toLowerCase().includes('duo') && (
                    <View style={styles.liveDuoBadge}>
                      <Text style={styles.liveDuoText}>LIVE DUO</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: 12, gap: spacing.lg, paddingBottom: 150 },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtext: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  matchCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md + 4,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  matchGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  matchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary + '4D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  matchDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  matchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  matchBtnText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800', letterSpacing: 1 },


  section: { gap: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { color: colors.textMuted, fontSize: 12, letterSpacing: 1.5 },

  statCardRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statValueLg: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statValueMd: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statUnit: { color: colors.textMuted, fontSize: 12 },
  baselineRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },

  ringWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2b3339',
    backgroundColor: '#1e2327',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gridRow: { flexDirection: 'row', gap: spacing.sm },
  gridCell: { flex: 1 },
  statCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  planCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#14171a',
    overflow: 'hidden',
  },
  restCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#14171a',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  restEmoji: { fontSize: 28 },
  restTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  restSubtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  planImageWrap: { height: 112, width: '100%' },
  planImage: { width: '100%', height: '100%' },
  planBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(16,19,21,0.8)',
    borderWidth: 1,
    borderColor: '#3f3f3f99',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  planBadgeText: { color: '#e5e5e5', fontSize: 11, fontWeight: '500' },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.surface,
  },
  planTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  planMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buddyLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buddyAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  buddyName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  buddyActivity: { color: colors.textMuted, fontSize: 12 },
  buddyRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDuoBadge: {
    backgroundColor: colors.primary + '26',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveDuoText: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeSolo: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  modeSoloText: {
    color: '#9ca3af',
  },
  modeDuo: {
    backgroundColor: colors.primary + '26',
  },
  modeDuoText: {
    color: colors.primary,
  },
  modeGroup: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  modeGroupText: {
    color: '#06b6d4',
  },
  creatorTag: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  historyDate: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  historyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  historyNotes: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -4,
  },
  historyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  historyStatCol: {
    alignItems: 'flex-start',
  },
  historyStatLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historyStatValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});