import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, Search, Users, Award, Dumbbell, Shield, Compass } from 'lucide-react-native';
import { colors, spacing, radius, useTheme } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentUser } from '../../context/CurrentUser';
import { getMyCommunities, getMyGroups, getStreakBoard } from '../../services/index';
import type { Community, Group, StreakBoardEntry } from '../../models/index';
import FriendsPanel from '../../components/community/FriendsPanel';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { profile } = useCurrentUser();

  const [activeTab, setActiveTab] = useState<'communities' | 'friends'>('communities');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [crews, setCrews] = useState<Group[]>([]);
  const [crewStreaks, setCrewStreaks] = useState<Record<string, StreakBoardEntry[]>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const commIds = profile.communityIds ?? [];
      const crewIds = profile.groupIds ?? [];
      
      const [myComms, myCrews] = await Promise.all([
        getMyCommunities(commIds),
        getMyGroups(crewIds),
      ]);

      const streaks = await Promise.all(
        myCrews.map(async (g) => [g.id, await getStreakBoard(g.id)] as const)
      );

      setCommunities(myComms);
      setCrews(myCrews);
      setCrewStreaks(Object.fromEntries(streaks));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [loadData, profile]);

  // Color mapping based on community name to give unique avatar colors
  const getAvatarBg = (name: string) => {
    const colorsList = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colorsList[sum % colorsList.length];
  };

  const renderCommunitiesTab = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Join/Create Banner CTA */}
        <Card style={styles.ctaCard}>
          <Typography variant="h2" style={styles.ctaTitle}>Find Your Fitness Space</Typography>
          <Typography variant="body" color={colors.textMuted} style={styles.ctaSub}>
            Join your gym, apartment, college, or create a private fitness group to train together.
          </Typography>
          <View style={styles.ctaButtonRow}>
            <Button
              variant="primary"
              size="sm"
              onPress={() => navigation.navigate('CommunityDiscover')}
              style={styles.bannerBtn}
            >
              <Compass size={14} color={colors.primaryDark} style={{ marginRight: 6 }} />
              Discover Spaces
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => navigation.navigate('CommunityCreate')}
              style={styles.bannerBtn}
            >
              <Plus size={14} color={colors.primary} style={{ marginRight: 6 }} />
              Create Space
            </Button>
          </View>
        </Card>

        {/* My Communities Section */}
        <View style={styles.sectionHeader}>
          <Typography variant="h2">My Spaces ({communities.length})</Typography>
        </View>
        {communities.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Typography variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
              You haven't joined any Spaces yet. Use the discover button to find your gym or college!
            </Typography>
          </Card>
        ) : (
          communities.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
            >
              <Card style={styles.commCard}>
                <View style={[styles.avatar, { backgroundColor: getAvatarBg(item.name) }]}>
                  <Typography variant="h2" style={styles.avatarText}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </Typography>
                </View>
                <View style={styles.commInfo}>
                  <Typography variant="bodyBold">{item.name}</Typography>
                  <Typography variant="caption" color={colors.textMuted} style={{ textTransform: 'capitalize' }}>
                    {item.type} • {item.memberCount} members
                  </Typography>
                  {item.trainingNowCount && item.trainingNowCount > 0 ? (
                    <View style={styles.trainingBadge}>
                      <View style={styles.activeDot} />
                      <Typography style={styles.trainingText}>
                        {item.trainingNowCount} training now
                      </Typography>
                    </View>
                  ) : null}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* My Crews (Streak/PR Groups) Section */}
        <View style={styles.sectionHeader}>
          <Typography variant="h2">My Leaderboard Crews</Typography>
          <Typography variant="caption" color={colors.textMuted}>Competitive leaderboard circles</Typography>
        </View>
        {crews.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Typography variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
              No crews joined yet. Start a streak leaderboard crew with your close friends!
            </Typography>
          </Card>
        ) : (
          crews.map((crew) => (
            <Card key={crew.id} style={styles.crewCard}>
              <View style={styles.crewHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Users size={16} color={colors.primary} />
                  <Typography variant="bodyBold">{crew.name}</Typography>
                </View>
                <Typography variant="caption" color={colors.textMuted}>
                  Code: <Typography variant="caption" color={colors.primary}>{crew.inviteCode}</Typography>
                </Typography>
              </View>
              
              {/* Leaderboard preview */}
              <View style={styles.leaderboardPreview}>
                {(crewStreaks[crew.id] ?? []).slice(0, 3).map((e, index) => (
                  <View key={e.userId} style={styles.leaderRow}>
                    <Typography variant="caption" style={styles.leaderRank}>#{index + 1}</Typography>
                    <Typography variant="caption" style={{ flex: 1 }}>{e.displayName}</Typography>
                    <Typography variant="caption" color={colors.primary}>{e.currentStreak} 🔥</Typography>
                  </View>
                ))}
                {(crewStreaks[crew.id] ?? []).length === 0 && (
                  <Typography variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
                    No streaks logged yet. Keep training!
                  </Typography>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="h1" color={theme.colors.textPrimary}>Community Hub</Typography>
        <Typography variant="caption" color={theme.colors.textSecondary}>Connect, share, and train together</Typography>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'communities' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('communities')}
        >
          <Typography variant="bodyBold" color={activeTab === 'communities' ? theme.colors.primary : theme.colors.textSecondary}>
            Spaces
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('friends')}
        >
          <Typography variant="bodyBold" color={activeTab === 'friends' ? theme.colors.primary : theme.colors.textSecondary}>
            Friends
          </Typography>
        </TouchableOpacity>
      </View>

      {activeTab === 'communities' ? renderCommunitiesTab() : <FriendsPanel />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100, // Safe distance for FAB
  },
  ctaCard: {
    backgroundColor: 'rgba(72, 187, 149, 0.1)',
    borderColor: 'rgba(72, 187, 149, 0.2)',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  ctaTitle: {
    marginBottom: spacing.xs,
  },
  ctaSub: {
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  ctaButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bannerBtn: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: spacing.xs,
    marginBottom: -spacing.xs,
  },
  emptyCard: {
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  commInfo: {
    flex: 1,
    gap: 2,
  },
  trainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(72, 187, 149, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  trainingText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
  },
  crewCard: {
    gap: spacing.sm,
  },
  crewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaderboardPreview: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 6,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leaderRank: {
    width: 24,
    color: colors.textMuted,
    fontWeight: '700',
  },
});
