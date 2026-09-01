import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator
} from 'react-native';
import { Search, Bookmark, Check, Plus, X, Star, Dumbbell } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../../theme/colors';
import { useCurrentUser } from '../../context/CurrentUser';
import { getExercisesByIds, getUserRecentExercises } from '../../services/index';
import type { Exercise, MuscleGroup } from '../../types/ironsync';
import { useStartWorkoutScroll } from '../../components/common/StartWorkoutButton';

interface ExerciseLibraryScreenProps {
  exercises: Exercise[];
  onSelectExercise?: (exercise: Exercise) => void;
  onAddExerciseToRoutine?: (exercise: Exercise) => void;
  selectedExerciseIds?: string[];
  onSearchChange?: (q: string) => void;
}

const CATEGORIES = [
  'Favourites',
  'Saved',
  'Recent',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Forearms',
  'Legs',
  'Core',
  'Cardio',
] as const;

type CategoryType = typeof CATEGORIES[number];

export default function ExerciseLibraryScreen({
  exercises,
  onSelectExercise,
  onAddExerciseToRoutine,
  selectedExerciseIds = [],
  onSearchChange,
}: ExerciseLibraryScreenProps) {
  const { profile } = useCurrentUser();
  // Drives the floating Start-New-Workout pill: it slides away as you scroll down.
  const scrollProps = useStartWorkoutScroll();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryType>('Chest');
  const [activeDetail, setActiveDetail] = useState<Exercise | null>(null);

  // AsyncStorage-backed states
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(false);

  const favKey = profile ? `fitwise_ex_favourites_${profile.id}` : null;
  const saveKey = profile ? `fitwise_ex_saved_${profile.id}` : null;

  // Load storage states
  const loadStorageData = useCallback(async () => {
    if (!profile) return;
    try {
      if (favKey) {
        const storedFavs = await AsyncStorage.getItem(favKey);
        if (storedFavs) setFavouriteIds(JSON.parse(storedFavs));
      }
      if (saveKey) {
        const storedSaved = await AsyncStorage.getItem(saveKey);
        if (storedSaved) setSavedIds(JSON.parse(storedSaved));
      }
    } catch (e) {
      console.error(e);
    }
  }, [profile, favKey, saveKey]);

  // Load recently performed exercises from Firestore
  const loadRecentExercises = useCallback(async () => {
    if (!profile) return;
    setLoadingRecents(true);
    try {
      const ids = await getUserRecentExercises(profile.id, 20);
      if (ids.length > 0) {
        const domainExs = await getExercisesByIds(ids);
        // Map domain to UI Exercise format
        const uiExs: Exercise[] = domainExs.map((ex) => {
          const m = (ex.muscleGroup || '').toLowerCase();
          let mg: MuscleGroup = 'Core';
          if (m.includes('chest')) mg = 'Chest';
          else if (m.includes('back') || m.includes('lat') || m.includes('trap')) mg = 'Back';
          else if (m.includes('shoulder') || m.includes('delt')) mg = 'Shoulders';
          else if (m.includes('bicep')) mg = 'Biceps';
          else if (m.includes('tricep')) mg = 'Triceps';
          else if (m.includes('leg') || m.includes('quad') || m.includes('hamstring') || m.includes('glute') || m.includes('calf')) mg = 'Legs';

          return {
            id: ex.id,
            name: ex.name,
            muscleGroup: mg,
            subMuscle: ex.muscleGroup,
            equipment: (ex.equipment || 'Bodyweight') as any,
            image: ex.images?.[0] || ex.gifUrl || 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400',
            defaultSets: 3,
            defaultReps: '8-12',
            description: ex.instructions?.join(' '),
            tips: ex.instructions,
          };
        });
        setRecentExercises(uiExs);
      } else {
        setRecentExercises([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecents(false);
    }
  }, [profile]);

  useEffect(() => {
    loadStorageData();
    if (activeTab === 'Recent') {
      loadRecentExercises();
    }
  }, [activeTab, loadStorageData, loadRecentExercises]);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (onSearchChange) {
      onSearchChange(q);
    }
  };

  const toggleFavourite = async (id: string) => {
    if (!favKey) return;
    const nextFavs = favouriteIds.includes(id)
      ? favouriteIds.filter((item) => item !== id)
      : [...favouriteIds, id];
    setFavouriteIds(nextFavs);
    await AsyncStorage.setItem(favKey, JSON.stringify(nextFavs));
  };

  const toggleSaved = async (id: string) => {
    if (!saveKey) return;
    const nextSaved = savedIds.includes(id)
      ? savedIds.filter((item) => item !== id)
      : [...savedIds, id];
    setSavedIds(nextSaved);
    await AsyncStorage.setItem(saveKey, JSON.stringify(nextSaved));
  };

  const filtered = useMemo(() => {
    let list = exercises;

    // Search query overrides tabs
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return list.filter((ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroup.toLowerCase().includes(q) ||
        ex.equipment.toLowerCase().includes(q)
      );
    }

    if (activeTab === 'Favourites') {
      return list.filter((ex) => favouriteIds.includes(ex.id));
    }
    if (activeTab === 'Saved') {
      return list.filter((ex) => savedIds.includes(ex.id));
    }
    if (activeTab === 'Recent') {
      return recentExercises;
    }

    // Muscle categories filter
    return list.filter((ex) => {
      const m = ex.muscleGroup.toLowerCase();
      const tab = activeTab.toLowerCase();

      if (tab === 'chest') return m.includes('chest') || m.includes('pec');
      if (tab === 'back') return m.includes('back') || m.includes('lat');
      if (tab === 'shoulders') return m.includes('shoulder') || m.includes('delt');
      if (tab === 'arms') return m.includes('bicep') || m.includes('tricep') || m.includes('arm');
      if (tab === 'forearms') return m.includes('forearm');
      if (tab === 'legs') return m.includes('leg') || m.includes('quad') || m.includes('hamstring') || m.includes('glute') || m.includes('calf');
      if (tab === 'core') return m.includes('abs') || m.includes('abdom') || m.includes('core');
      if (tab === 'cardio') return m.includes('cardio');

      return true;
    });
  }, [exercises, searchQuery, activeTab, favouriteIds, savedIds, recentExercises]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" {...scrollProps}>
        {/* Quick Search */}
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search exercises..."
            placeholderTextColor="#6b7280"
            style={styles.searchInput}
          />
          {!!searchQuery && (
            <TouchableOpacity style={styles.searchClear} onPress={() => handleSearchChange('')}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories Tab Bar */}
        <View style={{ gap: spacing.xs }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {CATEGORIES.map((tabName) => {
              const isActive = activeTab === tabName;
              return (
                <TouchableOpacity
                  key={tabName}
                  onPress={() => {
                    setSearchQuery('');
                    setActiveTab(tabName);
                  }}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{tabName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Exercise Grid / Card list */}
        {loadingRecents && activeTab === 'Recent' ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((exercise) => {
              const isSelected = selectedExerciseIds.includes(exercise.id);
              const isFav = favouriteIds.includes(exercise.id);
              const isSaved = savedIds.includes(exercise.id);

              return (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseCard}
                  onPress={() => setActiveDetail(exercise)}
                  activeOpacity={0.85}
                >
                  <View style={styles.exerciseLeft}>
                    <View style={styles.thumbWrap}>
                      <Image source={{ uri: exercise.image }} style={styles.thumb} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName} numberOfLines={1}>{exercise.name}</Text>
                      <Text style={styles.exMeta} numberOfLines={1}>
                        {exercise.muscleGroup} • {exercise.equipment}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    {/* Save/Fav buttons */}
                    <TouchableOpacity style={styles.iconBtn} onPress={() => toggleFavourite(exercise.id)}>
                      <Star size={16} color={isFav ? colors.milestone : colors.textMuted} fill={isFav ? colors.milestone : 'none'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => toggleSaved(exercise.id)}>
                      <Bookmark size={16} color={isSaved ? colors.primary : colors.textMuted} fill={isSaved ? colors.primary : 'none'} />
                    </TouchableOpacity>

                    {/* Add button */}
                    <TouchableOpacity
                      style={[styles.addBtn, isSelected && styles.addBtnSelected]}
                      onPress={() => {
                        if (onAddExerciseToRoutine) onAddExerciseToRoutine(exercise);
                        else onSelectExercise?.(exercise);
                      }}
                    >
                      {isSelected ? (
                        <Check size={18} color={colors.primary} strokeWidth={2.5} />
                      ) : (
                        <Plus size={18} color="#d4d4d4" />
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filtered.length === 0 && (
              <View style={styles.emptyContainer}>
                <Dumbbell size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No exercises found matching selection.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Details modal */}
      <Modal visible={!!activeDetail} transparent animationType="slide" onRequestClose={() => setActiveDetail(null)}>
        <View style={styles.modalOverlay}>
          {activeDetail && (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalKicker}>{activeDetail.muscleGroup} • {activeDetail.equipment}</Text>
                  <Text style={styles.modalTitle}>{activeDetail.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveDetail(null)}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                <Image source={{ uri: activeDetail.image }} style={styles.modalImage} />
                <Text style={styles.modalDesc}>
                  {activeDetail.description ||
                    'High activation movement designed for specific target muscle fiber recruitment, hypertrophy, and strength development.'}
                </Text>

                {!!activeDetail.tips && activeDetail.tips.length > 0 && (
                  <View style={styles.tipsBox}>
                    <Text style={styles.tipsHeader}>Form Instructions & Cues:</Text>
                    {activeDetail.tips.map((tip, idx) => (
                      <Text key={idx} style={styles.tipText}>• {tip}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setActiveDetail(null)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalAddBtn}
                  onPress={() => {
                    if (onAddExerciseToRoutine) {
                      onAddExerciseToRoutine(activeDetail);
                    } else if (onSelectExercise) {
                      onSelectExercise(activeDetail);
                    }
                    setActiveDetail(null);
                  }}
                >
                  <Text style={styles.modalAddText}>
                    {onAddExerciseToRoutine ? 'Add to Routine' : 'Start Workout'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  searchWrap: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingLeft: 40,
    paddingRight: 36,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  searchClear: { position: 'absolute', right: 14 },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#d4d4d4', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.primaryDark },

  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: '#111416',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  exName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  exMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: spacing.xs },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e2327',
    borderWidth: 1,
    borderColor: '#2c343a',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  addBtnSelected: { backgroundColor: '#1b2f27', borderColor: colors.primary },
  emptyContainer: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: '#6b7280', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: radius.xl,
    backgroundColor: '#171b1f',
    borderWidth: 1,
    borderColor: '#2b343c',
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  modalKicker: { color: colors.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  modalImage: { height: 180, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalDesc: { color: '#d4d4d4', fontSize: 13, lineHeight: 20 },
  tipsBox: { backgroundColor: '#121517', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: '#262626', gap: 4 },
  tipsHeader: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tipText: { color: '#d4d4d4', fontSize: 12, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  modalCloseBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: '#262626', alignItems: 'center' },
  modalCloseText: { color: '#d4d4d4', fontSize: 13, fontWeight: '600' },
  modalAddBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  modalAddText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
});
