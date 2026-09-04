import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Globe, Lock, ShieldAlert } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentUser } from '../../context/CurrentUser';
import { createCommunity } from '../../services/index';
import type { CommunityType, CommunityPrivacy } from '../../models/index';

export default function CommunityCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { profile, refresh } = useCurrentUser();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CommunityType>('gym');
  const [privacy, setPrivacy] = useState<CommunityPrivacy>('public');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!profile || !name.trim()) return;
    setBusy(true);
    try {
      const communityId = await createCommunity(profile.id, profile.displayName, {
        name: name.trim(),
        type,
        privacy,
        description: description.trim() || undefined,
      });
      await refresh();
      Alert.alert('Success', 'Space created successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('CommunityDetail', { communityId }) },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create space.');
    } finally {
      setBusy(false);
    }
  };

  const types: { key: CommunityType; label: string }[] = [
    { key: 'gym', label: 'Gym / Fitness Center' },
    { key: 'apartment', label: 'Apartment / Building' },
    { key: 'college', label: 'College / University' },
    { key: 'office', label: 'Workplace / Office' },
    { key: 'friends', label: 'Friends Squad' },
    { key: 'custom', label: 'Custom Circle' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Create a Space</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Name input */}
        <View style={styles.inputGroup}>
          <Typography variant="bodyBold" style={{ marginBottom: spacing.xs }}>Space Name</Typography>
          <TextInput
            style={styles.input}
            placeholder="e.g. Golds Gym Elite or Floor 4 Squad"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Typography variant="bodyBold" style={{ marginBottom: spacing.xs }}>Description (Optional)</Typography>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Introduce your fitness space..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={160}
          />
        </View>

        {/* Category Type */}
        <View style={styles.inputGroup}>
          <Typography variant="bodyBold" style={{ marginBottom: spacing.sm }}>Category Type</Typography>
          <View style={styles.pillContainer}>
            {types.map((t) => {
              const selected = type === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.pill, selected && styles.pillSelected]}
                  onPress={() => setType(t.key)}
                >
                  <Typography
                    variant="caption"
                    color={selected ? colors.primaryDark : colors.text}
                    style={{ fontWeight: '700' }}
                  >
                    {t.label}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Privacy level */}
        <View style={styles.inputGroup}>
          <Typography variant="bodyBold" style={{ marginBottom: spacing.sm }}>Privacy Settings</Typography>
          <View style={styles.privacyOption}>
            <TouchableOpacity
              style={[styles.privacyCard, privacy === 'public' && styles.privacyCardSelected]}
              onPress={() => setPrivacy('public')}
            >
              <Globe size={20} color={privacy === 'public' ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Typography variant="bodyBold">Public</Typography>
                <Typography variant="caption" color={colors.textMuted}>
                  Anyone can search, browse, and join directly.
                </Typography>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.privacyCard, privacy === 'invite_only' && styles.privacyCardSelected]}
              onPress={() => setPrivacy('invite_only')}
            >
              <Lock size={20} color={privacy === 'invite_only' ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Typography variant="bodyBold">Invite-Only (Code)</Typography>
                <Typography variant="caption" color={colors.textMuted}>
                  Only users with a 6-character invite code can join.
                </Typography>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Button */}
        <Button
          variant="primary"
          onPress={handleCreate}
          disabled={!name.trim() || busy}
          style={styles.createBtn}
        >
          {busy ? <ActivityIndicator size="small" color={colors.primaryDark} /> : 'Create Space'}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: TAB_BAR_SPACE,
  },
  inputGroup: {
    gap: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  privacyOption: {
    gap: spacing.sm,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  privacyCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(72, 187, 149, 0.05)',
  },
  createBtn: {
    marginTop: spacing.md,
  },
});
