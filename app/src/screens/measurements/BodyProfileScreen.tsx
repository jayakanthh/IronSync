/**
 * BodyProfileScreen — dedicated edit screen for the user's body profile
 * and activity level used for BMR/TDEE calculations.
 *
 * Separate from GoalSetupScreen so goal creation and profile editing
 * are distinct, independently navigable flows.
 *
 * Navigation: MeStack → BodyProfile
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc } from 'firebase/firestore';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';
import { useCurrentUser } from '../../context/CurrentUser';
import { SimpleHeader } from '../../components/ui/SimpleHeader';
import { db } from '../../config/firebase';
import { calculateBMR, calculateTDEE, ActivityLevel } from '../../services/measurements/energy';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export default function BodyProfileScreen() {
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();

  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(profile?.weightKg?.toString() ?? '');
  const [gender, setGender] = useState<string>(profile?.gender ?? 'Male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'moderately_active',
  );
  const [saving, setSaving] = useState(false);

  // Live preview of BMR / TDEE
  const previewBMR =
    gender && weightKg && heightCm && age
      ? calculateBMR(gender, parseFloat(weightKg), parseFloat(heightCm), parseInt(age))
      : null;
  const previewTDEE = previewBMR ? calculateTDEE(previewBMR, activityLevel) : null;

  const handleSave = async () => {
    if (!profile) return;

    const parsedAge = parseInt(age);
    const parsedHeight = parseFloat(heightCm);
    const parsedWeight = parseFloat(weightKg);

    if (!parsedAge || !parsedHeight || !parsedWeight) {
      Alert.alert('Missing fields', 'Please fill in age, height, and weight.');
      return;
    }
    if (parsedAge < 10 || parsedAge > 120) {
      Alert.alert('Invalid age', 'Please enter a realistic age.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.id), {
        age: parsedAge,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        gender,
        activityLevel,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', 'Could not update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SimpleHeader title="Body & Energy Profile" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Live energy preview */}
        {previewBMR && previewTDEE && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>ENERGY PREVIEW</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{Math.round(previewBMR)}</Text>
                <Text style={styles.previewLabel}>BMR kcal</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{Math.round(previewTDEE)}</Text>
                <Text style={styles.previewLabel}>TDEE kcal</Text>
              </View>
            </View>
            <Text style={styles.previewNote}>
              These are estimates based on the Mifflin-St Jeor formula. Not medical advice.
            </Text>
          </View>
        )}

        {/* Gender */}
        <Text style={styles.fieldLabel}>Sex</Text>
        <View style={styles.optionRow}>
          {GENDER_OPTIONS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.optionBtn, gender === g && styles.optionBtnActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.optionText, gender === g && styles.optionTextActive]}>
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Age */}
        <Text style={styles.fieldLabel}>Age</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 25"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />

        {/* Height */}
        <Text style={styles.fieldLabel}>Height (cm)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="e.g. 175"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />

        {/* Weight */}
        <Text style={styles.fieldLabel}>Current Weight (kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="e.g. 80"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />

        {/* Activity level */}
        <Text style={styles.fieldLabel}>Activity Level</Text>
        <View style={styles.activityGrid}>
          {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.activityBtn,
                activityLevel === level && styles.activityBtnActive,
              ]}
              onPress={() => setActivityLevel(level)}
            >
              <Text
                style={[
                  styles.activityText,
                  activityLevel === level && styles.activityTextActive,
                ]}
              >
                {ACTIVITY_LABELS[level]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Multiplier reference */}
        <Text style={styles.multiplierNote}>
          Sedentary 1.2 · Lightly Active 1.375 · Moderately Active 1.55 · Very Active 1.725
        </Text>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: TAB_BAR_SPACE },

  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewItem: { flex: 1, alignItems: 'center' },
  previewDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  previewValue: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  previewLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  previewNote: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm, lineHeight: 16 },

  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
  },

  optionRow: { flexDirection: 'row', gap: 8 },
  optionBtn: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  optionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(72, 187, 149, 0.1)',
  },
  optionText: { color: colors.textMuted, fontSize: 14 },
  optionTextActive: { color: colors.primary, fontWeight: '700' },

  activityGrid: { gap: 8 },
  activityBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  activityBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(72, 187, 149, 0.1)',
  },
  activityText: { color: colors.textMuted, fontSize: 14 },
  activityTextActive: { color: colors.primary, fontWeight: '700' },

  multiplierNote: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    lineHeight: 15,
  },

  saveBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
});
