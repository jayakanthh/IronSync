import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { colors, spacing, radius } from '../../theme/colors';
import { Heart, MessageSquare, Award } from 'lucide-react-native';

import type { Community, CommunityPost, Workout, Exercise } from '../../models/index';
import { getCommunityWorkouts, likePost } from '../../services/community/community';
import { getWorkoutById, getExercisesByIds } from '../../services/index';
import { getAvatarBg } from '../../utils/formatting/avatarColors';
import { getRelativeTime } from '../../utils/formatting/relativeTime';
import { useCurrentUser } from '../../context/CurrentUser';
import MuscleSilhouette, { aggregateMusclesFromExercises } from '../common/MuscleSilhouette';

interface Props {
  community: Community;
}

// Sub-component for individual post card to load workout details and SVGs in background
function CommunityPostCard({
  post,
  profileId,
  onLike,
  onPressCard,
  onPressAuthor,
}: {
  post: CommunityPost;
  profileId: string;
  onLike: () => void;
  onPressCard: () => void;
  onPressAuthor: () => void;
}) {
  const isLiked = post.likes.includes(profileId);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [musclePrimary, setMusclePrimary] = useState<Set<string>>(new Set());
  const [muscleSecondary, setMuscleSecondary] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    if (post.workoutId && post.authorId) {
      getWorkoutById(post.authorId, post.workoutId).then((wkt) => {
        if (!wkt || !active) return;
        setWorkout(wkt);
        
        const exIds = wkt.entries.map((e) => e.exerciseId);
        if (exIds.length > 0) {
          getExercisesByIds(exIds).then((exList) => {
            if (!active) return;
            const { primary, secondary } = aggregateMusclesFromExercises(exList);
            setMusclePrimary(primary);
            setMuscleSecondary(secondary);
          });
        }
      }).catch(console.error);
    }
    return () => {
      active = false;
    };
  }, [post.workoutId, post.authorId]);

  return (
    <Card style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.authorRow} onPress={onPressAuthor}>
          <View style={[styles.avatar, { backgroundColor: getAvatarBg(post.authorName) }]}>
            <Typography style={styles.avatarText}>{post.authorName.slice(0, 2).toUpperCase()}</Typography>
          </View>
          <View>
            <Typography variant="bodyBold">{post.authorName}</Typography>
            <Typography variant="caption" color={colors.textMuted}>
              {post.workoutName || 'Workout'} · {getRelativeTime(post.createdAt)}
            </Typography>
            {workout?.workoutType === 'duo' && workout.duoPartnerName && (
              <View style={styles.duoBadge}>
                <Typography variant="caption" color={colors.primary} style={{ fontWeight: '800', fontSize: 10 }}>
                  🤝 Duo with {workout.duoPartnerName}
                </Typography>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onPressCard} activeOpacity={0.9}>
        {post.notes ? (
          <Typography variant="body" style={styles.notesText}>
            "{post.notes}"
          </Typography>
        ) : null}

        {/* Stats box */}
        <View style={styles.statsRow}>
          {!!post.durationMinutes && (
            <View style={styles.statBox}>
              <Typography variant="bodyBold">{post.durationMinutes}m</Typography>
              <Typography variant="caption" color={colors.textMuted}>Duration</Typography>
            </View>
          )}
          {!!post.totalVolumeKg && (
            <View style={styles.statBox}>
              <Typography variant="bodyBold">{post.totalVolumeKg.toLocaleString()} kg</Typography>
              <Typography variant="caption" color={colors.textMuted}>Volume</Typography>
            </View>
          )}
          {post.prCount !== undefined && post.prCount > 0 && (
            <View style={styles.statBox}>
              <Typography variant="bodyBold" color={colors.primary}>{post.prCount}</Typography>
              <Typography variant="caption" color={colors.primary}>PRs</Typography>
            </View>
          )}
        </View>

        {/* Dynamic miniature muscle contours */}
        {workout && (musclePrimary.size > 0 || muscleSecondary.size > 0) && (
          <View style={styles.silContainer}>
            <MuscleSilhouette primaryMuscles={musclePrimary} secondaryMuscles={muscleSecondary} view="front" size={56} />
            <MuscleSilhouette primaryMuscles={musclePrimary} secondaryMuscles={muscleSecondary} view="back" size={56} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Heart size={16} color={isLiked ? colors.primary : colors.textMuted} fill={isLiked ? colors.primary : 'none'} />
          <Typography variant="caption" color={isLiked ? colors.primary : colors.textMuted}>{post.likes.length}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onPressCard}>
          <MessageSquare size={16} color={colors.textMuted} />
          <Typography variant="caption" color={colors.textMuted}>{post.commentCount}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onPressCard}>
          <Award size={16} color={colors.textMuted} />
          <Typography variant="caption" color={colors.textMuted}>{post.celebrateCount}</Typography>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

export default function WorkoutsTab({ community }: Props) {
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCommunityWorkouts(community.id, 20);
        setPosts(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [community.id]);

  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});

  const handleLike = async (postId: string) => {
    if (!profile || likeBusy[postId]) return;
    setLikeBusy(prev => ({ ...prev, [postId]: true }));

    const post = posts.find(p => p.id === postId);
    if (!post) {
      setLikeBusy(prev => ({ ...prev, [postId]: false }));
      return;
    }

    const isLiked = post.likes.includes(profile.id);

    // Optimistic UI update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likes: isLiked 
            ? p.likes.filter(id => id !== profile.id) 
            : [...p.likes, profile.id]
        };
      }
      return p;
    }));

    try {
      await likePost(community.id, postId, profile.id, isLiked);
    } catch (e) {
      console.error(e);
      // Revert optimistic UI on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes: isLiked 
              ? [...p.likes, profile.id]
              : p.likes.filter(id => id !== profile.id)
          };
        }
        return p;
      }));
    } finally {
      setLikeBusy(prev => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  }

  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <Typography variant="body" color={colors.textMuted}>No workouts shared yet.</Typography>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {posts.map(post => (
        <CommunityPostCard
          key={post.id}
          post={post}
          profileId={profile?.id || ''}
          onLike={() => handleLike(post.id)}
          onPressCard={() => {
            if (post.workoutId && post.authorId) {
              navigation.navigate('WorkoutDetail', { workoutId: post.workoutId, userId: post.authorId });
            }
          }}
          onPressAuthor={() => navigation.navigate('UserProfile', { userId: post.authorId })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: 60 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  postCard: { padding: spacing.md },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  notesText: { color: colors.text, fontSize: 13, fontStyle: 'italic', marginBottom: spacing.sm, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  
  silContainer: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
  
  actions: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.lg, marginTop: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  duoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
