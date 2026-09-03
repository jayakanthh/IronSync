import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';

import type { Community } from '../../models/index';
import { getCommunityStrengthLeaderboard } from '../../services/community/community';
import { useCurrentUser } from '../../context/CurrentUser';
import { getAvatarBg } from '../../utils/formatting/avatarColors';

interface Props {
  community: Community;
}

const BIG_4 = [
  { id: 'bench_press', label: 'Bench Press', searchName: 'Barbell Bench Press' },
  { id: 'squat', label: 'Squat', searchName: 'Barbell Squat' },
  { id: 'deadlift', label: 'Deadlift', searchName: 'Barbell Deadlift' },
  { id: 'ohp', label: 'OHP', searchName: 'Overhead Press' },
];

export default function AchievementsTab({ community }: Props) {
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();
  const [activeEx, setActiveEx] = useState(BIG_4[0]);
  const [leaderboard, setLeaderboard] = useState<{ userId: string; displayName: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getCommunityStrengthLeaderboard(community.id, activeEx.searchName);
        setLeaderboard(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [community.id, activeEx]);

  const myRank = profile ? leaderboard.findIndex(r => r.userId === profile.id) : -1;
  const myData = myRank !== -1 ? leaderboard[myRank] : null;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Typography variant="bodyBold" style={styles.headerTitle}>COMMUNITY STRENGTH</Typography>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {BIG_4.map(ex => (
          <TouchableOpacity 
            key={ex.id}
            style={[styles.pill, activeEx.id === ex.id && styles.pillActive]}
            onPress={() => setActiveEx(ex)}
          >
            <Typography variant="caption" color={activeEx.id === ex.id ? colors.primary : colors.textMuted} style={{ fontWeight: '700' }}>
              {ex.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : leaderboard.length === 0 ? (
        <View style={styles.empty}>
          <Typography variant="body" color={colors.textMuted}>Not enough data yet.</Typography>
          <Typography variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: 8 }}>
            Log a '{activeEx.searchName}' PR with community visibility to appear on the board.
          </Typography>
        </View>
      ) : (
        <Card style={styles.boardCard}>
          {/* Top 1 */}
          <View style={styles.top1}>
            <Typography style={{ fontSize: 32 }}>🏆</Typography>
            <Typography variant="h2" style={{ textTransform: 'uppercase', marginTop: 4 }}>
              {leaderboard[0].displayName}
            </Typography>
            <Typography variant="h1" color={colors.primary}>
              {leaderboard[0].value} KG
            </Typography>
            <Typography variant="caption" color={colors.textMuted} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {activeEx.label}
            </Typography>
          </View>

          {/* Ranks 2 and 3 */}
          <View style={styles.podiumRest}>
            {leaderboard[1] && (
              <View style={styles.rankRow}>
                <Typography style={{ width: 24 }}>🥈</Typography>
                <Typography variant="bodyBold" style={{ flex: 1 }}>{leaderboard[1].displayName}</Typography>
                <Typography variant="bodyBold" color={colors.primary}>{leaderboard[1].value} kg</Typography>
              </View>
            )}
            {leaderboard[2] && (
              <View style={styles.rankRow}>
                <Typography style={{ width: 24 }}>🥉</Typography>
                <Typography variant="bodyBold" style={{ flex: 1 }}>{leaderboard[2].displayName}</Typography>
                <Typography variant="bodyBold" color={colors.primary}>{leaderboard[2].value} kg</Typography>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Your Rank */}
          {profile && (
            <View style={styles.myRankRow}>
              <Typography variant="caption" color={colors.textMuted} style={{ width: 60, fontWeight: '700' }}>
                {myRank !== -1 ? `YOUR RANK` : 'NOT RANKED'}
              </Typography>
              {myRank !== -1 && (
                <>
                  <View style={[styles.avatarSmall, { backgroundColor: getAvatarBg(profile.displayName || '') }]}>
                    <Typography style={styles.avatarTextSmall}>{(profile.displayName || '').slice(0, 2).toUpperCase()}</Typography>
                  </View>
                  <Typography variant="bodyBold" color={colors.primary} style={{ flex: 1, marginLeft: 8 }}>
                    #{myRank + 1}
                  </Typography>
                  <Typography variant="bodyBold" color={colors.primary}>{myData!.value} kg</Typography>
                </>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.viewFullBtn}>
            <Typography variant="caption" color={colors.primary}>View Full Ranking</Typography>
          </TouchableOpacity>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: TAB_BAR_SPACE },
  headerTitle: { color: colors.textMuted, fontSize: 12, letterSpacing: 1 },
  pills: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  pillActive: { backgroundColor: 'rgba(72, 187, 149, 0.15)', borderWidth: 1, borderColor: colors.primary },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  boardCard: { padding: spacing.md, gap: spacing.md },
  top1: { alignItems: 'center', paddingVertical: spacing.md },
  podiumRest: { gap: spacing.sm, marginTop: -spacing.sm },
  rankRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  myRankRow: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarTextSmall: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  viewFullBtn: { alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }
});
