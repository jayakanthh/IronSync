import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Dumbbell, Clock, X, Check, User } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentUser } from '../../context/CurrentUser';
import {
  acceptInvite,
  declineInvite,
  createSession,
  inviteParticipant,
  subscribeToSession,
} from '../../services/index';
import type { SessionInvite, DuoSession } from '../../models/index';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function DuoInviteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile } = useCurrentUser();

  const mode = route.params?.mode || 'receive'; // 'send' or 'receive'
  const partnerId = route.params?.partnerId;
  const partnerName = route.params?.partnerName;
  const invite: SessionInvite | undefined = route.params?.invite;

  const [busy, setBusy] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [createdInviteId, setCreatedInviteId] = useState<string | null>(null);
  const [sendingState, setSendingState] = useState<'idle' | 'sending' | 'sent' | 'cancelled'>('idle');

  // Guard so we only navigate away once. The session listener and the manual
  // cancel handler can both fire on cancellation — without this the second
  // goBack() logs "GO_BACK was not handled" and re-shows the alert.
  const leftRef = useRef(false);
  const leaveScreen = (alertMsg?: string) => {
    if (leftRef.current) return;
    leftRef.current = true;
    if (alertMsg) Alert.alert('Invitation Cancelled', alertMsg);
    navigation.goBack();
  };

  // If in 'send' mode, handle sending invite on mount
  useEffect(() => {
    if (mode === 'send' && partnerId && profile) {
      sendInvite();
    }
  }, [mode, partnerId, profile]);

  // If in 'send' mode and invite is sent, listen for acceptance
  useEffect(() => {
    if (!createdSessionId || sendingState !== 'sent') return;

    const unsub = subscribeToSession(createdSessionId, (session) => {
      // If the partner accepts, the session state transitions to 'lobby' or 'active'
      if (session.state === 'lobby' || session.state === 'active') {
        unsub();
        navigation.replace('DuoLobby', { sessionId: createdSessionId });
      } else if (session.state === 'cancelled') {
        unsub();
        // Only alerts if we haven't already left (e.g. the OTHER party cancelled).
        leaveScreen('The invitation was cancelled.');
      }
    }, (err) => {
      console.error("Error listening to session:", err);
    });

    return () => unsub();
  }, [createdSessionId, sendingState]);

  const sendInvite = async () => {
    if (!profile || !partnerId) return;
    setSendingState('sending');
    setBusy(true);
    try {
      // 1. Create a Duo Workout session (in pending state)
      const sessionId = await createSession(profile.id, profile.displayName || 'Creator', {
        type: 'duo',
        planName: 'Duo Workout',
        exerciseIds: [], // Empty initially, added dynamically in logger/picker
        exerciseNames: [],
      });
      setCreatedSessionId(sessionId);

      // 2. Invite the partner
      const dummySession: DuoSession = {
        id: sessionId,
        type: 'duo',
        creatorId: profile.id,
        exerciseIds: [],
        exerciseNames: [],
        state: 'pending',
        createdAt: Date.now(),
        participants: {
          [profile.id]: {
            displayName: profile.displayName || 'Creator',
            state: 'accepted',
            isReady: false,
            currentExerciseIndex: 0,
            currentSetIndex: 0,
            lastSeen: Date.now(),
          }
        },
      };

      const inviteId = await inviteParticipant(sessionId, dummySession, {
        id: partnerId,
        name: partnerName || 'Friend'
      });
      setCreatedInviteId(inviteId);
      setSendingState('sent');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Could not send invitation.');
      setSendingState('idle');
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (createdInviteId) {
        await updateDoc(doc(db, 'sessionInvites', createdInviteId), { state: 'cancelled' });
      }
      if (createdSessionId) {
        await updateDoc(doc(db, 'duoSessions', createdSessionId), { state: 'cancelled' });
      }
      setSendingState('cancelled');
      leaveScreen(); // no alert — the user initiated this
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Could not cancel invitation.');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      await acceptInvite(invite.id, invite);
      navigation.replace('DuoLobby', { sessionId: invite.sessionId });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not accept invitation.');
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      await declineInvite(invite.id, invite);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not decline invitation.');
      setBusy(false);
    }
  };

  if (mode === 'send') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.cardWrapper}>
          <Card style={styles.inviteCard}>
            <Typography variant="caption" color={colors.primary} style={styles.tag}>
              INVITE TO DUO
            </Typography>

            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <User size={32} color={colors.primary} />
              </View>
            </View>

            <Typography variant="h1" style={styles.title}>
              {partnerName}
            </Typography>

            <Typography variant="body" color={colors.textMuted} style={{ textAlign: 'center', marginHorizontal: 12 }}>
              "Train together and track your workouts separately."
            </Typography>

            {sendingState === 'sending' && (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            )}

            {sendingState === 'sent' && (
              <View style={styles.waitingBox}>
                <ActivityIndicator color={colors.primary} size="small" style={{ marginBottom: spacing.xs }} />
                <Typography variant="bodyBold" color={colors.primary} style={{ textAlign: 'center' }}>
                  DUO INVITE SENT
                </Typography>
                <Typography variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: 4 }}>
                  Waiting for {partnerName} to accept...
                </Typography>
              </View>
            )}

            <View style={styles.btnRow}>
              <Button
                variant="outline"
                onPress={handleCancelInvite}
                disabled={busy && sendingState !== 'sent'}
                style={[styles.btn, { borderColor: colors.danger }]}
              >
                <X size={16} color={colors.danger} style={{ marginRight: 6 }} />
                <Typography variant="bodyBold" color={colors.danger}>
                  {sendingState === 'sent' ? 'Cancel Invite' : 'Cancel'}
                </Typography>
              </Button>
            </View>
          </Card>
        </View>
      </View>
    );
  }

  // Receive mode
  if (!invite) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.cardWrapper}>
        <Card style={styles.inviteCard}>
          <Typography variant="caption" color={colors.primary} style={styles.tag}>
            DUO WORKOUT INVITE
          </Typography>

          <Typography variant="h1" style={styles.title}>
            {invite.fromUserName} invited you to train together!
          </Typography>

          <View style={styles.workoutPreview}>
            <View style={styles.row}>
              <Dumbbell size={18} color={colors.textMuted} />
              <Typography variant="bodyBold">
                {invite.planName || 'Duo Workout'}
              </Typography>
            </View>
            <View style={styles.row}>
              <Clock size={18} color={colors.textMuted} />
              <Typography variant="body" color={colors.textMuted}>
                Train together and track your exercises separately.
              </Typography>
            </View>
          </View>

          <View style={styles.btnRow}>
            <Button
              variant="outline"
              onPress={handleDecline}
              disabled={busy}
              style={[styles.btn, { borderColor: colors.danger }]}
            >
              <X size={16} color={colors.danger} style={{ marginRight: 6 }} />
              <Typography variant="bodyBold" color={colors.danger}>Decline</Typography>
            </Button>

            <Button
              variant="primary"
              onPress={handleAccept}
              disabled={busy}
              style={styles.btn}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <>
                  <Check size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                  Accept
                </>
              )}
            </Button>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(14, 16, 18, 0.95)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  cardWrapper: {
    alignItems: 'center',
  },
  inviteCard: {
    width: '100%',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  tag: {
    letterSpacing: 2,
    fontWeight: '800',
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  avatarWrap: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutPreview: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
  },
  waitingBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
