import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../../theme/colors';
import type { Goal, Weekday } from '../../models/index';
import { addMeasurement, completeOnboarding, currentUserId, todayISO, logMeasurement } from '../../services/index';
import { useCurrentUser } from '../../context/CurrentUser';

const GOALS: { key: Goal; label: string }[] = [
  { key: 'cut', label: 'Cut' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'bulk', label: 'Bulk' },
];
const DAYS: { key: Weekday; label: string }[] = [
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
  { key: 0, label: 'Sun' },
];

/** Reject a promise if it doesn't settle in time — so a hung write fails loudly. */
function withTimeout<T>(promise: Promise<T>, label: string, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timed out (${label}). Is the database reachable + rules allowing writes?`)),
        ms,
      ),
    ),
  ]);
}

/**
 * First-run onboarding — collects the user's stats + weekly training schedule,
 * saves them to the backend, then flips `onboarded` so the app opens. The
 * training days drive the streak (see docs/DATA_MODEL.md).
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refresh } = useCurrentUser();
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal>('maintain');
  // Picks which body the muscle map draws — nothing else reads it.
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [days, setDays] = useState<Weekday[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: Weekday) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const save = async () => {
    // Use the auth uid — the Firestore profile doc may not exist yet, and
    // completeOnboarding uses setDoc(merge) which will create it.
    const uid = currentUserId();
    if (!uid) {
      setError('Not signed in. Please log in again.');
      return;
    }
    if (days.length === 0) {
      setError('Pick at least one training day to track your streak.');
      return;
    }
    setError(null);
    setBusy(true);
    console.log('[onboarding] saving profile for', uid);
    try {
      const weightKg = weight ? Number(weight) : undefined;
      await withTimeout(
        completeOnboarding(uid, {
          age: age ? Number(age) : undefined,
          heightCm: height ? Number(height) : undefined,
          weightKg,
          goal,
          gender,
          trainingDays: days,
        }),
        'save profile',
      );
      console.log('[onboarding] profile saved');
      if (weightKg) {
        await Promise.all([
          withTimeout(addMeasurement(uid, { date: todayISO(), weightKg }), 'save weight old'),
          logMeasurement(uid, {
            userId: uid,
            type: 'weight',
            value: weightKg,
            unit: 'kg',
            recordedAt: Date.now()
          })
        ]);
      }
      console.log('[onboarding] refreshing…');
      await withTimeout(refresh(), 'refresh'); // onboarded=true → app opens
      console.log('[onboarding] done ✅');
    } catch (e: unknown) {
      console.log('[onboarding] FAILED:', e);
      setError(e instanceof Error ? e.message : 'Could not save');
      setBusy(false); // re-enable the button so it's not stuck
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.h1}>Welcome, {profile?.displayName} 💪</Text>
      <Text style={styles.sub}>A few quick things so we can tailor IronSync to you.</Text>

      <View style={styles.row}>
        <Field label="Age" value={age} onChange={setAge} placeholder="24" />
        <Field label="Height (cm)" value={height} onChange={setHeight} placeholder="178" />
        <Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="80" />
      </View>

      <Text style={styles.label}>Body diagram</Text>
      <Text style={styles.hint}>Which figure your muscle map is drawn on.</Text>
      <View style={styles.pillRow}>
        {(['male', 'female'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.pill, gender === g && styles.pillActive]}
            onPress={() => setGender(g)}
            activeOpacity={0.85}
          >
            <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>
              {g === 'male' ? 'Male' : 'Female'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Goal</Text>
      <View style={styles.pillRow}>
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.pill, goal === g.key && styles.pillActive]}
            onPress={() => setGoal(g.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.pillText, goal === g.key && styles.pillTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Which days do you train?</Text>
      <Text style={styles.hint}>Only these count toward your streak — rest days won't break it.</Text>
      <View style={styles.dayRow}>
        {DAYS.map((d) => (
          <TouchableOpacity
            key={d.key}
            style={[styles.day, days.includes(d.key) && styles.dayActive]}
            onPress={() => toggleDay(d.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.dayText, days.includes(d.key) && styles.dayTextActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.btn} onPress={save} disabled={busy} activeOpacity={0.85}>
        {busy ? (
          <ActivityIndicator color={colors.primaryDark} />
        ) : (
          <Text style={styles.btnText}>START TRAINING</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        // strip anything that isn't a digit — numeric keyboard alone doesn't enforce it
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.sm },
  sub: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  label: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: -spacing.xs },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  pillTextActive: { color: colors.primaryDark },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  day: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  dayTextActive: { color: colors.primaryDark },
  error: { color: '#F87171', fontSize: 13 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
