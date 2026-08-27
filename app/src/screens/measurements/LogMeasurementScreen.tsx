import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { useCurrentUser } from '../../context/CurrentUser';
import { logMeasurement } from '../../services/measurements/measurements';
import { SimpleHeader as TopHeader } from '../../components/ui/SimpleHeader';
import type { MeasurementType } from '../../models/measurement';
import {
  getUnitSystem,
  convertWeightToCanonical,
  convertCmToCanonical,
  getWeightUnit,
  getMeasurementUnit
} from '../../utils/formatting/units';

const LOG_FIELDS: { type: MeasurementType; label: string; unit: string; placeholder: string; section: 'stats' | 'circumference' }[] = [
  { type: 'weight', label: 'Weight', unit: 'kg', placeholder: 'e.g. 82.5', section: 'stats' },
  { type: 'body_fat', label: 'Body Fat', unit: '%', placeholder: 'e.g. 18.2', section: 'stats' },
  { type: 'waist', label: 'Waist', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'chest', label: 'Chest', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'bicep', label: 'Bicep', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'thigh', label: 'Thigh', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'hips', label: 'Hips', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'neck', label: 'Neck', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'forearm', label: 'Forearm', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
  { type: 'calf', label: 'Calf', unit: 'cm', placeholder: 'Optional', section: 'circumference' },
];

export default function LogMeasurementScreen() {
  const { profile } = useCurrentUser();
  const navigation = useNavigation();
  const [values, setValues] = useState<Record<string, string>>({
    weight: profile?.weightKg?.toString() || '',
  });
  const [saving, setSaving] = useState(false);

  const system = getUnitSystem(profile);

  const handleSave = async () => {
    if (!profile || saving) return;
    const hasValue = Object.values(values).some(v => v.trim());
    if (!hasValue) {
      Alert.alert('No values entered', 'Please enter at least one measurement value.');
      return;
    }

    setSaving(true);
    const promises = [];

    for (const field of LOG_FIELDS) {
      const rawVal = values[field.type];
      if (rawVal && rawVal.trim()) {
        const val = parseFloat(rawVal);
        if (!isNaN(val)) {
          // Convert to canonical if imperial
          const canonicalVal = field.type === 'weight'
            ? convertWeightToCanonical(val, system)
            : (field.type === 'body_fat' ? val : convertCmToCanonical(val, system));
          
          const dbUnit = field.type === 'weight' ? 'kg' : (field.type === 'body_fat' ? '%' : 'cm');

          promises.push(
            logMeasurement(profile.id, {
              userId: profile.id,
              type: field.type,
              value: canonicalVal,
              unit: dbUnit,
              recordedAt: Date.now(),
            })
          );
        }
      }
    }

    try {
      await Promise.all(promises);
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error saving', e?.message || 'Failed to save measurements.');
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (section: 'stats' | 'circumference', title: string) => {
    const fields = LOG_FIELDS.filter(f => f.section === section);
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {fields.map(field => {
          const displayUnit = field.type === 'weight'
            ? getWeightUnit(system)
            : (field.type === 'body_fat' ? '%' : getMeasurementUnit(system));

          return (
            <View key={field.type} style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.unit}>({displayUnit})</Text>
              </View>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={values[field.type] || ''}
                onChangeText={text => setValues(prev => ({ ...prev, [field.type]: text }))}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopHeader title="Log Measurements" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {renderSection('stats', 'BODY COMPOSITION')}
        {renderSection('circumference', 'CIRCUMFERENCE MEASUREMENTS')}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Text style={styles.saveButtonText}>Save Measurements</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: spacing.md, textTransform: 'uppercase' },
  inputGroup: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  unit: { color: colors.textMuted, fontSize: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  saveButton: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  saveButtonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
});
