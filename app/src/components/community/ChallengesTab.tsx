import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';

import type { Community, CommunityChallenge, ChallengeProgress } from '../../models/index';
import { 
  getCommunityChallenge, 
  getChallengeProgress, 
  createChallenge, 
  joinChallenge, 
  discardChallenge,
  recalculateChallenge 
} from '../../services/community/community';
import { useCurrentUser } from '../../context/CurrentUser';

interface Props {
  community: Community;
}

interface ChallengeItem {
  challenge: CommunityChallenge;
  progress: ChallengeProgress[];
}

export default function ChallengesTab({ community }: Props) {
  const { profile } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  
  // Admin Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'volume' | 'exercise'>('volume');
  const [createTarget, setCreateTarget] = useState('500');
  const [createExercise, setCreateExercise] = useState('Bench Press');
  const [createPeriod, setCreatePeriod] = useState<'weekly' | 'monthly'>('weekly');

  const isAdmin = profile && community.adminIds.includes(profile.id);

  const load = async () => {
    setLoading(true);
    try {
      const active = await getCommunityChallenge(community.id);
      
      // Recalculate progress for all active challenges
      await Promise.all(
        active.map(c => recalculateChallenge(community.id, c.id).catch(err => console.error("Error recalculating challenge:", err)))
      );

      // Fetch refreshed active challenges
      const refreshedActive = await getCommunityChallenge(community.id);
      
      const items = await Promise.all(
        refreshedActive.map(async (c) => {
          const pList = await getChallengeProgress(community.id, c.id);
          return { challenge: c, progress: pList };
        })
      );
      setChallenges(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [community.id]);

  const handleCreate = async () => {
    if (!profile) return;
    const targetVal = parseInt(createTarget, 10);
    if (isNaN(targetVal) || targetVal <= 0) {
      Alert.alert('Error', 'Target must be a positive number of KG.');
      return;
    }
    if (createType === 'exercise' && !createExercise.trim()) {
      Alert.alert('Error', 'Exercise name is required.');
      return;
    }
    
    setLoading(true);
    const d = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (createPeriod === 'weekly' ? 7 : 30));
    
    await createChallenge(profile.id, community.id, {
      name: createType === 'volume' 
        ? `${targetVal} KG ${createPeriod.toUpperCase()} VOLUME` 
        : `${createExercise.toUpperCase()} ${targetVal} KG ${createPeriod.toUpperCase()}`,
      metric: createType === 'volume' ? 'volume_kg' : 'exercise_volume',
      exerciseName: createType === 'exercise' ? createExercise : undefined,
      target: targetVal,
      startDate: d.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });
    setIsCreating(false);
    await load();
  };

  const handleJoin = async (challengeId: string) => {
    if (!profile) return;
    setLoading(true);
    await joinChallenge(profile.id, profile.displayName || 'Member', community.id, challengeId);
    await load();
  };

  const handleDiscard = async (challengeId: string) => {
    if (!profile) return;
    setLoading(true);
    await discardChallenge(profile.id, community.id, challengeId);
    await load();
  };

  const toggleLeaderboard = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  if (isCreating) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Typography variant="bodyBold" style={styles.headerTitle}>CREATE CHALLENGE</Typography>
        <Card style={styles.card}>
          <View style={styles.pills}>
            <TouchableOpacity 
              style={[styles.pill, createType === 'volume' && styles.pillActive]}
              onPress={() => setCreateType('volume')}
            >
              <Typography variant="caption" color={createType === 'volume' ? colors.primary : colors.textMuted}>Volume (kg)</Typography>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.pill, createType === 'exercise' && styles.pillActive]}
              onPress={() => setCreateType('exercise')}
            >
              <Typography variant="caption" color={createType === 'exercise' ? colors.primary : colors.textMuted}>Exercise (kg)</Typography>
            </TouchableOpacity>
          </View>
          
          {createType === 'exercise' && (
            <>
              <Typography variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: 4 }}>Exercise Name</Typography>
              <TextInput 
                style={styles.input}
                value={createExercise}
                onChangeText={setCreateExercise}
              />
            </>
          )}

          <Typography variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: 4 }}>Target (kg)</Typography>
          <TextInput 
            style={styles.input}
            keyboardType="numeric"
            value={createTarget}
            onChangeText={setCreateTarget}
          />

          <Typography variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: 4 }}>Duration</Typography>
          <View style={styles.pills}>
            <TouchableOpacity 
              style={[styles.pill, createPeriod === 'weekly' && styles.pillActive]}
              onPress={() => setCreatePeriod('weekly')}
            >
              <Typography variant="caption" color={createPeriod === 'weekly' ? colors.primary : colors.textMuted}>Weekly</Typography>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.pill, createPeriod === 'monthly' && styles.pillActive]}
              onPress={() => setCreatePeriod('monthly')}
            >
              <Typography variant="caption" color={createPeriod === 'monthly' ? colors.primary : colors.textMuted}>Monthly</Typography>
            </TouchableOpacity>
          </View>

          <View style={styles.btnRow}>
            <Button variant="outline" style={{ flex: 1 }} onPress={() => setIsCreating(false)}>Cancel</Button>
            <Button variant="primary" style={{ flex: 1 }} onPress={handleCreate}>Create</Button>
          </View>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Typography variant="bodyBold" style={styles.headerTitle}>ACTIVE CHALLENGES</Typography>
        {isAdmin && (
          <Button variant="primary" size="sm" onPress={() => setIsCreating(true)}>
            Create Challenge
          </Button>
        )}
      </View>

      {challenges.length === 0 ? (
        <View style={styles.empty}>
          <Typography variant="body" color={colors.textMuted}>No active challenges.</Typography>
        </View>
      ) : (
        challenges.map(({ challenge, progress }) => {
          const totalProgress = progress.reduce((acc, p) => acc + p.value, 0);
          const percent = Math.min(100, (totalProgress / challenge.target) * 100);
          const isParticipating = profile && challenge.participantIds.includes(profile.id);
          const isExpanded = expandedIds[challenge.id] || false;

          return (
            <Card key={challenge.id} style={styles.card}>
              <View style={styles.challengeHeader}>
                <View style={{ flex: 1 }}>
                  <Typography variant="h2" style={{ textTransform: 'uppercase' }}>{challenge.name}</Typography>
                  <Typography variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                    Ends on {challenge.endDate}
                  </Typography>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {!isParticipating && profile && (
                    <Button variant="primary" size="sm" onPress={() => handleJoin(challenge.id)}>Join</Button>
                  )}
                  {isAdmin && (
                    <Button variant="outline" size="sm" onPress={() => handleDiscard(challenge.id)} style={{ borderColor: 'red' }}>
                      <Typography variant="caption" style={{ color: 'red' }}>Discard</Typography>
                    </Button>
                  )}
                </View>
              </View>

              <Typography variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                Community Progress
              </Typography>

              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
                <View style={styles.progressMeta}>
                  <Typography variant="caption" color={colors.textMuted}>
                    {Math.floor(totalProgress)} / {challenge.target} KG
                  </Typography>
                  <Typography variant="caption" color={colors.textMuted}>
                    {challenge.participantIds.length} participants
                  </Typography>
                </View>
              </View>

              <TouchableOpacity style={styles.expandHeader} onPress={() => toggleLeaderboard(challenge.id)}>
                <Typography variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                  {isExpanded ? 'Hide Leaderboard' : 'Show Leaderboard'}
                </Typography>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.leaderboardSection}>
                  {progress.length === 0 ? (
                    <Typography variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic', marginTop: spacing.sm }}>
                      No one has joined yet.
                    </Typography>
                  ) : (
                    <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                      {progress.map((p, idx) => (
                        <View key={p.userId} style={styles.leaderRow}>
                          <Typography variant="caption" style={styles.rankText}>{idx + 1}.</Typography>
                          <Typography variant="bodyBold" style={{ flex: 1 }}>{p.displayName}</Typography>
                          <Typography variant="bodyBold" color={colors.primary}>
                            {Math.floor(p.value)} kg
                          </Typography>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: TAB_BAR_SPACE },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  headerTitle: { color: colors.textMuted, fontSize: 12, letterSpacing: 1 },
  card: { padding: spacing.md, marginBottom: spacing.sm },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  pillActive: { backgroundColor: 'rgba(72, 187, 149, 0.15)', borderWidth: 1, borderColor: colors.primary },
  input: { backgroundColor: colors.surfaceAlt, color: colors.text, padding: spacing.sm, borderRadius: radius.md, fontSize: 16 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressContainer: { marginTop: spacing.xs, gap: 8 },
  progressBg: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  expandHeader: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, alignItems: 'center' },
  leaderboardSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rankText: { width: 24, fontWeight: '700', color: colors.textMuted }
});
