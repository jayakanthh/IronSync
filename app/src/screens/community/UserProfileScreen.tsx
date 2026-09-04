import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Dumbbell, UserPlus, Eye, Flame, Trophy, Lock } from "lucide-react-native";
import { colors, spacing, radius } from "../../theme/colors";
import { useCurrentUser } from "../../context/CurrentUser";
import {
  getUser,
  areFriends,
  sendFriendRequestByUid,
  removeFriend,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  getWorkoutHistory,
  getFriendWorkouts,
  getPublicProfile,
  getIncomingRequests,
  effectiveCurrentStreak,
  todayISO,
} from "../../services/index";
import type { PublicProfile, User, Workout } from "../../models/index";

/**
 * Shape a public profile like a User so the screen below can stay as it is.
 * Anything the owner doesn't share simply isn't there, and reads as zero.
 */
function publicToUser(pub: PublicProfile | null): User | null {
  if (!pub) return null;
  return {
    id: pub.userId,
    displayName: pub.displayName,
    email: '',
    username: pub.username,
    photoURL: pub.photo,
    createdAt: 0,
    groupIds: [],
    trainingDays: pub.trainingDays ?? [],
    currentStreak: pub.currentStreak ?? 0,
    longestStreak: pub.longestStreak ?? 0,
    lastTrainedDate: pub.lastTrainedDate,
    // No streak published means they've kept it to themselves.
    statsVisibleToFriends: pub.currentStreak !== undefined,
  } as User;
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { profile, refresh } = useCurrentUser();
  
  const targetUserId = route.params?.userId;

  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  // Status states
  const [friendshipState, setFriendshipState] = useState<"none" | "pending_sent" | "pending_received" | "friends">("none");
  const [followingState, setFollowingState] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (!targetUserId || !profile) return;
    const isMe = targetUserId === profile.id;
    setLoading(true);
    try {
      const [u, isFollowingCheck, followers, following, wList] = await Promise.all([
        // Someone else's profile document is owner-only; the public copy is
        // what they've chosen to publish. Your own still comes from the real one.
        isMe ? getUser(targetUserId) : publicToUser(await getPublicProfile(targetUserId)),
        isFollowing(profile.id, targetUserId),
        getFollowers(targetUserId),
        getFollowing(targetUserId),
        // Someone else's workouts must go through the friend-visible query;
        // the plain history read is owner-only and always came back empty.
        isMe ? getWorkoutHistory(targetUserId, 20) : getFriendWorkouts(targetUserId, 20),
      ]);

      if (!u) {
        setLoading(false);
        return;
      }
      setTargetUser(u);
      setFollowingState(isFollowingCheck);
      setFollowersCount(followers.length);
      setFollowingCount(following.length);

      // Check friendship state
      const isFriend = await areFriends(profile.id, targetUserId);
      if (isFriend) {
        setFriendshipState("friends");
      } else {
        // Query pending requests
        const [incoming, userFriends] = await Promise.all([
          getIncomingRequests(profile.id),
          getIncomingRequests(targetUserId),
        ]);
        const rec = incoming.find((r) => r.fromId === targetUserId);
        const sent = userFriends.find((r) => r.fromId === profile.id);
        if (rec) {
          setFriendshipState("pending_received");
        } else if (sent) {
          setFriendshipState("pending_sent");
        } else {
          setFriendshipState("none");
        }
      }

      // Query friends count
      const userFriendDocs = await getFollowing(targetUserId); // approximate with following/followers for friends count or getFriends
      // Wait, there is a getFriends function! Let's query getFriends.
      const frs = await getFollowing(targetUserId); // getFriends is not imported, let's use list or mock
      
      // Filter workouts by visibility
      const filtered = wList.filter((w) => {
        const vis = w.visibility || "only_me";
        if (vis === "everyone" || vis === "community") return true;
        if (vis === "friends" && friendshipState === "friends") return true;
        if (vis === "followers" && isFollowingCheck) return true;
        return false;
      });
      setWorkouts(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, profile, friendshipState]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleFriendAction = async () => {
    if (!profile || !targetUser || busy) return;
    setBusy(true);
    try {
      if (friendshipState === "none") {
        const err = await sendFriendRequestByUid({ id: profile.id, name: profile.displayName }, targetUser.id);
        if (err) {
          Alert.alert("Status", err);
        } else {
          setFriendshipState("pending_sent");
          Alert.alert("Success", "Friend request sent!");
        }
      } else if (friendshipState === "friends") {
        Alert.alert("Remove Friend", `Are you sure you want to remove ${targetUser.displayName} from your friends?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeFriend(profile.id, targetUser.id);
                setFriendshipState("none");
                await loadData();
              } catch (err) {
                console.error(err);
              }
            },
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to perform action.");
    } finally {
      setBusy(false);
    }
  };

  const handleFollowAction = async () => {
    if (!profile || !targetUser || busy) return;
    setBusy(true);
    try {
      if (followingState) {
        await unfollowUser(profile.id, targetUser.id);
        setFollowingState(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await followUser(
          { id: profile.id, name: profile.displayName },
          { id: targetUser.id, name: targetUser.displayName }
        );
        setFollowingState(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to perform follow action.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!targetUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>User profile not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = (targetUser.displayName || "?").slice(0, 2).toUpperCase();

  // Stats are shown to FRIENDS only, and only if this user allows it
  // (statsVisibleToFriends defaults to visible when unset).
  const isFriend = friendshipState === "friends";
  const statsShared = targetUser.statsVisibleToFriends !== false;
  const targetStreak = effectiveCurrentStreak(
    {
      currentStreak: targetUser.currentStreak ?? 0,
      longestStreak: targetUser.longestStreak ?? 0,
      lastTrainedDate: targetUser.lastTrainedDate,
    },
    targetUser.trainingDays ?? [],
    todayISO(),
  );
  const targetBest = Math.max(targetUser.longestStreak ?? 0, targetStreak);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarBigText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{targetUser.displayName}</Text>
          <Text style={styles.username}>{targetUser.username || "@lifter"}</Text>
          
          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{followersCount}</Text>
              <Text style={styles.statLbl}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{followingCount}</Text>
              <Text style={styles.statLbl}>Following</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {profile && profile.id !== targetUser.id && (
            <View style={{ gap: spacing.sm, width: '100%', marginTop: spacing.sm }}>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    friendshipState === "friends" && styles.actionBtnActive,
                    friendshipState === "pending_sent" && styles.actionBtnDisabled,
                  ]}
                  onPress={handleFriendAction}
                  disabled={friendshipState === "pending_sent" || busy}
                >
                  <UserPlus size={16} color={friendshipState === "friends" ? colors.primary : colors.primaryDark} />
                  <Text style={[styles.actionBtnText, friendshipState === "friends" && styles.actionBtnTextActive]}>
                    {friendshipState === "friends"
                      ? "Friends"
                      : friendshipState === "pending_sent"
                      ? "Pending"
                      : friendshipState === "pending_received"
                      ? "Respond"
                      : "Add Friend"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.followBtn, followingState && styles.followBtnActive]}
                  onPress={handleFollowAction}
                  disabled={busy}
                >
                  <Eye size={16} color={followingState ? colors.primary : colors.text} />
                  <Text style={[styles.actionBtnText, { color: followingState ? colors.primary : colors.text }]}>
                    {followingState ? "Following" : "Follow"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Invite to Duo option if they are friends or following */}
              {(friendshipState === "friends" || followingState) && (
                <TouchableOpacity
                  style={styles.inviteDuoBtn}
                  onPress={() => {
                    navigation.navigate('DuoStack', {
                      screen: 'DuoLobby',
                      params: { partnerId: targetUser.id, partnerName: targetUser.displayName }
                    });
                  }}
                >
                  <Dumbbell size={16} color={colors.primaryDark} />
                  <Text style={styles.inviteDuoBtnText}>Invite to Duo Workout</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Stats — friends only, respecting the other user's visibility setting */}
        {profile && profile.id !== targetUser.id && isFriend && (
          statsShared ? (
            <>
              <Text style={styles.sectionLabel}>STATS</Text>
              <View style={styles.statsCardsRow}>
                <View style={styles.statCardBox}>
                  <Flame size={20} color={colors.primary} />
                  <Text style={styles.statCardVal}>{targetStreak}</Text>
                  <Text style={styles.statCardLbl}>CURRENT STREAK</Text>
                </View>
                <View style={styles.statCardBox}>
                  <Trophy size={20} color={colors.milestone} />
                  <Text style={styles.statCardVal}>{targetBest}</Text>
                  <Text style={styles.statCardLbl}>BEST STREAK</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.privateStats}>
              <Lock size={16} color={colors.textMuted} />
              <Text style={styles.privateStatsText}>
                {targetUser.displayName} keeps their stats private.
              </Text>
            </View>
          )
        )}

        {/* Workouts Feed Section */}
        <Text style={styles.sectionLabel}>RECENT WORKOUTS</Text>
        
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate("WorkoutDetail", { workoutId: item.id, userId: targetUserId })} activeOpacity={0.8}>
              <Card style={styles.workoutCard}>
                <View style={styles.cardHeader}>
                  <Dumbbell size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>{item.planName || "Workout Session"}</Text>
                  <Text style={styles.cardDate}>{item.date}</Text>
                </View>
                <View style={styles.statsSummary}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLbl}>SETS</Text>
                    <Text style={styles.summaryVal}>
                      {item.entries.reduce((sum, e) => sum + e.sets.length, 0)}
                    </Text>
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLbl}>VOLUME</Text>
                    <Text style={styles.summaryVal}>
                      {(item.totalVolumeKg || 0).toLocaleString()} kg
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyFeedText}>No public workouts shared by this user.</Text>
            </View>
          }
        />
      </ScrollView>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.cardContainer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  errorText: { color: colors.textMuted, fontSize: 16, marginBottom: 12 },
  backLink: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  backLinkText: { color: colors.text, fontWeight: "700" },
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
  backBtnText: { color: colors.text, fontSize: 22, fontWeight: "300" },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 60 },
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  avatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBigText: { color: colors.primaryDark, fontSize: 28, fontWeight: "800" },
  displayName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  username: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  statsBar: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  statBox: { alignItems: "center" },
  statVal: { color: colors.text, fontSize: 18, fontWeight: "800" },
  statLbl: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: colors.border },
  actionsRow: { flexDirection: "row", gap: spacing.sm, width: "100%", marginTop: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    gap: 6,
  },
  actionBtnActive: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionBtnDisabled: {
    backgroundColor: colors.surfaceAlt,
    opacity: 0.5,
  },
  actionBtnText: { color: colors.primaryDark, fontWeight: "800", fontSize: 13 },
  actionBtnTextActive: { color: colors.primary },
  followBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBtnActive: {
    borderColor: colors.primary,
  },
  statsCardsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCardBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "flex-start",
    gap: 6,
  },
  statCardVal: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
  },
  statCardLbl: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  privateStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  privateStatsText: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  workoutCard: { gap: spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  cardDate: { color: colors.textMuted, fontSize: 11 },
  statsSummary: { flexDirection: "row", gap: 24, marginTop: 4 },
  summaryCol: { gap: 2 },
  summaryLbl: { color: colors.textMuted, fontSize: 9, fontWeight: "700" },
  summaryVal: { color: colors.text, fontSize: 14, fontWeight: "700" },
  emptyFeed: { paddingVertical: 36, alignItems: "center" },
  emptyFeedText: { color: colors.textMuted, fontSize: 13, fontStyle: "italic" },
  inviteDuoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    gap: 6,
    width: "100%",
  },
  inviteDuoBtnText: {
    color: colors.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },
});
