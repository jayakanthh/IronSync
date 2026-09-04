import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';
import { Search, UserPlus, Play } from 'lucide-react-native';

import type { Community, CommunityMember, Workout, Exercise } from '../../models/index';
import { getExercisesByIds, getFriendWorkouts } from '../../services/index';
import { getRelativeTime } from '../../utils/formatting/relativeTime';
import { getCommunityMembers } from '../../services/community/community';
import { getAvatarBg } from '../../utils/formatting/avatarColors';
import { useCurrentUser } from '../../context/CurrentUser';
import { sendFriendRequestByUid, getFriends } from '../../services/users/friends';
import { followUser, getFollowing } from '../../services/users/follow';
import MuscleSilhouette, { aggregateMusclesFromExercises } from '../common/MuscleSilhouette';

interface Props {
  community: Community;
}

// 1. Body Viz wrapper for Training Now members using activeExerciseIds
const TrainingNowBodyViz = ({ currentActivity, activeExerciseIds }: { currentActivity?: string, activeExerciseIds?: string[] }) => {
  const [musclePrimary, setMusclePrimary] = useState<Set<string>>(new Set());
  const [muscleSecondary, setMuscleSecondary] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function resolveMuscles() {
      if (activeExerciseIds && activeExerciseIds.length > 0) {
        try {
          const exercises = await getExercisesByIds(activeExerciseIds);
          if (!active) return;
          const { primary, secondary } = aggregateMusclesFromExercises(exercises);
          setMusclePrimary(primary);
          setMuscleSecondary(secondary);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // Fallback text parsing if activeExerciseIds not fully resolved
      if (currentActivity) {
        const act = currentActivity.toLowerCase();
        const prim = new Set<string>();
        if (act.includes('chest') || act.includes('push') || act.includes('bench')) prim.add('chest');
        if (act.includes('back') || act.includes('pull') || act.includes('lats') || act.includes('row')) prim.add('back');
        if (act.includes('leg') || act.includes('squat') || act.includes('glute') || act.includes('quad') || act.includes('hamstring')) prim.add('legs');
        if (act.includes('arm') || act.includes('bicep') || act.includes('tricep') || act.includes('shoulder')) prim.add('arms');
        if (active) {
          setMusclePrimary(prim);
          setMuscleSecondary(new Set());
        }
      }
    }
    resolveMuscles();
    return () => {
      active = false;
    };
  }, [activeExerciseIds, currentActivity]);

  return (
    <View style={styles.vizBorder}>
      <MuscleSilhouette
        primaryMuscles={musclePrimary}
        secondaryMuscles={muscleSecondary}
        view="front"
        size={46}
      />
    </View>
  );
};

// 2. Body Viz wrapper for Recently Active members using their last completed workout
const RecentlyActiveBodyViz = ({ userId }: { userId: string }) => {
  const [musclePrimary, setMusclePrimary] = useState<Set<string>>(new Set());
  const [muscleSecondary, setMuscleSecondary] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function resolveRecentMuscles() {
      try {
        // Only what they've shared — their own history is owner-only.
        const history = await getFriendWorkouts(userId, 1);
        if (!active || history.length === 0) return;
        const lastWkt = history[0];
        const exIds = lastWkt.entries.map(e => e.exerciseId);
        if (exIds.length > 0) {
          const exercises = await getExercisesByIds(exIds);
          if (!active) return;
          const { primary, secondary } = aggregateMusclesFromExercises(exercises);
          setMusclePrimary(primary);
          setMuscleSecondary(secondary);
        }
      } catch (e) {
        console.error(e);
      }
    }
    resolveRecentMuscles();
    return () => {
      active = false;
    };
  }, [userId]);

  if (musclePrimary.size === 0 && muscleSecondary.size === 0) {
    return null;
  }

  return (
    <View style={styles.vizBorder}>
      <MuscleSilhouette
        primaryMuscles={musclePrimary}
        secondaryMuscles={muscleSecondary}
        view="front"
        size={46}
      />
    </View>
  );
};

