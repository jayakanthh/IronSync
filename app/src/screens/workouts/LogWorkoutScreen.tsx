import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  X,
  Play,
  Check,
  Timer,
  MoreVertical,
  Plus,
  Minus,
  Award,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Trash2,
  Bookmark,
  Info,
  Layers,
  ArrowUp,
  ArrowDown,
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  Zap,
} from 'lucide-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, radius, spacing } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import ExercisePicker from '../../components/common/ExercisePicker';
import type { Exercise, Community, PersonalRecord, DuoSession, ParticipantSetLog } from '../../models/index';
import {
  currentUserId,
  getExercises,
  searchExercises,
  logWorkout,
  setMemberTrainingStatus,
  getPreviousPerformance,
  getMyCommunities,
  shareWorkoutToCommunity,
  getExercisesByIds,
  subscribeToSession,
  subscribeToParticipantSets,
  logMySet,
  finishMyWorkout,
  startResting,
  doneResting,
  heartbeat,
} from '../../services/index';
import { useCurrentUser } from '../../context/CurrentUser';
import SwipeToDelete from '../../components/common/SwipeToDelete';
import { useActiveWorkout } from '../../context/ActiveWorkout';
import MuscleSilhouette, { aggregateMusclesFromExercises } from '../../components/common/MuscleSilhouette';

import {
  getUnitSystem,
  convertWeightToDisplay,
  convertWeightToCanonical,
  convertKmToDisplay,
  convertKmToCanonical,
  getWeightUnit,
  getDistanceUnit
} from '../../utils/formatting/units';

interface LoggedSet {
  setNumber: number;
  targetReps: string;
  kg: number;
  reps: number;
  completed: boolean;
  setType?: 'warmup' | 'working' | 'drop' | 'superset' | 'giant_set';
  groupId?: string;
  groupType?: 'superset' | 'giant_set';
  
  // Cardio & Duration fields
  durationMinutes?: number;
  durationSeconds?: number;
  distanceKm?: number;
  caloriesBurned?: number;

  weightInputStr?: string;
  distanceInputStr?: string;
}

interface LoggedExercise {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
  muscleGroup?: string;
  secondaryMuscles?: string[];
  previousPerformance?: string[];
  groupId?: string;
  groupType?: 'superset' | 'giant_set';
  
  // Adaptive UI configurations
  trackingType?: string;
  category?: string;
}

