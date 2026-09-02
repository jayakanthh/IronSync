import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, ChevronRight, Timer, Plus, Minus, User } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentUser } from '../../context/CurrentUser';
import {
  subscribeToSession,
  logMySet,
  finishMyWorkout,
  startResting,
  doneResting,
  heartbeat,
} from '../../services/index';
import type { DuoSession } from '../../models/index';

export default function GroupWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile } = useCurrentUser();
  const { sessionId } = route.params;

  const [session, setSession] = useState<DuoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  const [mySets, setMySets] = useState<{ weightKg: number; reps: number; completed: boolean }[]>([
    { weightKg: 60, reps: 10, completed: false },
    { weightKg: 60, reps: 10, completed: false },
    { weightKg: 60, reps: 10, completed: false },
  ]);

  const [restSeconds, setRestSeconds] = useState(0);
  const [showRestModal, setShowRestModal] = useState(false);
  const restTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!profile || !sessionId) return;
    const interval = setInterval(() => {
      heartbeat(sessionId, profile.id);
    }, 10000);
    return () => clearInterval(interval);
  }, [profile, sessionId]);

  useEffect(() => {
    const unsub = subscribeToSession(sessionId, (updated) => {
      setSession(updated);
      setLoading(false);
    });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (restSeconds > 0) {
      restTimerRef.current = setTimeout(() => {
        setRestSeconds((prev) => prev - 1);
      }, 1000);
    } else {
      setShowRestModal(false);
      if (profile && sessionId) doneResting(sessionId, profile.id);
    }
    return () => clearTimeout(restTimerRef.current);
  }, [restSeconds]);

  const handleLogSet = async (setIdx: number) => {
    if (!profile || !session) return;
    const set = mySets[setIdx];
    const isCompleted = !set.completed;

    const updated = [...mySets];
    updated[setIdx].completed = isCompleted;
    setMySets(updated);

    if (isCompleted) {
      try {
        const exerciseId = session.exerciseIds[activeExerciseIndex];
        const exerciseName = session.exerciseNames[activeExerciseIndex];
        await logMySet(sessionId, profile.id, activeExerciseIndex, {
          exerciseId,
          exerciseName,
          setIndex: setIdx,
          weightKg: set.weightKg,
          reps: set.reps,
          completedAt: Date.now(),
        });
        startRestTimer(90);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const startRestTimer = (secs: number) => {
    if (!profile || !sessionId) return;
    setRestSeconds(secs);
    setShowRestModal(true);
    startResting(sessionId, profile.id, secs);
  };

  const handleSkipRest = () => {
    setRestSeconds(0);
    setShowRestModal(false);
    if (profile && sessionId) doneResting(sessionId, profile.id);
  };

  const handleAddSet = () => {
    const lastSet = mySets[mySets.length - 1] || { weightKg: 60, reps: 10, completed: false };
    setMySets([...mySets, { weightKg: lastSet.weightKg, reps: lastSet.reps, completed: false }]);
  };

  const handleRemoveSet = () => {
    if (mySets.length > 1) setMySets(mySets.slice(0, -1));
  };

  const handleFinish = () => {
    Alert.alert('Finish Workout?', 'Are you sure you want to end your workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          if (!profile || !session) return;
          try {
            await finishMyWorkout(sessionId, profile.id, session);
            // DuoComplete lives inside DuoStack; this screen is on the root
            // stack, so it has to be addressed through its navigator.
            navigation.replace('DuoStack', { screen: 'DuoComplete', params: { sessionId } });
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  if (loading || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeExerciseName = session.exerciseNames[activeExerciseIndex];
  const participants = Object.entries(session.participants);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="bodyBold" color={colors.primary}>SQUAD ACTIVE WORKOUT</Typography>
        <TouchableOpacity onPress={handleFinish} style={styles.finishBtn}>
          <Typography variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
            FINISH
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Participant Horizontal Status Strip */}
      <View style={styles.statusStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScroll}>
          {participants.map(([uid, p]) => {
            const isMe = uid === profile?.id;
            const statusColor =
              p.state === 'done' ? colors.milestone :
              p.state === 'resting' ? colors.warning :
              colors.primary;

            return (
              <View key={uid} style={[styles.statusItem, isMe && styles.statusItemMe]}>
                <View style={[styles.avatarDot, { backgroundColor: statusColor }]} />
                <Typography style={{ fontSize: 11, fontWeight: '700' }}>
                  {isMe ? 'You' : p.displayName}
                </Typography>
                <Typography style={{ fontSize: 9, color: colors.textMuted }}>
                  {p.state.toUpperCase()} (Ex {p.currentExerciseIndex + 1})
                </Typography>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Exercise selector */}
      <View style={styles.exerciseSelector}>
        <TouchableOpacity
          disabled={activeExerciseIndex === 0}
          onPress={() => {
            setActiveExerciseIndex((prev) => prev - 1);
            setMySets([
              { weightKg: 60, reps: 10, completed: false },
              { weightKg: 60, reps: 10, completed: false },
              { weightKg: 60, reps: 10, completed: false },
            ]);
          }}
          style={styles.navArrow}
        >
          <ChevronLeft size={24} color={activeExerciseIndex === 0 ? colors.textMuted : colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Typography variant="h2" style={{ textAlign: 'center' }}>{activeExerciseName}</Typography>
          <Typography variant="caption" color={colors.textMuted}>
            Exercise {activeExerciseIndex + 1} of {session.exerciseIds.length}
          </Typography>
        </View>

        <TouchableOpacity
          disabled={activeExerciseIndex === session.exerciseIds.length - 1}
          onPress={() => {
            setActiveExerciseIndex((prev) => prev + 1);
            setMySets([
              { weightKg: 60, reps: 10, completed: false },
              { weightKg: 60, reps: 10, completed: false },
              { weightKg: 60, reps: 10, completed: false },
            ]);
          }}
          style={styles.navArrow}
        >
          <ChevronRight size={24} color={activeExerciseIndex === session.exerciseIds.length - 1 ? colors.textMuted : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Logging Column */}
      <ScrollView contentContainerStyle={styles.logScroll}>
        {mySets.map((set, idx) => (
          <Card key={idx} style={[styles.setCard, set.completed && styles.setCardCompleted]}>
            <View style={styles.setRowHeader}>
              <Typography variant="caption">SET {idx + 1}</Typography>
              <TouchableOpacity onPress={() => handleLogSet(idx)}>
                <View style={[styles.checkBox, set.completed && styles.checkBoxChecked]}>
                  {set.completed && <Check size={12} color={colors.primaryDark} />}
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Typography style={{ fontSize: 10, color: colors.textMuted }}>KG</Typography>
                <TextInput
                  style={styles.setValInput}
                  keyboardType="numeric"
                  value={String(set.weightKg)}
                  onChangeText={(val) => {
                    const next = [...mySets];
                    next[idx].weightKg = parseFloat(val) || 0;
                    setMySets(next);
                  }}
                  editable={!set.completed}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Typography style={{ fontSize: 10, color: colors.textMuted }}>REPS</Typography>
                <TextInput
                  style={styles.setValInput}
                  keyboardType="numeric"
                  value={String(set.reps)}
                  onChangeText={(val) => {
                    const next = [...mySets];
                    next[idx].reps = parseInt(val, 10) || 0;
                    setMySets(next);
                  }}
                  editable={!set.completed}
                />
              </View>
            </View>
          </Card>
        ))}

        <View style={styles.stepperRow}>
          <TouchableOpacity onPress={handleRemoveSet} style={styles.stepperBtn}>
            <Minus size={16} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddSet} style={styles.stepperBtn}>
            <Plus size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rest Timer Modal */}
      <Modal visible={showRestModal} transparent animationType="slide">
        <View style={styles.restModalOverlay}>
          <Card style={styles.restCard}>
            <Typography variant="h1" style={{ alignSelf: 'center' }}>REST TIME</Typography>
            <Typography variant="h2" style={{ fontSize: 32, alignSelf: 'center', fontWeight: '800' }}>
              {Math.floor(restSeconds / 60)}:{(restSeconds % 60).toString().padStart(2, '0')}
            </Typography>
            <View style={styles.restActions}>
              <Button variant="outline" onPress={() => setRestSeconds((prev) => prev + 30)} style={{ flex: 1 }}>
                +30s
              </Button>
              <Button variant="primary" onPress={handleSkipRest} style={{ flex: 1 }}>
                Skip
              </Button>
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  finishBtn: {
    backgroundColor: 'rgba(72, 187, 149, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  statusStrip: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  statusScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  statusItemMe: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  avatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  exerciseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  navArrow: {
    padding: spacing.xs,
  },
  logScroll: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  setCard: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  setCardCompleted: {
    borderColor: colors.primary,
  },
  setRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  setValInput: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  restCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  restActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
