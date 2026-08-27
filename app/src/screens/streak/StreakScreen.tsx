import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Flame, Trophy, ChevronLeft, ChevronRight, Users } from 'lucide-react-native';
import { useTheme } from '../../theme/colors';
import { useCurrentUser } from '../../context/CurrentUser';
import {
  effectiveCurrentStreak,
  getUserWorkoutsInRange,
  getMyGroups,
  getStreakBoard,
  todayISO,
} from '../../services/index';
import type { StreakBoardEntry } from '../../models/index';

type Tab = 'you' | 'friends';
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Local YYYY-MM-DD for a Date (avoids UTC off-by-one from toISOString). */
function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Streak tracker — how long the current streak is, the personal best, and a
 * calendar of trained days ("You"), plus a crew streak leaderboard ("Friends").
 * Streak = consecutive SCHEDULED training days completed (see streaks.ts).
 */
export default function StreakScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { profile } = useCurrentUser();

  const [tab, setTab] = useState<Tab>('you');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // month: 0-11
  });
  const [trainedDates, setTrainedDates] = useState<Set<string>>(new Set());
  const [loadingCal, setLoadingCal] = useState(true);
  const [board, setBoard] = useState<StreakBoardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);

  const trainingDays = profile?.trainingDays ?? [];
  const currentStreak = profile
    ? effectiveCurrentStreak(
        {
          currentStreak: profile.currentStreak ?? 0,
          longestStreak: profile.longestStreak ?? 0,
          lastTrainedDate: profile.lastTrainedDate,
        },
        trainingDays,
        todayISO(),
      )
    : 0;
  const longestStreak = Math.max(profile?.longestStreak ?? 0, currentStreak);

  // Trained days for the visible month → highlight on the calendar.
  const loadCalendar = useCallback(async () => {
    if (!profile) return;
    setLoadingCal(true);
    try {
      const start = new Date(monthCursor.year, monthCursor.month, 1).getTime();
      const end = new Date(monthCursor.year, monthCursor.month + 1, 0, 23, 59, 59, 999).getTime();
      const workouts = await getUserWorkoutsInRange(profile.id, start, end);
      setTrainedDates(new Set(workouts.map((w) => w.date)));
    } catch {
      setTrainedDates(new Set());
    } finally {
      setLoadingCal(false);
    }
  }, [profile, monthCursor]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // Crew streak leaderboard — merge boards from every crew the user is in,
  // keep each person's best streak, and rank by current streak.
  const loadBoard = useCallback(async () => {
    if (!profile) return;
    setLoadingBoard(true);
    try {
      const groups = await getMyGroups(profile.groupIds ?? []);
      const boards = await Promise.all(groups.map((g) => getStreakBoard(g.id)));
      const byUser = new Map<string, StreakBoardEntry>();
      boards.flat().forEach((e) => {
        const prev = byUser.get(e.userId);
        if (!prev || e.currentStreak > prev.currentStreak) byUser.set(e.userId, e);
      });
      // Make sure the current user is represented, even before any board sync.
      if (!byUser.has(profile.id)) {
        byUser.set(profile.id, {
          userId: profile.id,
          displayName: profile.displayName,
          currentStreak,
          longestStreak,
        });
      }
      setBoard([...byUser.values()].sort((a, b) => b.currentStreak - a.currentStreak));
    } catch {
      setBoard([]);
    } finally {
      setLoadingBoard(false);
    }
  }, [profile, currentStreak, longestStreak]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const s = useMemo(() => makeStyles(theme), [theme]);

  const shiftMonth = (delta: number) =>
    setMonthCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
          <X size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.tabs}>
          {(['you', 'friends'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'you' ? 'You' : 'Friends'}
              </Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.closeBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {tab === 'you' ? (
          <YouTab
            s={s}
            theme={theme}
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            trainingDays={trainingDays}
            trainedDates={trainedDates}
            loadingCal={loadingCal}
            monthCursor={monthCursor}
            shiftMonth={shiftMonth}
            onLogWorkout={() => {
              navigation.goBack();
              navigation.navigate('Workouts', {
                screen: 'LogWorkout',
                params: { exercises: [], sourceLabel: 'Free Workout' },
              });
            }}
          />
        ) : (
          <FriendsTab s={s} theme={theme} board={board} loading={loadingBoard} meId={profile?.id} />
        )}
      </ScrollView>
    </View>
  );
}

function YouTab({
  s,
  theme,
  currentStreak,
  longestStreak,
  trainingDays,
  trainedDates,
  loadingCal,
  monthCursor,
  shiftMonth,
  onLogWorkout,
}: any) {
  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  // Build the calendar grid: leading blanks for the 1st's weekday, then days.
  const firstWeekday = new Date(monthCursor.year, monthCursor.month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(monthCursor.year, monthCursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = new Date();
  const isThisMonth = today.getFullYear() === monthCursor.year && today.getMonth() === monthCursor.month;

  return (
    <>
      {/* Hero */}
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroNumber}>{currentStreak}</Text>
          <Text style={s.heroLabel}>Day streak!</Text>
        </View>
        <Flame size={96} color={theme.colors.warning} fill={theme.colors.warning} />
      </View>

      {currentStreak === 0 ? (
        <View style={s.ctaCard}>
          <Flame size={28} color={theme.colors.warning} fill={theme.colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={s.ctaText}>Start your streak by logging a workout on a scheduled day.</Text>
            <TouchableOpacity style={s.ctaBtn} onPress={onLogWorkout} activeOpacity={0.85}>
              <Text style={s.ctaBtnText}>Log a workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Flame size={18} color={theme.colors.warning} />
            <Text style={s.statValue}>{currentStreak}</Text>
            <Text style={s.statLabel}>CURRENT</Text>
          </View>
          <View style={s.statCard}>
            <Trophy size={18} color={theme.colors.primary} />
            <Text style={s.statValue}>{longestStreak}</Text>
            <Text style={s.statLabel}>BEST EVER</Text>
          </View>
        </View>
      )}

      {/* Calendar */}
      <Text style={s.sectionTitle}>Calendar</Text>
      <View style={s.calCard}>
        <View style={s.calHead}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={s.calNav}>
            <ChevronLeft size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.calMonth}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={s.calNav}>
            <ChevronRight size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={s.calGrid}>
          {WEEKDAY_LABELS.map((d, i) => (
            <View key={`h${i}`} style={s.calCell}>
              <Text style={s.calWeekday}>{d}</Text>
            </View>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <View key={`b${i}`} style={s.calCell} />;
            const iso = isoOf(new Date(monthCursor.year, monthCursor.month, day));
            const trained = trainedDates.has(iso);
            const weekday = new Date(monthCursor.year, monthCursor.month, day).getDay();
            const scheduled = trainingDays.includes(weekday);
            const isToday = isThisMonth && day === today.getDate();
            return (
              <View key={`d${i}`} style={s.calCell}>
                <View
                  style={[
                    s.calDay,
                    scheduled && !trained && s.calDayScheduled,
                    trained && s.calDayTrained,
                    isToday && s.calDayToday,
                  ]}
                >
                  {trained ? (
                    <Flame size={14} color={theme.colors.primaryForeground} fill={theme.colors.primaryForeground} />
                  ) : (
                    <Text style={[s.calDayText, scheduled && s.calDayTextScheduled]}>{day}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {loadingCal && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />}

        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, s.calDayTrained]} />
            <Text style={s.legendText}>Trained</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, s.calDayScheduled]} />
            <Text style={s.legendText}>Scheduled</Text>
          </View>
        </View>
      </View>
    </>
  );
}

function FriendsTab({ s, theme, board, loading, meId }: any) {
  if (loading) {
    return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 48 }} />;
  }
  if (!board.length || (board.length === 1 && board[0].userId === meId)) {
    return (
      <View style={s.emptyState}>
        <Users size={40} color={theme.colors.textSecondary} />
        <Text style={s.emptyTitle}>No crew streaks yet</Text>
        <Text style={s.emptyText}>
          Join or create a crew to compare streaks with friends and climb the leaderboard.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.sectionTitle}>Crew streak leaderboard</Text>
      {board.map((entry: StreakBoardEntry, i: number) => {
        const isMe = entry.userId === meId;
        const initials = entry.displayName.slice(0, 2).toUpperCase();
        return (
          <View key={entry.userId} style={[s.rankRow, isMe && s.rankRowMe]}>
            <Text style={s.rankNum}>{i + 1}</Text>
            <View style={s.rankAvatar}>
              <Text style={s.rankAvatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rankName}>
                {entry.displayName}
                {isMe ? ' (You)' : ''}
              </Text>
              <Text style={s.rankBest}>Best: {entry.longestStreak}</Text>
            </View>
            <View style={s.rankStreak}>
              <Flame size={16} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text style={s.rankStreakNum}>{entry.currentStreak}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingBottom: 4,
      backgroundColor: c.warning,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    tabs: { flexDirection: 'row', gap: 28 },
    tabBtn: { paddingVertical: 14, alignItems: 'center' },
    tabText: { color: c.primaryForeground + 'b3', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
    tabTextActive: { color: c.primaryForeground },
    tabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.primaryForeground,
    },
    content: { padding: 16, paddingBottom: 48, gap: 16 },

    hero: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
    heroNumber: { color: c.textPrimary, fontSize: 88, fontWeight: '900', lineHeight: 96 },
    heroLabel: { color: c.textPrimary, fontSize: 26, fontWeight: '800', marginTop: -8 },

    ctaCard: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
      backgroundColor: c.surfaceElevated,
      borderRadius: 16,
      padding: 16,
    },
    ctaText: { color: c.textPrimary, fontSize: 15, marginBottom: 10 },
    ctaBtn: {
      alignSelf: 'flex-start',
      backgroundColor: c.warning,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    ctaBtnText: { color: c.primaryForeground, fontWeight: '800', fontSize: 14 },

    statRow: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1,
      backgroundColor: c.surfaceElevated,
      borderRadius: 16,
      padding: 16,
      alignItems: 'flex-start',
      gap: 6,
    },
    statValue: { color: c.textPrimary, fontSize: 30, fontWeight: '900' },
    statLabel: { color: c.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

    sectionTitle: { color: c.textPrimary, fontSize: 22, fontWeight: '800' },
    calCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12 },
    calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    calNav: { padding: 6 },
    calMonth: { color: c.textPrimary, fontSize: 18, fontWeight: '800' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 3 },
    calWeekday: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    calDay: { width: '100%', height: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    calDayText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    calDayTextScheduled: { color: c.textPrimary },
    calDayScheduled: { borderWidth: 1, borderColor: c.warning + '80' },
    calDayTrained: { backgroundColor: c.warning },
    calDayToday: { borderWidth: 2, borderColor: c.primary },

    legendRow: { flexDirection: 'row', gap: 20, marginTop: 12, paddingHorizontal: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 16, height: 16, borderRadius: 5 },
    legendText: { color: c.textSecondary, fontSize: 12 },

    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12,
    },
    rankRowMe: { borderColor: c.warning, backgroundColor: c.warning + '14' },
    rankNum: { color: c.textSecondary, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
    rankAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankAvatarText: { color: c.textPrimary, fontSize: 14, fontWeight: '800' },
    rankName: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    rankBest: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
    rankStreak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    rankStreakNum: { color: c.textPrimary, fontSize: 20, fontWeight: '900' },

    emptyState: { alignItems: 'center', gap: 12, paddingTop: 64, paddingHorizontal: 24 },
    emptyTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '800' },
    emptyText: { color: c.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
}
