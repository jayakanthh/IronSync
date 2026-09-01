import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useStartWorkoutScroll } from '../../components/common/StartWorkoutButton';
import { Search, Bookmark, Star, Plus, Play, X, Pencil } from 'lucide-react-native';
import { colors, spacing } from '../../theme/colors';
import type { Routine } from '../../types/ironsync';

interface RoutineLibraryScreenProps {
  routines: Routine[];
  onStartRoutine: (routine: Routine) => void;
  onSaveRoutineToggle: (routineId: string) => void; // "Save" a public plan → clones it into My Routines
  onCreateRoutineClick: () => void;
  onEditRoutine: (routine: Routine) => void;
  onSetDefault: (routineId: string) => void; // set/unset the user's default plan (drives Home)
  currentUserName?: string; // whose routines count as "My Routines"
}

// "My Routines" holds everything the user owns — created or saved-from-public
// (saving clones it), so there's no separate "Saved" tab. "Public Library" is
// for discovering other people's plans.
const TABS: ('My Routines' | 'Public Library')[] = ['My Routines', 'Public Library'];
const FILTER_CHIPS = ['All', 'Strength', 'Hypertrophy', 'Beginner', 'Advanced'];

/** Ported from iron-sync web (RoutineLibraryScreen.tsx). */
export default function RoutineLibraryScreen({
  routines,
  onStartRoutine,
  onSaveRoutineToggle,
  onCreateRoutineClick,
  onEditRoutine,
  onSetDefault,
  currentUserName,
}: RoutineLibraryScreenProps) {
  // A routine is editable only by its creator.
  const isMine = (r: Routine) => !!currentUserName && r.creator === currentUserName;
  // Drives the floating Start-New-Workout pill: it slides away as you scroll down.
  const scrollProps = useStartWorkoutScroll();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('My Routines');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewRoutine, setPreviewRoutine] = useState<Routine | null>(null);

  const filteredRoutines = routines.filter((r) => {
    if (activeTab === 'My Routines' && !isMine(r)) return false;
    // Public Library = other people's public plans (yours already live in My Routines).
    if (activeTab === 'Public Library' && (!r.isPublic || isMine(r))) return false;
    if (selectedFilter !== 'All' && r.category !== selectedFilter) return false;
    if (
      searchQuery &&
      !r.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.creator.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.category.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} {...scrollProps}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Routine Library</Text>
          <TouchableOpacity style={styles.createBtn} onPress={onCreateRoutineClick} activeOpacity={0.85}>
            <Plus size={16} color={colors.primary} />
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search routines, splits, or creators"
            placeholderTextColor="#6b7280"
            style={styles.searchInput}
          />
          {!!searchQuery && (
            <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                {isActive && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          {FILTER_CHIPS.map((chip) => {
            const isActive = selectedFilter === chip;
            return (
              <TouchableOpacity
                key={chip}
                onPress={() => setSelectedFilter(chip)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ gap: spacing.sm }}>
          {filteredRoutines.map((routine) => (
            <TouchableOpacity
              key={routine.id}
              style={styles.card}
              onPress={() => setPreviewRoutine(routine)}
              activeOpacity={0.9}
            >
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{routine.name}</Text>
                    {routine.isActive && (
                      <View style={styles.defaultBadge}>
                        <Star size={9} color={colors.primaryDark} fill={colors.primaryDark} />
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardCreator}>By {routine.creator}</Text>
                </View>
                <Text style={styles.daysTag}>{routine.daysPerWeek} DAYS/WEEK</Text>
              </View>

              <View style={styles.cardBottomRow}>
                <View style={styles.savesRow}>
                  <Bookmark size={13} color={colors.textMuted} />
                  <Text style={styles.savesText}>
                    {routine.saves >= 1000 ? `${(routine.saves / 1000).toFixed(1)}k` : routine.saves} saves
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  {isMine(routine) ? (
                    <>
                      <TouchableOpacity
                        style={[styles.starBtn, routine.isActive && styles.starBtnActive]}
                        onPress={() => onSetDefault(routine.id)}
                      >
                        <Star
                          size={15}
                          color={routine.isActive ? colors.primary : colors.textMuted}
                          fill={routine.isActive ? colors.primary : 'transparent'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editBtn} onPress={() => onEditRoutine(routine)}>
                        <Pencil size={13} color={colors.primary} strokeWidth={2.5} />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.saveBtn} onPress={() => onSaveRoutineToggle(routine.id)}>
                      <Plus size={13} color={colors.primaryDark} strokeWidth={3} />
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.playBtn} onPress={() => onStartRoutine(routine)}>
                    <Play size={13} color={colors.textMuted} fill={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredRoutines.length === 0 && (
            <Text style={styles.emptyText}>No routines found in this section.</Text>
          )}
        </View>
      </ScrollView>

      {/* Routine Detail / Preview Modal */}
      <Modal visible={!!previewRoutine} transparent animationType="fade" onRequestClose={() => setPreviewRoutine(null)}>
        <View style={styles.modalOverlay}>
          {previewRoutine && (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalKicker}>
                    {previewRoutine.category} Split • {previewRoutine.daysPerWeek} Days/Wk
                  </Text>
                  <Text style={styles.modalTitle}>{previewRoutine.name}</Text>
                  <Text style={styles.modalCreator}>Created by {previewRoutine.creator}</Text>
                </View>
                <TouchableOpacity onPress={() => setPreviewRoutine(null)}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                {previewRoutine.description ||
                  'Optimized hypertrophic workload structured for balanced recovery and maximum progressive overload.'}
              </Text>

              <ScrollView style={{ maxHeight: 192 }}>
                <Text style={styles.modalExercisesHeader}>
                  Included Exercises ({previewRoutine.exercises.length}):
                </Text>
                {previewRoutine.exercises.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseSets}>{ex.sets} sets × {ex.reps}</Text>
                  </View>
                ))}
              </ScrollView>

              {isMine(previewRoutine) && (
                <TouchableOpacity
                  style={[styles.modalDefaultBtn, previewRoutine.isActive && styles.modalDefaultBtnActive]}
                  onPress={() => onSetDefault(previewRoutine.id)}
                >
                  <Star
                    size={14}
                    color={colors.primary}
                    fill={previewRoutine.isActive ? colors.primary : 'transparent'}
                  />
                  <Text style={styles.modalDefaultText}>
                    {previewRoutine.isActive ? 'Default plan ✓ — tap to unset' : 'Set as default plan'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalActions}>
                {isMine(previewRoutine) ? (
                  <TouchableOpacity
                    style={styles.modalEditBtn}
                    onPress={() => {
                      const r = previewRoutine;
                      setPreviewRoutine(null);
                      onEditRoutine(r);
                    }}
                  >
                    <Pencil size={14} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.modalEditText}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.modalEditBtn}
                    onPress={() => {
                      const r = previewRoutine;
                      setPreviewRoutine(null);
                      onSaveRoutineToggle(r.id);
                    }}
                  >
                    <Plus size={14} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.modalEditText}>Save</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalStartBtn}
                  onPress={() => {
                    const r = previewRoutine;
                    setPreviewRoutine(null);
                    onStartRoutine(r);
                  }}
                >
                  <Play size={14} color={colors.primaryDark} fill={colors.primaryDark} />
                  <Text style={styles.modalStartText}>Start Routine</Text>
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
  content: { padding: spacing.md, paddingTop: spacing.lg, gap: spacing.md, paddingBottom: 150 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },

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
    fontSize: 13,
    color: colors.text,
  },
  searchClear: { position: 'absolute', right: 14 },

  tabRow: { flexDirection: 'row', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { paddingBottom: 10 },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.text, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: colors.primary, borderRadius: 2 },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryDark },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: { color: colors.primaryDark, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardCreator: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  daysTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#21262b',
  },
  savesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savesText: { color: colors.textMuted, fontSize: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  saveBtnSaved: { backgroundColor: '#1b2b24', borderWidth: 1, borderColor: colors.primary },
  saveBtnText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  saveBtnTextSaved: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  starBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  starBtnActive: { borderColor: colors.primary, backgroundColor: '#1b2b24' },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', paddingVertical: 48, color: '#6b7280', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 24,
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
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  modalCreator: { color: colors.textMuted, fontSize: 12 },
  modalDesc: { color: '#d4d4d4', fontSize: 12 },
  modalExercisesHeader: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.xs },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#121517',
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: spacing.xs,
  },
  exerciseName: { color: '#e5e5e5', fontSize: 12, fontWeight: '600' },
  exerciseSets: { color: colors.primary, fontSize: 11 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  modalCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#262626',
    alignItems: 'center',
  },
  modalCloseText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600' },
  modalEditBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEditText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  modalDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalDefaultBtnActive: { borderColor: colors.primary, backgroundColor: '#1b2b24' },
  modalDefaultText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  modalStartBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStartText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
});