export default function LogWorkoutScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void; navigate: (screen: string, params?: any) => void };
  route?: {
    params?: {
      exercises?: Array<{ exerciseId: string; name: string; targetSets?: number; targetReps?: number }>;
      sourceLabel?: string;
      sessionId?: string;
    };
  };
}) {
  const { refresh, profile } = useCurrentUser();
  const activeWorkout = useActiveWorkout();
  const insets = useSafeAreaInsets();

  const buildInitialItems = useCallback((): LoggedExercise[] => {
    const paramExercises = route?.params?.exercises;
    if (!paramExercises || paramExercises.length === 0) return [];
    return paramExercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: Array.from({ length: ex.targetSets ?? 3 }, (_, i) => ({
        setNumber: i + 1,
        targetReps: ex.targetReps ? `${ex.targetReps}` : '10',
        kg: 40,
        reps: ex.targetReps ?? 10,
        completed: false,
        setType: 'working',
        durationMinutes: 0,
        durationSeconds: 0,
        distanceKm: 0,
        caloriesBurned: 0,
      })),
    }));
  }, [route]);

  const [items, setItems] = useState<LoggedExercise[]>(() => buildInitialItems());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [confettiCount, setConfettiCount] = useState(0);

  // Time & Pause States
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);

  // Rest Timer States
  const [restSeconds, setRestSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Modals & Menu Popups
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showExerciseOptions, setShowExerciseOptions] = useState<string | null>(null);
  const [showGroupPicker, setShowGroupPicker] = useState<{ exerciseId: string; type: 'superset' | 'giant_set' } | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);

  // Sharing states
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [postingState, setPostingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [postCaption, setPostCaption] = useState('');
  const [postStep, setPostStep] = useState<'summary' | 'select_community' | 'preview'>('summary');

  // Duo session coordination state
  const sessionId = route?.params?.sessionId;
  const [duoSession, setDuoSession] = useState<DuoSession | null>(null);
  const [partnerSets, setPartnerSets] = useState<ParticipantSetLog[]>([]);
  const [partnerExercises, setPartnerExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    const ids = Array.from(new Set(partnerSets.map((s) => s.exerciseId)));
    if (ids.length === 0) {
      setPartnerExercises([]);
      return;
    }
    getExercisesByIds(ids).then((exs) => {
      setPartnerExercises(exs);
    }).catch(console.error);
  }, [partnerSets]);

  const partnerMuscles = useMemo(() => {
    return aggregateMusclesFromExercises(partnerExercises);
  }, [partnerExercises]);

  const partnerUid = duoSession ? Object.keys(duoSession.participants).find((id) => id !== profile?.id) || '' : '';
  const partnerMeta = duoSession?.participants[partnerUid];
  const partnerDisconnected = partnerMeta ? (Date.now() - partnerMeta.lastSeen > 30000) : false;

  const partnerExerciseName = useMemo(() => {
    if (!duoSession || !partnerMeta) return '';
    const idx = partnerMeta.currentExerciseIndex;
    if (idx >= 0 && idx < duoSession.exerciseIds.length) {
      return duoSession.exerciseNames[idx];
    }
    return '';
  }, [duoSession, partnerMeta]);

  // Heartbeat ticker
  useEffect(() => {
    if (!sessionId || !profile) return;
    heartbeat(sessionId, profile.id).catch(console.error);
    const interval = setInterval(() => {
      heartbeat(sessionId, profile.id).catch(console.error);
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionId, profile]);

  // Session Subscription
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToSession(sessionId, (updated) => {
      setDuoSession(updated);
      
      // Sync clock to session startedAt
      if (updated.startedAt) {
        const elapsed = Math.floor((Date.now() - updated.startedAt) / 1000);
        setElapsedSeconds(elapsed);
      }
    });
    return () => unsub();
  }, [sessionId]);

  // Partner Sets Subscription
  useEffect(() => {
    if (!sessionId || !partnerUid) return;
    const unsub = subscribeToParticipantSets(sessionId, partnerUid, (sets) => {
      setPartnerSets(sets);
    });
    return () => unsub();
  }, [sessionId, partnerUid]);

  // Dynamic layout measurements for responsive SVGs
  const windowWidth = Dimensions.get('window').width;
  const silhouetteSize = Math.floor((windowWidth - 48) / 2);



  // Fetch full exercise metadata (trackingType, muscleGroup, secondaryMuscles) dynamically in batches
  useEffect(() => {
    const missing = items.filter((item) => !item.muscleGroup || !item.trackingType);
    if (missing.length === 0) return;

    getExercisesByIds(missing.map((m) => m.exerciseId)).then((exList) => {
      const exMap = new Map(exList.map((e) => [e.id, e]));
      setItems((prevItems) =>
        prevItems.map((pi) => {
          const fullEx = exMap.get(pi.exerciseId);
          if (fullEx) {
            return {
              ...pi,
              muscleGroup: fullEx.muscleGroup,
              secondaryMuscles: fullEx.secondaryMuscles,
              trackingType: fullEx.trackingType || 'weight_reps',
              category: fullEx.category || 'strength',
            };
          }
          return pi;
        })
      );
    });
  }, [items]);

  // Elapsed timer ticker (survives screen navigation/picker open)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!paused) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [paused]);

  // Rest Timer Ticker
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (sessionId && profile) {
              doneResting(sessionId, profile.id).catch(console.error);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, restSeconds, sessionId, profile]);

  // Load previous performance history per exercise
  useEffect(() => {
    if (!profile) return;
    items.forEach((item) => {
      if (item.previousPerformance === undefined) {
        getPreviousPerformance(profile.id, item.exerciseId).then((prev) => {
          setItems((prevItems) =>
            prevItems.map((pi) =>
              pi.exerciseId === item.exerciseId
                ? { ...pi, previousPerformance: prev.length > 0 ? prev : ['No previous logs'] }
                : pi
            )
          );
        });
      }
    });
  }, [items, profile]);

  // Sync Training Now presence status to joined communities
  useEffect(() => {
    if (!profile || !profile.communityIds) return;
    const ids = profile.communityIds;
    const uid = profile.id;
    const activeIds = items.map((i) => i.exerciseId);

    ids.forEach((cid) => {
      setMemberTrainingStatus(cid, uid, true, route?.params?.sourceLabel || 'Solo Workout', activeIds).catch(console.error);
    });

    return () => {
      ids.forEach((cid) => {
        setMemberTrainingStatus(cid, uid, false).catch(console.error);
      });
    };
  }, [profile, items, route?.params?.sourceLabel]);

  // Hardware Back Button listener
  // Robust dismissal: if this logger was navigated to directly (e.g. from Home
  // via the tab), there may be no back entry, so goBack() silently no-ops and
  // the screen gets "stuck". Fall back to the Workouts home in that case.
  const dismiss = useCallback(() => {
    const nav = navigation as any;
    const index = nav.getState?.()?.index ?? 0;

    // Opened straight from another tab, this can be the ONLY route in the
    // Workouts stack. POP_TO_TOP then has nothing to pop, goes unhandled by
    // every navigator, and the screen stays stuck — so swap it out instead.
    if (index === 0) {
      if (typeof nav.replace === 'function') nav.replace('WorkoutsHome');
      else nav.navigate('WorkoutsHome');
      return;
    }

    // popToTop clears this screen off the Workouts stack. Plain goBack() can
    // return to the *Home tab* while leaving the finished/discarded session on
    // the stack — so tapping Workouts later would restore the stale session.
    if (typeof nav.popToTop === 'function') {
      nav.popToTop();
    } else if (typeof nav.canGoBack === 'function' && nav.canGoBack()) {
      nav.goBack();
    } else {
      nav.navigate('WorkoutsHome');
    }
  }, [navigation]);

  const handleDiscardWorkout = useCallback(async () => {
    setIsTimerRunning(false);
    setRestSeconds(0);
    setPaused(true);

    if (profile && profile.communityIds) {
      try {
        await Promise.all(
          profile.communityIds.map((cid) =>
            setMemberTrainingStatus(cid, profile.id, false)
          )
        );
      } catch (e) {
        console.error(e);
      }
    }

    setItems([]);
    dismiss();
  }, [profile, dismiss]);

  /**
   * Step away without losing the session: switch to another tab. This screen
   * stays mounted on the Workouts stack, so the timer, sets and everything
   * else survive; the mini bar offers Resume and Discard from wherever you go.
   */
  const handleMinimize = useCallback(() => {
    activeWorkout.minimize();
    const parent = (navigation as any).getParent?.();
    if (parent) parent.navigate('Home');
  }, [activeWorkout, navigation]);

  /**
   * Tell the rest of the app a workout is running: it powers the mini bar and
   * hides "Start New Workout" while this is open. Unmounting means the session
   * is genuinely over (finished or discarded) — minimising keeps us mounted.
   */
  useEffect(() => {
    activeWorkout.begin(route?.params?.sourceLabel || 'Workout');
    return () => activeWorkout.end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Let the mini bar's Discard run this screen's own teardown. */
  useEffect(() => {
    activeWorkout.registerDiscard(() => { handleDiscardWorkout(); });
    return () => activeWorkout.registerDiscard(null);
  }, [activeWorkout, handleDiscardWorkout]);

  /** Back on this screen by any route (mini bar or the tab) — hide the bar. */
  useFocusEffect(
    useCallback(() => {
      activeWorkout.restore();
    }, [activeWorkout]),
  );

  const handleBackPress = useCallback(() => {
    Alert.alert(
      'Discard Workout?',
      'Are you sure you want to discard this active workout session? All current training progress will be lost.',
      [
        { text: 'Keep Workout', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: handleDiscardWorkout },
      ]
    );
  }, [handleDiscardWorkout]);

  useEffect(() => {
    const onBackPress = () => {
      handleBackPress();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  // Calculations
  const totalVolume = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + item.sets.filter((s) => s.completed).reduce((sSum, s) => sSum + (s.kg || 0) * (s.reps || 0), 0);
    }, 0);
  }, [items]);

  const totalCompletedSets = useMemo(() => {
    return items.reduce((sum, item) => sum + item.sets.filter((s) => s.completed).length, 0);
  }, [items]);

  // Formatter helpers
  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // State modifiers
  const addExercise = (ex: Exercise) => {
    if (items.some((i) => i.exerciseId === ex.id)) return;
    setItems((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        trackingType: ex.trackingType || 'weight_reps',
        category: ex.category || 'strength',
        sets: [{ setNumber: 1, targetReps: '10', kg: 40, reps: 10, completed: false, setType: 'working', durationMinutes: 0, durationSeconds: 0, distanceKm: 0, caloriesBurned: 0 }],
      },
    ]);
    setPickerOpen(false);

    if (sessionId) {
      updateDoc(doc(db, 'duoSessions', sessionId), {
        exerciseIds: arrayUnion(ex.id),
        exerciseNames: arrayUnion(ex.name)
      }).catch((err) => console.error("Error updating duo session exercise board:", err));
    }
  };

  const removeExercise = (exerciseId: string) => {
    setItems((prev) => prev.filter((i) => i.exerciseId !== exerciseId));
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setItems(updated);
  };

  const addSet = (id: string, setType: LoggedSet['setType'] = 'working') => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.exerciseId !== id) return i;
        const last = i.sets[i.sets.length - 1];
        return {
          ...i,
          sets: [
            ...i.sets,
            {
              setNumber: i.sets.length + 1,
              targetReps: last ? last.targetReps : '10',
              kg: last ? last.kg : 40,
              reps: last ? last.reps : 10,
              completed: false,
              setType,
              durationMinutes: last ? last.durationMinutes : 0,
              durationSeconds: last ? last.durationSeconds : 0,
              distanceKm: last ? last.distanceKm : 0,
              caloriesBurned: last ? last.caloriesBurned : 0,
            },
          ],
        };
      })
    );
  };

  /**
   * Remove one set and renumber the rest. No confirm dialog: you have to swipe
   * the row open and then tap Delete, which is deliberate enough on its own.
   */
  const removeSet = (exIndex: number, setIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== exIndex) return item;
        return {
          ...item,
          sets: item.sets
            .filter((_, idx) => idx !== setIdx)
            .map((s, idx) => ({ ...s, setNumber: idx + 1 })),
        };
      }),
    );
  };

  const addDropAction = (exIndex: number, setIdx: number) => {
    const updated = [...items];
    const parentSet = updated[exIndex].sets[setIdx];
    const scaledWeight = Math.round(parentSet.kg * 0.8); // 80% load drop set default
    
    updated[exIndex].sets.splice(setIdx + 1, 0, {
      setNumber: updated[exIndex].sets.length + 1,
      targetReps: parentSet.targetReps,
      kg: scaledWeight,
      reps: parentSet.reps,
      completed: false,
      setType: 'drop',
    });

    // Re-index set numbers
    updated[exIndex].sets.forEach((s, idx) => {
      s.setNumber = idx + 1;
    });

    setItems(updated);
  };

  const system = getUnitSystem(profile);

  const updateSetWeight = (exIndex: number, setIndex: number, textVal: string) => {
    const updated = [...items];
    const targetSet = updated[exIndex].sets[setIndex];
    if (targetSet) {
      targetSet.weightInputStr = textVal;
      const num = parseFloat(textVal) || 0;
      targetSet.kg = Math.max(0, convertWeightToCanonical(num, system));
    }
    setItems(updated);
  };

  const updateSetReps = (exIndex: number, setIndex: number, newReps: number) => {
    const updated = [...items];
    const targetSet = updated[exIndex].sets[setIndex];
    if (targetSet) {
      targetSet.reps = Math.max(0, newReps);
    }
    setItems(updated);
  };

  const updateSetType = (exIndex: number, setIndex: number, type: LoggedSet['setType']) => {
    const updated = [...items];
    const targetSet = updated[exIndex].sets[setIndex];
    if (targetSet) {
      targetSet.setType = type;
    }
    setItems(updated);
  };

  const updateSetDuration = (exIndex: number, setIndex: number, min: number, sec: number) => {
    const updated = [...items];
    const targetSet = updated[exIndex].sets[setIndex];
    if (targetSet) {
      targetSet.durationMinutes = Math.max(0, min);
      targetSet.durationSeconds = Math.max(0, Math.min(59, sec));
    }
    setItems(updated);
  };

  const updateSetDistance = (exIndex: number, setIndex: number, textVal: string) => {
    const updated = [...items];
    const targetSet = updated[exIndex].sets[setIndex];
    if (targetSet) {
      targetSet.distanceInputStr = textVal;
      const num = parseFloat(textVal) || 0;
      targetSet.distanceKm = Math.max(0, convertKmToCanonical(num, system));
    }
    setItems(updated);
  };

  const handleDoneSet = (exIndex: number, setIndex: number) => {
    const updated = [...items];
    const currentEx = updated[exIndex];
    const targetSet = currentEx.sets[setIndex];
    
    if (targetSet) {
      const nextCompleted = !targetSet.completed;
      targetSet.completed = nextCompleted;

      // Trigger Rest timer only on set completions, matching linked group states
      if (nextCompleted) {
        if (sessionId && profile) {
          logMySet(sessionId, profile.id, exIndex, {
            exerciseId: currentEx.exerciseId,
            exerciseName: currentEx.name,
            setIndex: setIndex,
            weightKg: targetSet.kg || 0,
            reps: targetSet.reps || 0,
            completedAt: Date.now(),
          }).catch((err) => console.error("Error logging set in duo:", err));
        }

        let shouldStartRest = true;
        if (currentEx.groupId) {
          const groupExes = updated.filter((x) => x.groupId === currentEx.groupId);
          const lastEx = groupExes[groupExes.length - 1];
          if (lastEx.exerciseId !== currentEx.exerciseId) {
            shouldStartRest = false;
          }
        }

        if (shouldStartRest) {
          setRestSeconds(90);
          setIsTimerRunning(true);
          if (sessionId && profile) {
            startResting(sessionId, profile.id, 90).catch((err) => console.error("Error starting rest in duo:", err));
          }
        }
      }
    }
    setItems(updated);
  };

  // Grouping sets logic
  const createGroup = (id: string, type: 'superset' | 'giant_set', targetIds: string[]) => {
    const gid = `${type}-${Date.now()}`;
    setItems((prev) =>
      prev.map((i) => {
        if (i.exerciseId === id || targetIds.includes(i.exerciseId)) {
          return { ...i, groupId: gid, groupType: type };
        }
        return i;
      })
    );
  };

  const breakGroup = (gid: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.groupId === gid) {
          return { ...i, groupId: undefined, groupType: undefined };
        }
        return i;
      })
    );
  };

  // Indestructible Save Pipeline
  const save = async () => {
    const uid = currentUserId();
    if (!uid) return;

    if (items.length === 0) return setError('Add at least one exercise.');

    const loggedExercises = items.filter((ex) => ex.sets.some((s) => s.completed));
    if (loggedExercises.length === 0) {
      return Alert.alert('Cannot Save', 'Please complete at least one working set before saving your workout.');
    }

    setError(null);
    setSaving(true);
    try {
      const entries = loggedExercises.map((i) => ({
        exerciseId: i.exerciseId,
        sets: i.sets
          .filter((s) => s.completed)
          .map((s) => ({
            reps: s.reps,
            weightKg: s.kg,
            setType: s.setType || 'working',
            groupId: s.groupId,
            groupType: s.groupType,
            
            // Cardio & Duration fields
            durationMinutes: s.durationMinutes,
            durationSeconds: s.durationSeconds,
            distanceKm: s.distanceKm,
            caloriesBurned: s.caloriesBurned,
          })),
      }));

      const result = await logWorkout(uid, {
        date: new Date().toISOString(),
        entries,
        notes,
        planName: route?.params?.sourceLabel || (sessionId ? 'Duo Workout' : 'Free Workout'),
        durationMinutes: Math.round(elapsedSeconds / 60),
        totalVolumeKg: totalVolume,
        workoutType: sessionId ? 'duo' : 'solo',
        sessionId: sessionId || undefined,
        duoPartnerId: sessionId ? partnerUid : undefined,
        duoPartnerName: sessionId ? (partnerMeta?.displayName || 'Partner') : undefined,
      });

      if (sessionId && duoSession) {
        await finishMyWorkout(sessionId, uid, duoSession);
      }

      await refresh();

      // Clean up local timer states immediately on successful save
      setPaused(true);
      setIsTimerRunning(false);
      setRestSeconds(0);

      // Clean up training presence status
      if (profile && profile.communityIds) {
        profile.communityIds.forEach((cid) => {
          setMemberTrainingStatus(cid, profile.id, false).catch(console.error);
        });
      }

      if (sessionId) {
        setSaving(false);
        setShowFinishModal(false);
        navigation.navigate('DuoStack', {
          screen: 'DuoComplete',
          params: { sessionId }
        });
        return;
      }

      // Load user communities for sharing preview
      if (profile && profile.communityIds && profile.communityIds.length > 0) {
        try {
          const joined = await getMyCommunities(profile.communityIds);
          setMyCommunities(joined);
        } catch (e) {
          console.error(e);
        }
      }

      setSavedWorkoutId(result.workoutId || 'temp-id');
      setShowFinishModal(false);
      setPostStep('summary');
    } catch (e: any) {
      setSaving(false);
      const errMsg = e?.message || 'Could not save session';
      setError(errMsg);
      Alert.alert(
        "Couldn't save workout",
        `${errMsg}\n\nWould you like to retry or keep the workout open to try later?`,
        [
          { text: 'Keep Workout Open', style: 'cancel' },
          { text: 'Retry Save', onPress: () => save() },
        ]
      );
    }
  };

  const handleFinishPress = () => {
    const hasIncomplete = items.some((ex) => ex.sets.some((s) => !s.completed));
    if (hasIncomplete) {
      Alert.alert(
        'Finish workout?',
        'You have incomplete sets remaining. Do you want to finish anyway?',
        [
          { text: 'Continue Workout', style: 'cancel' },
          { text: 'Finish Anyway', onPress: () => save() },
        ]
      );
    } else {
      save();
    }
  };

  const handlePublishPost = async () => {
    if (!profile || !savedWorkoutId || !selectedCommunityId || postingState === 'loading') return;
    setPostingState('loading');
    try {
      const payload = {
        authorId: profile.id,
        authorName: profile.displayName,
        workoutId: savedWorkoutId,
        workoutName: route?.params?.sourceLabel || 'Free Workout',
        workoutDate: new Date().toISOString(),
        durationMinutes: Math.round(elapsedSeconds / 60),
        totalVolumeKg: totalVolume,
        prCount: confettiCount,
        notes: postCaption || notes,
      };

      await shareWorkoutToCommunity(selectedCommunityId, payload);
      setPostingState('success');
      Alert.alert('Success', 'Workout shared to community feed! 🏋️‍♂️', [
        { text: 'Awesome', onPress: () => dismiss() }
      ]);
    } catch (e: any) {
      setPostingState('error');
      Alert.alert(
        'Posting Failed',
        `${e.message || 'Could not share to community.'}\n\nWould you like to retry or skip?`,
        [
          { text: 'Skip', style: 'cancel', onPress: () => dismiss() },
          { text: 'Retry', onPress: () => handlePublishPost() },
        ]
      );
    }
  };

  // ── Completion Summary Screen Overlays ──────────────────────────────────────

  const summaryPrimarySecondaryMuscles = useMemo(() => {
    const completedExs = items.filter((ex) => ex.sets.some((s) => s.completed));
    const list = completedExs.map((ex) => ({
      muscleGroup: ex.muscleGroup || '',
      secondaryMuscles: ex.secondaryMuscles || [],
    }));
    return aggregateMusclesFromExercises(list);
  }, [items]);

  if (savedWorkoutId) {
    if (postStep === 'summary') {
      return (
        <SafeAreaView style={styles.summaryScreen}>
          <ScrollView contentContainerStyle={styles.summaryScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.successIconBox}>
              <Award size={40} color={colors.primary} />
            </View>

            <Typography variant="h1" align="center" style={{ marginTop: 12 }}>Workout Saved! 🎉</Typography>
            <Typography variant="body" color={colors.textMuted} align="center" style={{ marginTop: 4, paddingHorizontal: 24 }}>
              Awesome job! Your session has been safely logged in history.
            </Typography>

            {/* Muscle Silhouette Visualizer - side-by-side FRONT & BACK */}
            <View style={styles.summarySilhouetteCard}>
              <Typography variant="caption" color={colors.textMuted} style={{ fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                MUSCLES TRAINED
              </Typography>
              <View style={styles.summarySilhouetteRow}>
                <View style={styles.summarySilItem}>
                  <Text style={styles.silLabel}>FRONT</Text>
                  <MuscleSilhouette primaryMuscles={summaryPrimarySecondaryMuscles.primary} secondaryMuscles={summaryPrimarySecondaryMuscles.secondary} view="front" size={silhouetteSize - 20} />
                </View>
                <View style={styles.summarySilItem}>
                  <Text style={styles.silLabel}>BACK</Text>
                  <MuscleSilhouette primaryMuscles={summaryPrimarySecondaryMuscles.primary} secondaryMuscles={summaryPrimarySecondaryMuscles.secondary} view="back" size={silhouetteSize - 20} />
                </View>
              </View>
            </View>

            {/* Statistics */}
            <Card style={styles.summaryStatsCard}>
              <View style={styles.summaryStatItem}>
                <Typography variant="caption" color={colors.textMuted}>TIME</Typography>
                <Typography variant="h2">{formatElapsed(elapsedSeconds)}</Typography>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStatItem}>
                <Typography variant="caption" color={colors.textMuted}>VOLUME</Typography>
                <Typography variant="h2">{totalVolume.toLocaleString()} kg</Typography>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStatItem}>
                <Typography variant="caption" color={colors.textMuted}>SETS</Typography>
                <Typography variant="h2" color={colors.primary}>{totalCompletedSets}</Typography>
              </View>
            </Card>

            <Typography variant="bodyBold" style={{ alignSelf: 'flex-start', marginTop: 16, marginBottom: 8 }}>
              Exercises Completed:
            </Typography>
            <View style={{ gap: 8, width: '100%' }}>
              {items
                .filter((ex) => ex.sets.some((s) => s.completed))
                .map((ex, idx) => (
                  <View key={idx} style={styles.summaryExRow}>
                    <Dumbbell size={14} color={colors.primary} />
                    <Typography variant="bodyBold" style={{ flex: 1, marginLeft: 8 }}>{ex.name}</Typography>
                    <Typography variant="body" color={colors.textMuted}>
                      {ex.sets.filter((s) => s.completed).length} sets
                    </Typography>
                  </View>
                ))}
            </View>

            <View style={styles.summaryActions}>
              <Button
                variant="primary"
                label="Post to Community"
                style={{ flex: 1 }}
                onPress={() => setPostStep('select_community')}
              />
              <Button
                variant="outline"
                label="Done"
                style={{ flex: 1 }}
                onPress={() => dismiss()}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (postStep === 'select_community') {
      return (
        <SafeAreaView style={styles.summaryScreen}>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <TouchableOpacity onPress={() => setPostStep('summary')} style={styles.backBtn}>
                <ChevronLeft size={24} color={colors.text} />
              </TouchableOpacity>
              <Typography variant="h2">Select Community</Typography>
              <View style={{ width: 24 }} />
            </View>

            <Typography variant="body" color={colors.textMuted} style={{ marginVertical: 12, textAlign: 'center' }}>
              Choose a crew to share your workout statistics with:
            </Typography>

            <ScrollView style={{ width: '100%', flex: 1 }} contentContainerStyle={{ gap: 12, paddingVertical: 12 }}>
              {myCommunities.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40, gap: 12 }}>
                  <Typography variant="body" color={colors.textMuted} align="center">
                    You haven't joined any communities yet.
                  </Typography>
                  <Button
                    variant="outline"
                    label="Discover Communities"
                    onPress={() => {
                      navigation.navigate('Community', { screen: 'Discover' });
                      navigation.goBack();
                    }}
                  />
                </View>
              ) : (
                myCommunities.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.communitySelectCard}
                    onPress={() => {
                      setSelectedCommunityId(c.id);
                      setPostStep('preview');
                    }}
                  >
                    <View style={styles.avatarMini}>
                      <Text style={styles.avatarMiniText}>{c.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Typography variant="bodyBold">{c.name}</Typography>
                      <Typography variant="caption" color={colors.textMuted}>
                        {c.privacy.toUpperCase()} • {c.memberCount} members
                      </Typography>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Button
              variant="outline"
              label="Cancel"
              style={{ width: '100%', marginTop: 12 }}
              onPress={() => setPostStep('summary')}
            />
          </View>
        </SafeAreaView>
      );
    }

    if (postStep === 'preview') {
      const selectedComm = myCommunities.find((c) => c.id === selectedCommunityId);
      return (
        <SafeAreaView style={styles.summaryScreen}>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <TouchableOpacity onPress={() => setPostStep('select_community')} style={styles.backBtn}>
                <ChevronLeft size={24} color={colors.text} />
              </TouchableOpacity>
              <Typography variant="h2">Post Preview</Typography>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={{ width: '100%', flex: 1 }} contentContainerStyle={{ gap: 16, paddingVertical: 12 }}>
              <Typography variant="caption" color={colors.textMuted}>
                POSTING TO: <Text style={{ color: colors.primary, fontWeight: '700' }}>{selectedComm?.name}</Text>
              </Typography>

              <TextInput
                style={styles.captionInput}
                placeholder="Write a caption... (e.g. Completed leg day!)"
                placeholderTextColor={colors.textMuted}
                value={postCaption}
                onChangeText={setPostCaption}
                multiline
                maxLength={200}
              />

              <Typography variant="caption" color={colors.textMuted}>PREVIEW:</Typography>
              <Card style={styles.previewPostCard}>
                <View style={styles.previewAuthorRow}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>{(profile?.displayName || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ marginLeft: 8 }}>
                    <Typography variant="bodyBold">{profile?.displayName}</Typography>
                    <Typography variant="caption" color={colors.textMuted}>Just completed a workout</Typography>
                  </View>
                </View>

                <Typography variant="h2" style={{ marginVertical: 8 }}>
                  {route?.params?.sourceLabel || 'Free Workout'}
                </Typography>

                <View style={styles.previewStatsRow}>
                  <View style={styles.previewStatItem}>
                    <Typography variant="caption" color={colors.textMuted}>Duration</Typography>
                    <Typography variant="bodyBold">{formatElapsed(elapsedSeconds)}</Typography>
                  </View>
                  <View style={styles.previewStatItem}>
                    <Typography variant="caption" color={colors.textMuted}>Volume</Typography>
                    <Typography variant="bodyBold">{totalVolume.toLocaleString()} kg</Typography>
                  </View>
                  <View style={styles.previewStatItem}>
                    <Typography variant="caption" color={colors.textMuted}>Sets</Typography>
                    <Typography variant="bodyBold">{totalCompletedSets}</Typography>
                  </View>
                </View>

                {/* Miniature Muscle Silhouette inside the post card */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 }}>
                  <MuscleSilhouette primaryMuscles={summaryPrimarySecondaryMuscles.primary} secondaryMuscles={summaryPrimarySecondaryMuscles.secondary} view="front" size={56} />
                  <MuscleSilhouette primaryMuscles={summaryPrimarySecondaryMuscles.primary} secondaryMuscles={summaryPrimarySecondaryMuscles.secondary} view="back" size={56} />
                </View>

                <View style={{ marginTop: 8, gap: 4 }}>
                  {items
                    .filter((ex) => ex.sets.some((s) => s.completed))
                    .map((ex, idx) => (
                      <Typography key={idx} variant="caption" color={colors.text}>
                        • {ex.name} ({ex.sets.filter((s) => s.completed).length} sets)
                      </Typography>
                    ))}
                </View>
              </Card>
            </ScrollView>

            <View style={styles.summaryActions}>
              <Button
                variant="primary"
                label={postingState === 'loading' ? 'Publishing...' : 'Share Workout'}
                style={{ flex: 1 }}
                onPress={handlePublishPost}
                isLoading={postingState === 'loading'}
                disabled={postingState === 'loading'}
              />
              <Button
                variant="outline"
                label="Cancel"
                style={{ flex: 1 }}
                onPress={() => setPostStep('select_community')}
                disabled={postingState === 'loading'}
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMinimize} style={styles.closeBtn}>
          <ChevronDown size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.timerRow}>
          <Typography variant="bodyBold" style={styles.timerText}>{formatTimer(elapsedSeconds)}</Typography>
          {paused && <Typography variant="caption" color={colors.danger} style={{ fontWeight: '700' }}>PAUSED</Typography>}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.finishHeaderBtn} onPress={handleFinishPress} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={colors.primaryDark} /> : <Typography variant="bodyBold" color={colors.primaryDark}>Finish</Typography>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.moreBtn}>
            <MoreVertical size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {sessionId && duoSession && (
        <View style={styles.duoStatusBar}>
          <View style={styles.duoStatusCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.duoStatusDotActive} />
              <Typography variant="bodyBold" style={{ fontSize: 11 }}>YOU</Typography>
            </View>
            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
              {isTimerRunning ? 'Resting' : 'Training'}
            </Typography>
          </View>
          <View style={styles.duoStatusDivider} />
          <View style={styles.duoStatusCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[
                styles.duoStatusDot,
                partnerDisconnected ? styles.duoStatusDotOffline :
                partnerMeta?.state === 'resting' ? styles.duoStatusDotResting :
                partnerMeta?.state === 'done' ? styles.duoStatusDotDone :
                styles.duoStatusDotActive
              ]} />
              <Typography variant="bodyBold" style={{ fontSize: 11 }} numberOfLines={1}>
                {partnerMeta?.displayName?.toUpperCase() || 'PARTNER'}
              </Typography>
            </View>
            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
              {partnerDisconnected ? 'Offline' :
               partnerMeta?.state === 'resting' ? 'Resting' :
               partnerMeta?.state === 'done' ? 'Finished' : 'Training'}
            </Typography>
            {partnerExerciseName ? (
              <Typography variant="caption" color={colors.primary} style={{ fontSize: 9, marginTop: 1 }} numberOfLines={1}>
                {partnerExerciseName}
              </Typography>
            ) : null}
          </View>
        </View>
      )}

      {/* Real-time stats card */}
      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Typography variant="caption" color={colors.textMuted}>TIME</Typography>
          <Typography variant="bodyBold">{formatElapsed(elapsedSeconds)}</Typography>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Typography variant="caption" color={colors.textMuted}>VOLUME</Typography>
          <Typography variant="bodyBold">{totalVolume.toLocaleString()} kg</Typography>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Typography variant="caption" color={colors.textMuted}>SETS</Typography>
          <Typography variant="bodyBold">{totalCompletedSets}</Typography>
        </View>
      </View>

      {/* Main exercises list */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {items.length > 0 ? (
          items.map((ex, exIndex) => {
            const isFirstInGroup = ex.groupId && items.findIndex((item) => item.groupId === ex.groupId) === exIndex;
            const inGroup = !!ex.groupId;

            // Adaptive Cardio and Duration UI flags
            const isCardio =
              ex.category?.toLowerCase() === 'cardio' ||
              ex.trackingType === 'duration' ||
              ex.trackingType === 'distance' ||
              ex.trackingType === 'distance_duration';

            const isRepsOnly = ex.trackingType === 'reps_only';

            return (
              <View key={`${ex.exerciseId}-${exIndex}`} style={styles.exerciseSection}>
                {isFirstInGroup && (
                  <View style={styles.groupHeader}>
                    <Layers size={14} color={colors.primary} />
                    <Typography variant="caption" color={colors.primary} style={{ fontWeight: '700', textTransform: 'uppercase' }}>
                      {ex.groupType === 'superset' ? 'Superset' : 'Giant Set'}
                    </Typography>
                    <TouchableOpacity onPress={() => ex.groupId && breakGroup(ex.groupId)} style={styles.breakGroupLink}>
                      <Typography variant="caption" color={colors.textMuted}>Dissolve</Typography>
                    </TouchableOpacity>
                  </View>
                )}

                <Card style={[styles.exCard, inGroup && styles.exCardInGroup]}>
                  {/* Exercise Title row */}
                  <View style={styles.exHeader}>
                    {/* Tap the name mid-workout for how to do it, what it works
                        and your history — same page the routine preview opens. */}
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.exerciseId })}
                    >
                      <Typography variant="bodyBold" style={styles.exName}>{ex.name}</Typography>
                      <Typography variant="caption" color={colors.textMuted}>
                        {ex.muscleGroup || 'Muscle'} {isCardio ? '• Cardio' : ''} • Tap for info
                      </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowExerciseOptions(ex.exerciseId)} style={styles.iconPadding}>
                      <MoreVertical size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Collapsible previous performance summary */}
                  <View style={styles.prevBlock}>
                    <Typography variant="caption" color={colors.textMuted} style={{ fontWeight: '700' }}>
                      LAST TIME:
                    </Typography>
                    <Text style={styles.prevText}>
                      {ex.previousPerformance ? ex.previousPerformance.join(' | ') : 'Loading previous stats...'}
                    </Text>
                  </View>

                  {/* Table headers (Adapts dynamically to Cardio vs Strength vs RepsOnly) */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.colHeader, { width: 55 }]}>TYPE</Text>
                    <Text style={[styles.colHeader, { width: 30, textAlign: 'center' }]}>SET</Text>
                    {isCardio ? (
                      <>
                        <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>
                          {getDistanceUnit(system).toUpperCase()}
                        </Text>
                        <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>MIN:SEC</Text>
                      </>
                    ) : isRepsOnly ? (
                      <Text style={[styles.colHeader, { flex: 2, textAlign: 'center' }]}>REPS</Text>
                    ) : (
                      <>
                        <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>
                          {getWeightUnit(system).toUpperCase()}
                        </Text>
                        <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                      </>
                    )}
                    <Text style={[styles.colHeader, { width: 45, textAlign: 'center' }]}>✓</Text>
                  </View>

                  {/* Set rows */}
                  {ex.sets.map((set, setIdx) => {
                    const isWarmup = set.setType === 'warmup';
                    const isDrop = set.setType === 'drop';

                    return (
                      // Swipe the row left to uncover Delete. No ✕ in the row
                      // itself: the ✓ gets tapped fast mid-set and a
                      // neighbouring delete button would get hit by mistake.
                      <SwipeToDelete
                        key={setIdx}
                        style={[styles.setRow, set.completed && styles.setRowCompleted]}
                        onDelete={() => removeSet(exIndex, setIdx)}
                      >
                        {/* Set type badge dropdown/clicker */}
                        <TouchableOpacity
                          style={[styles.typeBadge, isWarmup && styles.badgeWarmup, isDrop && styles.badgeDrop]}
                          onPress={() => {
                            const nextType = isWarmup ? 'working' : isDrop ? 'warmup' : 'drop';
                            updateSetType(exIndex, setIdx, nextType);
                          }}
                        >
                          <Typography variant="caption" style={styles.typeText}>
                            {isWarmup ? 'WARM' : isDrop ? 'DROP' : 'WORK'}
                          </Typography>
                        </TouchableOpacity>

                        <Text style={[styles.setNumText, { width: 30, textAlign: 'center' }]}>
                          {set.setNumber}
                        </Text>

                        {/* Adaptive input fields */}
                        {isCardio ? (
                          <>
                            {/* Distance in Km/Mi */}
                            <View style={styles.inputContainer}>
                              <TextInput
                                style={styles.cellInput}
                                keyboardType="numeric"
                                value={set.distanceInputStr !== undefined ? set.distanceInputStr : (set.distanceKm ? convertKmToDisplay(set.distanceKm, system).toString() : '')}
                                onChangeText={(val) => updateSetDistance(exIndex, setIdx, val)}
                                editable={!set.completed}
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                              />
                            </View>
                            {/* Duration (Min:Sec) */}
                            <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                              <TextInput
                                style={[styles.cellInput, { flex: 1, paddingHorizontal: 2 }]}
                                keyboardType="numeric"
                                value={(set.durationMinutes || 0).toString()}
                                onChangeText={(val) => updateSetDuration(exIndex, setIdx, parseInt(val, 10) || 0, set.durationSeconds || 0)}
                                editable={!set.completed}
                                placeholder="m"
                                placeholderTextColor={colors.textMuted}
                              />
                              <Text style={{ color: colors.textMuted, fontSize: 12 }}>:</Text>
                              <TextInput
                                style={[styles.cellInput, { flex: 1, paddingHorizontal: 2 }]}
                                keyboardType="numeric"
                                value={(set.durationSeconds || 0).toString()}
                                onChangeText={(val) => updateSetDuration(exIndex, setIdx, set.durationMinutes || 0, parseInt(val, 10) || 0)}
                                editable={!set.completed}
                                placeholder="s"
                                placeholderTextColor={colors.textMuted}
                              />
                            </View>
                          </>
                        ) : isRepsOnly ? (
                          <View style={[styles.inputContainer, { flex: 2 }]}>
                            <TextInput
                              style={styles.cellInput}
                              keyboardType="numeric"
                              value={set.reps.toString()}
                              onChangeText={(val) => updateSetReps(exIndex, setIdx, parseInt(val, 10) || 0)}
                              editable={!set.completed}
                            />
                          </View>
                        ) : (
                          <>
                            {/* Weight input */}
                            <View style={styles.inputContainer}>
                              <TextInput
                                style={styles.cellInput}
                                keyboardType="numeric"
                                value={set.weightInputStr !== undefined ? set.weightInputStr : (set.kg ? convertWeightToDisplay(set.kg, system).toString() : '')}
                                onChangeText={(val) => updateSetWeight(exIndex, setIdx, val)}
                                editable={!set.completed}
                              />
                            </View>
                            {/* Reps input */}
                            <View style={styles.inputContainer}>
                              <TextInput
                                style={styles.cellInput}
                                keyboardType="numeric"
                                value={set.reps.toString()}
                                onChangeText={(val) => updateSetReps(exIndex, setIdx, parseInt(val, 10) || 0)}
                                editable={!set.completed}
                              />
                            </View>
                          </>
                        )}

                        {/* Checkbox Done status */}
                        <TouchableOpacity
                          style={[styles.checkBtn, set.completed && styles.checkBtnActive]}
                          onPress={() => handleDoneSet(exIndex, setIdx)}
                        >
                          {set.completed ? (
                            <Check size={14} color={colors.primaryDark} strokeWidth={3} />
                          ) : (
                            <View style={styles.checkOutline} />
                          )}
                        </TouchableOpacity>
                      </SwipeToDelete>
                    );
                  })}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.exerciseId, 'working')}>
                      <Plus size={14} color={colors.primary} />
                      <Text style={styles.addSetText}>Add Set</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.exerciseId, 'warmup')}>
                      <Plus size={14} color={colors.textMuted} />
                      <Text style={[styles.addSetText, { color: colors.textMuted }]}>Add Warm-up</Text>
                    </TouchableOpacity>
                    {/* Add a drop set off the last working set (80% load) */}
                    {!isCardio && (() => {
                      const lastWorking = ex.sets.reduce(
                        (acc, s, i) => (s.setType !== 'warmup' && s.setType !== 'drop' ? i : acc),
                        -1,
                      );
                      if (lastWorking < 0) return null;
                      return (
                        <TouchableOpacity style={styles.addSetBtn} onPress={() => addDropAction(exIndex, lastWorking)}>
                          <Plus size={14} color="#06b6d4" />
                          <Text style={[styles.addSetText, { color: '#06b6d4' }]}>Add Drop</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </Card>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Dumbbell size={40} color={colors.textMuted} />
            <Typography variant="h2" align="center">No exercises added yet</Typography>
            <Typography variant="body" color={colors.textMuted} align="center">
              Add exercises to start your workout
            </Typography>
            <TouchableOpacity style={styles.primaryCta} onPress={() => setPickerOpen(true)}>
              <Typography variant="bodyBold" color={colors.primaryDark}>+ Add Exercises</Typography>
            </TouchableOpacity>
          </View>
        )}

        {items.length > 0 && (
          <TouchableOpacity style={styles.addExBtn} onPress={() => setPickerOpen(true)}>
            <Plus size={16} color={colors.primary} />
            <Typography variant="bodyBold" color={colors.primary}>+ Add Exercise</Typography>
          </TouchableOpacity>
        )}

        {sessionId && duoSession && (
          <Card style={styles.duoBoardCard}>
            <Typography variant="caption" color={colors.textMuted} style={{ fontWeight: '800', letterSpacing: 1 }}>
              DUO EXERCISES
            </Typography>
            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10, marginTop: 2 }}>
              If your partner adds an exercise, it will appear here. Tap to add it to your workout.
            </Typography>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {duoSession.exerciseIds.map((id, idx) => {
                const name = duoSession.exerciseNames[idx];
                const alreadyAdded = items.some((i) => i.exerciseId === id);
                if (alreadyAdded) return null;
                return (
                  <View key={id} style={styles.duoBoardRow}>
                    <Typography variant="bodyBold" style={{ flex: 1, fontSize: 13 }}>
                      {name}
                    </Typography>
                    <TouchableOpacity
                      style={styles.duoBoardAddBtn}
                      onPress={async () => {
                        try {
                          const { getExercise } = require('../../services/index');
                          const exDoc = await getExercise(id);
                          if (exDoc) {
                            addExercise(exDoc);
                          }
                        } catch (err) {
                          console.error("Error adding partner exercise:", err);
                        }
                      }}
                    >
                      <Typography variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
                        + Add to My Workout
                      </Typography>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {duoSession.exerciseIds.filter(id => !items.some(i => i.exerciseId === id)).length === 0 && (
                <Typography variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic', textAlign: 'center', marginVertical: spacing.xs }}>
                  No shared exercises on the board yet.
                </Typography>
              )}
            </View>
          </Card>
        )}

        {sessionId && (
          <Card style={styles.duoSilhouetteCard}>
            <Typography variant="caption" color={colors.textMuted} style={{ fontWeight: '800', letterSpacing: 1 }}>
              DUO ACTIVITY VISUALIZER
            </Typography>

            <View style={styles.duoSilhouetteRow}>
              {/* YOU */}
              <View style={styles.duoSilItem}>
                <Typography variant="bodyBold" style={{ fontSize: 11, marginBottom: 4 }}>YOU</Typography>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <MuscleSilhouette
                    primaryMuscles={summaryPrimarySecondaryMuscles.primary}
                    secondaryMuscles={summaryPrimarySecondaryMuscles.secondary}
                    view="front"
                    size={60}
                  />
                  <MuscleSilhouette
                    primaryMuscles={summaryPrimarySecondaryMuscles.primary}
                    secondaryMuscles={summaryPrimarySecondaryMuscles.secondary}
                    view="back"
                    size={60}
                  />
                </View>
              </View>

              {/* PARTNER */}
              <View style={styles.duoSilItem}>
                <Typography variant="bodyBold" style={{ fontSize: 11, marginBottom: 4 }}>
                  {partnerMeta?.displayName?.toUpperCase() || 'PARTNER'}
                </Typography>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <MuscleSilhouette
                    primaryMuscles={partnerMuscles.primary}
                    secondaryMuscles={partnerMuscles.secondary}
                    view="front"
                    size={60}
                  />
                  <MuscleSilhouette
                    primaryMuscles={partnerMuscles.primary}
                    secondaryMuscles={partnerMuscles.secondary}
                    view="back"
                    size={60}
                  />
                </View>
              </View>
            </View>
          </Card>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* Floating Rest Timer Card */}
      {isTimerRunning && restSeconds > 0 && (
        <Card style={styles.timerCard}>
          <View style={styles.timerLeft}>
            <View style={styles.timerIconBox}>
              <Timer size={18} color={colors.text} />
            </View>
            <View>
              <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 9 }}>REST TIMER</Typography>
              <Typography variant="h2" style={{ fontFamily: 'monospace' }}>{formatTimer(restSeconds)}</Typography>
            </View>
          </View>
          <View style={styles.timerRight}>
            <TouchableOpacity style={styles.timerPlusBtn} onPress={() => setRestSeconds((r) => r + 30)}>
              <Typography variant="caption" color={colors.text}>+30s</Typography>
            </TouchableOpacity>
            <Button variant="secondary" size="sm" style={{ paddingHorizontal: 12 }} onPress={() => setRestSeconds(0)}>
              <Typography variant="caption" color={colors.text}>Skip</Typography>
            </Button>
          </View>
        </Card>
      )}

      {/* Confetti cannon trigger */}
      {confettiCount > 0 && (
        <ConfettiCannon
          count={35}
          origin={{ x: -10, y: 0 }}
          fallSpeed={3000}
          fadeOut={true}
          autoStart={true}
        />
      )}

      {/* Options menu modal (Bottom Sheet style) */}
      <Modal visible={showOptionsModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.optionsMenu}>
            <Typography variant="bodyBold" style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              Workout Options
            </Typography>

            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() => {
                setPaused(!paused);
                setShowOptionsModal(false);
              }}
            >
              <View style={styles.optionRow}>
                <Clock size={16} color={colors.text} />
                <Typography variant="body">{paused ? 'Resume Workout' : 'Pause Workout'}</Typography>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() => {
                setShowOptionsModal(false);
                Alert.prompt(
                  'Add Notes',
                  'Add overall session notes or feelings',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Save', onPress: (val?: string) => setNotes(val || '') },
                  ],
                  'plain-text',
                  notes
                );
              }}
            >
              <View style={styles.optionRow}>
                <Info size={16} color={colors.text} />
                <Typography variant="body">Add Session Notes</Typography>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() => {
                setShowOptionsModal(false);
                handleBackPress();
              }}
            >
              <View style={styles.optionRow}>
                <Trash2 size={16} color={colors.danger} />
                <Typography variant="body" color={colors.danger}>Discard Workout</Typography>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Single Exercise settings options popup */}
      {showExerciseOptions && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowExerciseOptions(null)}>
            <View style={styles.optionsMenu}>
              <Typography variant="bodyBold" style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                Exercise Options
              </Typography>

              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  const idx = items.findIndex((x) => x.exerciseId === showExerciseOptions);
                  moveExercise(idx, 'up');
                  setShowExerciseOptions(null);
                }}
              >
                <View style={styles.optionRow}>
                  <ArrowUp size={16} color={colors.text} />
                  <Typography variant="body">Move Up</Typography>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  const idx = items.findIndex((x) => x.exerciseId === showExerciseOptions);
                  moveExercise(idx, 'down');
                  setShowExerciseOptions(null);
                }}
              >
                <View style={styles.optionRow}>
                  <ArrowDown size={16} color={colors.text} />
                  <Typography variant="body">Move Down</Typography>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  setShowGroupPicker({ exerciseId: showExerciseOptions, type: 'superset' });
                  setShowExerciseOptions(null);
                }}
              >
                <View style={styles.optionRow}>
                  <Layers size={16} color={colors.primary} />
                  <Typography variant="body">Link Superset</Typography>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  setShowGroupPicker({ exerciseId: showExerciseOptions, type: 'giant_set' });
                  setShowExerciseOptions(null);
                }}
              >
                <View style={styles.optionRow}>
                  <Layers size={16} color={colors.primary} />
                  <Typography variant="body">Link Giant Set</Typography>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  setShowHistoryModal(showExerciseOptions);
                  setShowExerciseOptions(null);
                }}
              >
                <View style={styles.optionRow}>
                  <History size={16} color={colors.text} />
                  <Typography variant="body">Exercise History</Typography>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionsItem}
                onPress={() => {
                  removeExercise(showExerciseOptions);
                  setShowExerciseOptions(null);
                }}
              >
                <View style={styles.optionRow}>
                  <Trash2 size={16} color={colors.danger} />
                  <Typography variant="body" color={colors.danger}>Remove Exercise</Typography>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Superset / Giant Set Picker Modal */}
      {showGroupPicker && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Typography variant="h2" style={{ marginBottom: 12 }}>
                Link {showGroupPicker.type === 'superset' ? 'Superset' : 'Giant Set'}
              </Typography>
              <Typography variant="caption" color={colors.textMuted} style={{ marginBottom: 16 }}>
                Select exercises to link with {items.find((x) => x.exerciseId === showGroupPicker.exerciseId)?.name}:
              </Typography>

              <ScrollView style={{ width: '100%', maxHeight: 200 }}>
                {items
                  .filter((x) => x.exerciseId !== showGroupPicker.exerciseId)
                  .map((item) => {
                    const [isSelected, setIsSelected] = useState(false);
                    return (
                      <TouchableOpacity
                        key={item.exerciseId}
                        style={[styles.groupSelectItem, isSelected && styles.groupSelectItemActive]}
                        onPress={() => {
                          setIsSelected(!isSelected);
                          if (!isSelected) {
                            createGroup(showGroupPicker.exerciseId, showGroupPicker.type, [item.exerciseId]);
                            setShowGroupPicker(null);
                          }
                        }}
                      >
                        <Typography variant="bodyBold">{item.name}</Typography>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              <Button
                variant="outline"
                label="Cancel"
                style={{ marginTop: 16, width: '100%' }}
                onPress={() => setShowGroupPicker(null)}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Exercise History popup */}
      {showHistoryModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '60%', width: '90%', maxWidth: 400 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 10 }}>
                <Typography variant="bodyBold">Exercise History</Typography>
                <TouchableOpacity onPress={() => setShowHistoryModal(null)}>
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ width: '100%', marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
                {items.find((x) => x.exerciseId === showHistoryModal)?.previousPerformance?.map((perf, idx) => (
                  <View key={idx} style={styles.historyRow}>
                    <Typography variant="body">{perf}</Typography>
                  </View>
                )) || <Typography variant="caption" color={colors.textMuted}>No historical sessions found.</Typography>}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Exercise Picker Modal */}
      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: { padding: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontSize: 16, color: colors.text, fontFamily: 'monospace' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  finishHeaderBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  moreBtn: { padding: 4 },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  exerciseSection: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  breakGroupLink: { marginLeft: 'auto', padding: 2 },

  exCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 12 },
  exCardInGroup: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  iconPadding: { padding: 2 },

  prevBlock: { backgroundColor: colors.bg, padding: 8, borderRadius: radius.sm, gap: 2 },
  prevText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  colHeader: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 },
  setRowCompleted: { backgroundColor: 'rgba(72,187,149,0.04)' },
  setNumText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  typeBadge: {
    width: 55,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeWarmup: { borderColor: colors.textMuted },
  badgeDrop: { borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)' },
  typeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  inputContainer: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  cellInput: { color: colors.text, paddingVertical: 6, paddingHorizontal: 8, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  checkBtn: { width: 45, height: 32, borderRadius: radius.sm, backgroundColor: '#1e2327', alignItems: 'center', justifyContent: 'center' },
  checkOutline: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: colors.textMuted },
  checkBtnActive: { backgroundColor: colors.primary },


  actionsRow: { flexDirection: 'row', gap: spacing.md, paddingTop: 4 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  addSetText: { color: colors.primary, fontSize: 12, fontWeight: '700' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  primaryCta: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: spacing.xl, borderRadius: radius.pill, marginTop: 8 },
  addExBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 12, marginTop: spacing.xs },
  errorText: { color: colors.danger, fontSize: 12, textAlign: 'center', marginTop: 8 },

  // Timer card styles
  timerCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1b2024',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(72,187,149,0.15)', alignItems: 'center', justifyContent: 'center' },
  timerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerPlusBtn: { backgroundColor: '#262c32', paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm },

  // Options modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  optionsMenu: { backgroundColor: '#171b1f', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  optionsItem: { paddingVertical: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // Group Picker & History
  modalContent: { backgroundColor: '#171b1f', borderRadius: radius.lg, borderColor: colors.border, borderWidth: 1, padding: spacing.md, width: '85%', maxWidth: 320, alignSelf: 'center' },
  groupSelectItem: { padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  groupSelectItemActive: { backgroundColor: 'rgba(72,187,149,0.08)', borderColor: colors.primary },
  historyRow: { padding: 10, borderBottomWidth: 1, borderColor: colors.border },

  // Summary post completion styles
  summaryScreen: { flex: 1, backgroundColor: colors.bg },
  summaryScroll: { padding: spacing.md, alignItems: 'center', gap: spacing.md },
  summaryContainer: { flex: 1, padding: spacing.md, alignItems: 'center', gap: spacing.md },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 4 },
  backBtn: { padding: 4 },
  successIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(72,187,149,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  summaryStatsCard: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 16, width: '100%' },
  summaryStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryStatDivider: { width: 1, backgroundColor: colors.border },
  summaryExRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, width: '100%' },
  summaryActions: { flexDirection: 'row', gap: spacing.md, width: '100%', marginTop: 16, paddingBottom: 24 },

  summarySilhouetteCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, width: '100%' },
  summarySilhouetteRow: { flexDirection: 'row', justifyContent: 'space-around', gap: spacing.sm },
  summarySilItem: { alignItems: 'center', gap: 4 },
  silLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },

  communitySelectCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, width: '100%' },
  avatarMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarMiniText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

  captionInput: { width: '100%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: 12, height: 80, textAlignVertical: 'top', fontSize: 14 },
  previewPostCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 10 },
  previewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewStatsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.bg, padding: spacing.sm, borderRadius: radius.md },
  previewStatItem: { alignItems: 'center', gap: 2 },
  
  // Duo session styles
  duoStatusBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  duoStatusCol: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  duoStatusDivider: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
  },
  duoStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  duoStatusDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  duoStatusDotResting: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  duoStatusDotOffline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  duoStatusDotDone: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06b6d4',
  },
  duoBoardCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  duoBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  duoBoardAddBtn: {
    backgroundColor: 'rgba(72, 187, 149, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  duoSilhouetteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  duoSilhouetteRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xs,
  },
  duoSilItem: {
    alignItems: 'center',
    gap: 4,
  },
});
