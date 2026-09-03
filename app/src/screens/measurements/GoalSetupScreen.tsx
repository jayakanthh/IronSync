import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';
import { useCurrentUser } from '../../context/CurrentUser';
import { SimpleHeader } from '../../components/ui/SimpleHeader';
import { validateGoalFeasibility } from '../../services/measurements/energy';
import { createGoal } from '../../services/measurements/measurements';

export default function GoalSetupScreen() {
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // Set when you came here from "Edit Goal" — saving replaces the active goal
  // (createGoal pauses the old one), so the form starts from what you had.
  const prefill = route.params?.prefill;

  // Goal setup fields
  const [weight, setWeight] = useState(
    (prefill?.startValue ?? profile?.weightKg)?.toString() || '',
  );
  const [targetWeight, setTargetWeight] = useState(prefill?.targetValue?.toString() || '');
  const [days, setDays] = useState(prefill?.days ? String(prefill.days) : '42'); // default 6 weeks
  
  const [showRealityCheck, setShowRealityCheck] = useState(false);
  const [realityRecommendation, setRealityRecommendation] = useState<any>(null);

  const handleCalculateGoal = () => {
    if (!profile) return;
    const start = parseFloat(weight) || profile.weightKg || 0;
    const target = parseFloat(targetWeight);
    const d = parseInt(days);
    
    if (!start || !target || !d) {
      Alert.alert('Missing fields', 'Please enter current, target, and time.');
      return;
    }

    const { feasibility, recommendedDays } = validateGoalFeasibility(start, target, d);
    if (feasibility === 'highly_aggressive' || feasibility === 'aggressive') {
      setRealityRecommendation({ target, recommendedDays, feasibility });
      setShowRealityCheck(true);
    } else {
      saveGoal(target, d);
    }
  };

  const saveGoal = async (target: number, durationDays: number) => {
    if (!profile) return;
    const start = parseFloat(weight) || profile.weightKg || 0;
    const type = target < start ? 'lose_weight' : target > start ? 'gain_weight' : 'maintain_weight';
    
    await createGoal(profile.id, {
      userId: profile.id,
      type,
      measurementType: 'weight',
      startValue: start,
      targetValue: target,
      unit: 'kg',
      startDate: Date.now(),
      targetDate: Date.now() + durationDays * 24 * 60 * 60 * 1000,
    });
    
    navigation.replace('Measurements');
  };

  if (showRealityCheck && realityRecommendation) {
    return (
      <View style={styles.screen}>
        <SimpleHeader title="Reality Check" onBack={() => setShowRealityCheck(false)} />
        <View style={styles.content}>
          <Text style={styles.warningTitle}>⚠️ THIS GOAL IS {realityRecommendation.feasibility === 'highly_aggressive' ? 'TOO' : 'VERY'} AGGRESSIVE</Text>
          <Text style={styles.warningText}>
            You want to reach {realityRecommendation.target} kg in {days} days.
            That is {realityRecommendation.feasibility === 'highly_aggressive' ? 'substantially faster than' : 'faster than'} a sustainable rate of weight change.
          </Text>
          <Text style={styles.warningText}>
            We recommend a longer timeframe.
          </Text>
          <View style={styles.recommendationCard}>
            <Text style={styles.cardText}>Recommended target: {realityRecommendation.target} kg</Text>
            <Text style={styles.cardText}>Recommended timeframe: ~{Math.ceil(realityRecommendation.recommendedDays / 7)} weeks</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={() => saveGoal(realityRecommendation.target, realityRecommendation.recommendedDays)}>
            <Text style={styles.primaryButtonText}>Use Recommended Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => saveGoal(realityRecommendation.target, parseInt(days))}>
            <Text style={styles.secondaryButtonText}>Keep My Target</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SimpleHeader title={prefill ? 'Change Goal' : 'Create Goal'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>WHAT'S YOUR GOAL?</Text>
        
        <Text style={styles.label}>Current Weight (kg)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
        
        <Text style={styles.label}>Target Weight (kg)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={targetWeight} onChangeText={setTargetWeight} />
        
        <Text style={styles.label}>Time (Days)</Text>
        <TextInput style={styles.input} keyboardType="number-pad" value={days} onChangeText={setDays} />
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleCalculateGoal}>
          <Text style={styles.primaryButtonText}>Calculate Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: TAB_BAR_SPACE },
  header: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  primaryButton: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  primaryButtonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
  secondaryButton: { padding: 16, alignItems: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  warningTitle: { color: '#F87171', fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  warningText: { color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: spacing.md },
  recommendationCard: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, marginVertical: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardText: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }
});