export default function PeopleTab({ community }: Props) {
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Social states
  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const mems = await getCommunityMembers(community.id);
        setMembers(mems);

        if (profile) {
          const [fList, folList] = await Promise.all([
            getFriends(profile.id),
            getFollowing(profile.id)
          ]);
          setFriends(new Set(fList.map(f => f.friendId)));
          setFollowing(new Set(folList.map(f => f.targetId)));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [community.id, profile]);

  const [socialBusy, setSocialBusy] = useState<Record<string, boolean>>({});

  const handleFollow = async (userId: string, targetName: string) => {
    if (!profile || socialBusy[userId]) return;
    setSocialBusy(prev => ({ ...prev, [userId]: true }));
    try {
      await followUser({ id: profile.id, name: profile.displayName || '' }, { id: userId, name: targetName });
      setFollowing(prev => new Set(prev).add(userId));
      Alert.alert('Success', `You are now following ${targetName}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to follow user.');
    } finally {
      setSocialBusy(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleFriend = async (userId: string, targetName: string) => {
    if (!profile || socialBusy[userId]) return;
    setSocialBusy(prev => ({ ...prev, [userId]: true }));
    try {
      await sendFriendRequestByUid({ id: profile.id, name: profile.displayName || '' }, userId);
      Alert.alert('Success', `Friend request sent to ${targetName}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to send friend request.');
    } finally {
      setSocialBusy(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  }

  const trainingNow = members.filter(m => m.isTrainingNow);
  const recentlyActive = members.filter(m => !m.isTrainingNow && m.lastActive)
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))
    .slice(0, 5); // Show top 5 recent
  
  const filteredAll = members.filter(m => 
    m.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      
      <View style={styles.searchBar}>
        <Search size={16} color={colors.textMuted} />
        <TextInput 
          placeholder="Search members..." 
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {!search && trainingNow.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.activeDot} />
            <Typography variant="bodyBold">TRAINING NOW · {trainingNow.length}</Typography>
          </View>
          {trainingNow.map(m => (
            <Card key={m.userId} style={styles.activeCard}>
              <View style={styles.activeCardTop}>
                <View style={[styles.avatar, { backgroundColor: getAvatarBg(m.displayName) }]}>
                  <Typography style={styles.avatarText}>{m.displayName.slice(0, 2).toUpperCase()}</Typography>
                </View>
                <View style={styles.info}>
                  <Typography variant="bodyBold">{m.displayName}</Typography>
                  <Typography variant="caption" color={colors.textMuted}>Working out · {m.currentActivity || 'Active'}</Typography>
                </View>
                <TrainingNowBodyViz currentActivity={m.currentActivity} activeExerciseIds={m.activeExerciseIds} />
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('UserProfile', { userId: m.userId })}>
                  <Typography variant="caption" color={colors.primary}>Profile</Typography>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('GroupLobby', { communityId: community.id, invite: m.userId })}>
                  <Typography variant="caption" color={colors.primary}>Duo</Typography>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      {!search && recentlyActive.length > 0 && (
        <View style={styles.section}>
          <Typography variant="bodyBold" style={{ color: colors.textMuted, marginBottom: spacing.sm, fontSize: 12 }}>
            RECENTLY ACTIVE
          </Typography>
          {recentlyActive.map(m => (
            <Card key={m.userId} style={styles.activeCard}>
              <View style={styles.activeCardTop}>
                <View style={[styles.avatar, { backgroundColor: getAvatarBg(m.displayName) }]}>
                  <Typography style={styles.avatarText}>{m.displayName.slice(0, 2).toUpperCase()}</Typography>
                </View>
                <View style={styles.info}>
                  <Typography variant="bodyBold">{m.displayName}</Typography>
                  <Typography variant="caption" color={colors.textMuted}>
                    Last workout · {m.lastActive ? getRelativeTime(m.lastActive) : 'Recently'}
                  </Typography>
                </View>
                <RecentlyActiveBodyViz userId={m.userId} />
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('UserProfile', { userId: m.userId })}>
                  <Typography variant="caption" color={colors.primary}>Profile</Typography>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Typography variant="bodyBold" style={{ color: colors.textMuted, marginBottom: spacing.sm, fontSize: 12 }}>
          ALL MEMBERS ({filteredAll.length})
        </Typography>
        {filteredAll.map(m => {
          const isMe = profile?.id === m.userId;
          const isFriend = friends.has(m.userId);
          const isFollowing = following.has(m.userId);

          return (
            <View key={m.userId} style={styles.memberRow}>
              <TouchableOpacity style={styles.memberInfo} onPress={() => navigation.navigate('UserProfile', { userId: m.userId })}>
                <View style={[styles.avatarSmall, { backgroundColor: getAvatarBg(m.displayName) }]}>
                  <Typography style={styles.avatarTextSmall}>{m.displayName.slice(0, 2).toUpperCase()}</Typography>
                </View>
                <View>
                  <Typography variant="bodyBold">{m.displayName}</Typography>
                  <Typography variant="caption" color={colors.textMuted}>{m.role}</Typography>
                </View>
              </TouchableOpacity>
              
              {!isMe && (
                <View style={styles.socialBtns}>
                  {!isFriend && (
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleFriend(m.userId, m.displayName)}>
                      <UserPlus size={16} color={colors.text} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.followBtn, isFollowing && styles.followingBtn]} 
                    onPress={() => !isFollowing && handleFollow(m.userId, m.displayName)}
                  >
                    <Typography variant="caption" color={isFollowing ? colors.primary : colors.bg}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Typography>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.lg, paddingBottom: TAB_BAR_SPACE },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 40,
    gap: spacing.sm
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  section: {},
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  activeCard: { padding: spacing.md, marginBottom: spacing.sm },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  info: { flex: 1 },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm, gap: spacing.md },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarTextSmall: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  socialBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  followBtn: { backgroundColor: colors.text, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  followingBtn: { backgroundColor: 'rgba(72, 187, 149, 0.15)' },
  vizBorder: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }
});
