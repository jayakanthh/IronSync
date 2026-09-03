import React, { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Scale, Bell, Shield, Info, ChevronRight, ChevronLeft, Check, X, Edit2, Palette, Mail, Lock } from "lucide-react-native";
import { colors, spacing, radius } from "../../theme/colors";
import { useCurrentUser } from "../../context/CurrentUser";
import type { PrivacySettings, ShareLevel } from "../../models/index";
import { 
  signOutUser, 
  changeEmail,
  changePassword,
  sendResetEmail,
  resolvePrivacy,
  setPrivacy,
  isUsernameAvailable, 
  saveUsername, 
  validateUsernameFormat, 
  normalizeUsername,
  updateUser,
  setMemberTrainingStatus
} from "../../services/index";

const SHARE_LEVELS: { key: ShareLevel; label: string }[] = [
  { key: 'only_me', label: 'Only me' },
  { key: 'friends', label: 'Friends' },
  { key: 'everyone', label: 'Everyone' },
];

const PRIVACY_ROWS: { key: keyof PrivacySettings; label: string; sub: string }[] = [
  { key: 'workouts', label: 'Workouts', sub: 'Your sessions in feeds and on your profile' },
  { key: 'personalRecords', label: 'Personal records', sub: 'PRs and crew leaderboards' },
  { key: 'streak', label: 'Streak', sub: 'Your current run of training days' },
  { key: 'measurements', label: 'Body measurements', sub: 'Bodyweight and measurements' },
  { key: 'nutrition', label: 'Nutrition', sub: 'Calories and macros' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, refresh } = useCurrentUser();

  // Unit system selection modal visibility
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [savingUnits, setSavingUnits] = useState(false);

  // Logout state
  const [loggingOut, setLoggingOut] = useState(false);

  // Notification toggle: placeholder (no push yet)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Stats visibility: friends can see your streak on your profile (default on).
  const [statsVisible, setStatsVisible] = useState(profile?.statsVisibleToFriends !== false);

  // Per-area sharing, with anything the user hasn't chosen filled from defaults.
  const [privacy, setPrivacyState] = useState<PrivacySettings>(() => resolvePrivacy(profile));

  // Account security sheets
  const [emailSheet, setEmailSheet] = useState(false);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Username edit states
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username ? normalizeUsername(profile.username) : "");
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"empty" | "invalid" | "available" | "taken">("empty");
  const [busy, setBusy] = useState(false);

  const unitSystem = profile?.unitSystem === "imperial" ? "imperial" : "metric";

  useEffect(() => {
    if (!editingUsername) return;
    if (!newUsername.trim()) {
      setStatus("empty");
      return;
    }

    const clean = normalizeUsername(newUsername);
    if (profile?.username && clean === normalizeUsername(profile.username)) {
      setStatus("available");
      return;
    }

    if (!validateUsernameFormat(clean)) {
      setStatus("invalid");
      return;
    }

    setChecking(true);
    const delay = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(clean, profile?.id);
        setStatus(available ? "available" : "taken");
      } catch (e) {
        console.error(e);
        setStatus("invalid");
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(delay);
  }, [newUsername, editingUsername, profile]);

  const handleSaveUsername = async () => {
    if (!profile || status !== "available" || busy) return;
    setBusy(true);
    try {
      const clean = normalizeUsername(newUsername);
      await saveUsername(profile.id, clean);
      await refresh();
      setEditingUsername(false);
      Alert.alert("Success", "Username updated successfully!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update username.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveUnitSystem = async (system: "metric" | "imperial") => {
    if (!profile || savingUnits) return;
    setSavingUnits(true);
    try {
      await updateUser(profile.id, { unitSystem: system });
      await refresh();
      setShowUnitsModal(false);
      Alert.alert("Success", `Units changed to ${system === "metric" ? "Metric (kg, cm, km)" : "Imperial (lb, in, mi)"}`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update unit preferences.");
    } finally {
      setSavingUnits(false);
    }
  };

  const handleNotificationsToggle = (val: boolean) => {
    setNotificationsEnabled(val);
    if (!val) {
      Alert.alert(
        "Notifications disabled",
        "You will no longer receive workout reminders or social alerts.",
        [{ text: "OK" }],
      );
    }
  };

  const handleStatsVisibilityToggle = async (val: boolean) => {
    if (!profile) return;
    setStatsVisible(val); // optimistic
    try {
      await updateUser(profile.id, { statsVisibleToFriends: val });
      await refresh();
    } catch {
      setStatsVisible(!val); // revert on failure
      Alert.alert("Error", "Could not update your privacy setting. Please try again.");
    }
  };

  const handlePrivacyChange = async (key: keyof PrivacySettings, value: ShareLevel) => {
    if (!profile) return;
    const previous = privacy;
    setPrivacyState({ ...privacy, [key]: value }); // optimistic — it's one tap
    try {
      await setPrivacy(profile.id, privacy, key, value);
    } catch {
      setPrivacyState(previous);
      Alert.alert("Could not save", "That privacy setting didn't save. Try again.");
    }
  };

  const closeSheets = () => {
    setEmailSheet(false);
    setPasswordSheet(false);
    setNewEmail("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangeEmail = async () => {
    if (!newEmail.includes("@")) return Alert.alert("Check the address", "Enter a valid email address.");
    if (!currentPassword) return Alert.alert("Password needed", "Enter your current password to confirm it's you.");
    setAuthBusy(true);
    try {
      await changeEmail(newEmail, currentPassword);
      closeSheets();
      Alert.alert(
        "Check your new inbox",
        `We've sent a confirmation link to ${newEmail.trim()}. Your address changes once you open that link — until then you keep signing in with the old one.`,
      );
    } catch (e: any) {
      Alert.alert("Could not change email", authErrorText(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return Alert.alert("Too short", "Use at least 6 characters.");
    if (newPassword !== confirmPassword) return Alert.alert("They don't match", "The two new passwords are different.");
    setAuthBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      closeSheets();
      Alert.alert("Password changed", "Use your new password next time you sign in.");
    } catch (e: any) {
      Alert.alert("Could not change password", authErrorText(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = () => {
    if (!profile?.email) return;
    Alert.alert("Send a reset link?", `We'll email ${profile.email} a link to set a new password.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: async () => {
          try {
            await sendResetEmail(profile.email);
            closeSheets();
            Alert.alert("Sent", "Check your inbox for the reset link.");
          } catch (e: any) {
            Alert.alert("Could not send", authErrorText(e));
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Clear training status in communities if user is currently training
      if (profile) {
        const cids = profile.communityIds || [];
        if (cids.length > 0) {
          await Promise.all(
            cids.map((cid) =>
              setMemberTrainingStatus(cid, profile.id, false).catch((err) =>
                console.warn("Failed to clear community training status:", cid, err)
              )
            )
          );
        }
      }
      // Perform sign out
      await signOutUser();
    } catch (err: any) {
      console.error("Logout failed:", err);
      Alert.alert(
        "Logout Failed",
        "Couldn't log out. Please try again.",
        [
          { text: "Retry", onPress: handleLogout },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        {profile && (
          <>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.card}>
              <Row label="Name" value={profile.displayName} />
              <Row label="Email" value={profile.email} />
              
              {editingUsername ? (
                <View style={styles.editUsernameBox}>
                  <Text style={styles.editLabel}>Edit Username</Text>
                  <View style={styles.editRow}>
                    <Text style={styles.atPrefix}>@</Text>
                    <TextInput
                      style={styles.usernameInput}
                      value={newUsername}
                      onChangeText={(t) => setNewUsername(t.replace(/\s+/g, ""))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={15}
                    />
                  </View>
                  
                  {/* Status Indicator */}
                  <View style={styles.inlineStatusBox}>
                    {checking ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : status === "available" ? (
                      <Text style={[styles.statusText, { color: colors.success }]}>✓ Username available</Text>
                    ) : status === "taken" ? (
                      <Text style={[styles.statusText, { color: colors.danger }]}>✕ Username already taken</Text>
                    ) : status === "invalid" ? (
                      <Text style={[styles.statusText, { color: colors.danger }]}>✕ 3-15 chars (alphanumeric & _)</Text>
                    ) : null}
                  </View>

                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        setEditingUsername(false);
                        setNewUsername(profile.username ? normalizeUsername(profile.username) : "");
                      }}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, status !== "available" && styles.saveBtnDisabled]}
                      onPress={handleSaveUsername}
                      disabled={status !== "available" || busy}
                    >
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.usernameRow}
                  onPress={() => setEditingUsername(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowLabel}>Username</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.rowValue}>{profile.username || "—"}</Text>
                    <Edit2 size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.toggleRow}
            activeOpacity={0.7}
            onPress={() => setShowUnitsModal(true)}
            disabled={savingUnits}
          >
            <View style={styles.toggleLeft}>
              <Scale size={16} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Metric Units</Text>
                <Text style={styles.toggleSub}>
                  {unitSystem === "metric" ? "kg, cm, km" : "lb, in, mi"}
                </Text>
              </View>
            </View>
            {savingUnits ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ChevronRight size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={styles.toggleLeft}>
              <Bell size={16} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Notifications</Text>
                <Text style={styles.toggleSub}>Friend requests, duo invites</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: colors.surfaceAlt, true: colors.primary + "80" }}
              thumbColor={notificationsEnabled ? colors.primary : colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("Themes")}
          >
            <View style={styles.toggleLeft}>
              <Palette size={16} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Themes</Text>
                <Text style={styles.toggleSub}>Personalize your visual identity</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sign-in & security */}
        <Text style={styles.sectionLabel}>SIGN-IN & SECURITY</Text>
        <View style={styles.card}>
          <TouchableOpacity style={[styles.actionRow, styles.rowBorder]} onPress={() => setEmailSheet(true)}>
            <View style={styles.toggleLeft}>
              <Mail size={16} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Change email</Text>
                <Text style={styles.toggleSub}>Confirmed from your new inbox first</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => setPasswordSheet(true)}>
            <View style={styles.toggleLeft}>
              <Lock size={16} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Change password</Text>
                <Text style={styles.toggleSub}>With your current one, or a reset link</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Privacy */}
        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Shield size={16} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Show stats to friends</Text>
                <Text style={styles.toggleSub}>Friends can see your streak on your profile</Text>
              </View>
            </View>
            <Switch
              value={statsVisible}
              onValueChange={handleStatsVisibilityToggle}
              trackColor={{ false: colors.surfaceAlt, true: colors.primary + "80" }}
              thumbColor={statsVisible ? colors.primary : colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>WHAT YOU SHARE</Text>
        <View style={styles.card}>
          {PRIVACY_ROWS.map((row, i) => (
            <View key={row.key} style={[styles.shareRow, i < PRIVACY_ROWS.length - 1 && styles.rowBorder]}>
              <View>
                <Text style={styles.toggleLabel}>{row.label}</Text>
                <Text style={styles.toggleSub}>{row.sub}</Text>
              </View>
              <View style={styles.segment}>
                {SHARE_LEVELS.map((lvl) => {
                  const active = privacy[row.key] === lvl.key;
                  return (
                    <TouchableOpacity
                      key={lvl.key}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      onPress={() => handlePrivacyChange(row.key, lvl.key)}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{lvl.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <Text style={styles.privacyFootnote}>
            Health notes are never shared — they stay on your device's account only.
          </Text>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.toggleLeft}>
              <Info size={16} color={colors.textMuted} />
              <Text style={styles.toggleLabel}>App Version</Text>
            </View>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          {/* ODbL asks for attribution wherever their data is used. */}
          <View style={styles.infoRow}>
            <View style={styles.toggleLeft}>
              <Info size={16} color={colors.textMuted} />
              <Text style={styles.toggleLabel}>Food data</Text>
            </View>
            <Text style={styles.infoValue}>Open Food Facts (ODbL)</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
          disabled={loggingOut}
          onPress={() => {
            Alert.alert("Log out", "Log out of IronSync?", [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: handleLogout },
            ]);
          }}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#F87171" />
          ) : (
            <Text style={styles.logoutText}>Log out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Change email — Firebase mails the NEW address; nothing changes until
          that link is opened, so a typo can't strand the account. */}
      <Modal visible={emailSheet} transparent animationType="slide" onRequestClose={closeSheets}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change email</Text>
              <TouchableOpacity onPress={closeSheets}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetNote}>
              Currently {profile?.email}. We'll send a confirmation link to the new address —
              your email only changes once you open it.
            </Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="New email address"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <TextInput
              style={styles.sheetInput}
              placeholder="Current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TouchableOpacity style={styles.sheetPrimary} onPress={handleChangeEmail} disabled={authBusy}>
              {authBusy ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <Text style={styles.sheetPrimaryText}>Send confirmation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change password */}
      <Modal visible={passwordSheet} transparent animationType="slide" onRequestClose={closeSheets}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change password</Text>
              <TouchableOpacity onPress={closeSheets}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.sheetInput}
              placeholder="Current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              style={styles.sheetInput}
              placeholder="New password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={styles.sheetInput}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={styles.sheetPrimary} onPress={handleChangePassword} disabled={authBusy}>
              {authBusy ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <Text style={styles.sheetPrimaryText}>Update password</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetLink} onPress={handleForgotPassword}>
              <Text style={styles.sheetLinkText}>Forgot it? Email me a reset link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Units Selection Modal */}
      <Modal visible={showUnitsModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContentBox}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Units</Text>
              <TouchableOpacity onPress={() => setShowUnitsModal(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.optionsList}>
              <TouchableOpacity
                style={styles.optionItem}
                activeOpacity={0.7}
                onPress={() => handleSaveUnitSystem("metric")}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>Metric</Text>
                  <Text style={styles.optionSub}>kg, cm, km</Text>
                </View>
                {unitSystem === "metric" && <Check size={20} color={colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionItem, { borderTopWidth: 1, borderTopColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => handleSaveUnitSystem("imperial")}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>Imperial</Text>
                  <Text style={styles.optionSub}>lb, in, mi</Text>
                </View>
                {unitSystem === "imperial" && <Check size={20} color={colors.primary} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Firebase's codes are not something to show a user. */
function authErrorText(e: any): string {
  switch (e?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That password isn't right.";
    case "auth/email-already-in-use":
      return "Another account already uses that email.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/weak-password":
      return "Pick a longer password — at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/requires-recent-login":
      return "For security, sign out and back in, then try again.";
    default:
      return e?.message ?? "Something went wrong. Try again.";
  }
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.rowItem, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.text, fontSize: 22, fontWeight: "300" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.textMuted, fontSize: 15 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: "600", maxWidth: "60%" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  shareRow: { paddingHorizontal: spacing.md, paddingVertical: 12, gap: 10 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: "center" },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: colors.primaryDark },
  privacyFootnote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    fontStyle: "italic",
  },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end", padding: spacing.md },
  sheetCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sheetNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  sheetInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 15,
  },
  sheetPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  sheetPrimaryText: { color: colors.primaryDark, fontSize: 15, fontWeight: "800" },
  sheetLink: { alignItems: "center", paddingVertical: 10 },
  sheetLinkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  toggleSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  disabledRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  comingSoonBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  comingSoonText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  infoValue: { color: colors.textMuted, fontSize: 13 },
  logoutBtn: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#F87171", fontSize: 15, fontWeight: "700" },
  usernameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  editUsernameBox: {
    paddingVertical: 14,
    gap: spacing.sm,
  },
  editLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  atPrefix: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  inlineStatusBox: {
    height: 18,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalContentBox: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  optionsList: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  optionSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
