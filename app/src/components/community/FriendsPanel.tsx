import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { Card } from '../ui/Card';
import type { FriendRequest, User } from '../../models/index';
import {
  acceptRequest,
  declineRequest,
  getFriends,
  getIncomingRequests,
  removeFriend,
  searchUsersByUsername,
  getUser,
  getWorkoutHistory,
} from '../../services/index';
import { useCurrentUser } from '../../context/CurrentUser';
import { useNavigation } from '@react-navigation/native';
import { getRelativeTime } from '../../utils/formatting/relativeTime';

/** Friends (1-to-1): add by username, accept/decline requests, see your friends.
 *  `searchOpen` reveals the "Add Friends" search box — toggled from the header icon. */
export default function FriendsPanel({ searchOpen = false }: { searchOpen?: boolean }) {
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();

  const [friends, setFriends] = useState<{ friendId: string; name: string; since: number }[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendDetails, setFriendDetails] = useState<Record<string, {
    username: string;
    lastActiveText: string;
    recentWorkoutText: string;
  }>>({});

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [f, r] = await Promise.all([getFriends(profile.id), getIncomingRequests(profile.id)]);
      setFriends(f);
      setRequests(r);

      const details: Record<string, any> = {};
      await Promise.all(f.map(async (friend) => {
        try {
          const userDoc = await getUser(friend.friendId);
          let recentText = 'No recent workouts';
          let lastActiveTime: number | null = null;
          
          const history = await getWorkoutHistory(friend.friendId);
          if (history && history.length > 0) {
            const last = history[0];
            recentText = `${last.planName || 'Workout'} (${getRelativeTime(last.createdAt || last.date)})`;
            lastActiveTime = last.createdAt || Date.now();
          }
          
          details[friend.friendId] = {
            // username is stored with a leading '@' already — don't prepend another
            username: userDoc?.username || '@lifter',
            lastActiveText: lastActiveTime ? `Active ${getRelativeTime(lastActiveTime)}` : 'Online',
            recentWorkoutText: recentText
          };
        } catch (err) {
          console.error("Error loading friend details:", err);
        }
      }));
      setFriendDetails(details);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery);
        // Exclude current user from search results
        setSearchResults(results.filter((u) => u.id !== profile?.id));
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(delay);
  }, [searchQuery, profile?.id]);

  const onAccept = async (req: FriendRequest) => {
    await acceptRequest(req);
    load();
  };
  const onDecline = async (id: string) => {
    await declineRequest(id);
    load();
  };
  const onRemove = async (friendId: string) => {
    if (!profile) return;
    await removeFriend(profile.id, friendId);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Search Users by Username — revealed via the header "add friend" icon */}
      {searchOpen && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Friends</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Search by username..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      )}

      {/* Search Results */}
      {searchQuery.trim() !== '' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search Results</Text>
          {searching ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : searchResults.length === 0 ? (
            <Text style={styles.empty}>No users found with that username.</Text>
          ) : (
            searchResults.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.searchResultRow}
                onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(user.displayName || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultName}>{user.displayName}</Text>
                  <Text style={styles.searchResultUsername}>{user.username || '@lifter'}</Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Incoming requests */}
      {requests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Requests</Text>
          {requests.map((r) => (
            <View key={r.id} style={styles.reqRow}>
              <Text style={styles.name}>{r.fromName}</Text>
              <View style={styles.reqActions}>
                <TouchableOpacity style={styles.accept} onPress={() => onAccept(r)}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDecline(r.id)}>
                  <Text style={styles.decline}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Friends list */}
      <Text style={styles.section}>YOUR FRIENDS ({friends.length})</Text>
      {friends.length === 0 ? (
        <Text style={styles.empty}>No friends yet — search and add someone above.</Text>
      ) : (
        friends.map((f) => {
          const detail = friendDetails[f.friendId] || {
            username: '@lifter',
            lastActiveText: 'Online',
            recentWorkoutText: 'No recent workouts'
          };
          return (
            <Card key={f.friendId} style={styles.friendCard}>
              <View style={styles.friendHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(f.name || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{f.name}</Text>
                  <Text style={styles.username}>{detail.username}</Text>
                </View>
                <View style={styles.statusBox}>
                  <View style={styles.onlineIndicator} />
                  <Text style={styles.statusText}>{detail.lastActiveText}</Text>
                </View>
              </View>

              <View style={styles.workoutBox}>
                <Text style={styles.workoutLabel}>Recent workout:</Text>
                <Text style={styles.workoutText} numberOfLines={1}>
                  {detail.recentWorkoutText}
                </Text>
              </View>

              <View style={styles.friendActions}>
                <TouchableOpacity
                  style={styles.actionBtnOutline}
                  onPress={() => navigation.navigate('UserProfile', { userId: f.friendId })}
                >
                  <Text style={styles.actionTextMuted}>View Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={() => navigation.navigate('DuoStack', {
                    screen: 'DuoInvite',
                    params: { partnerId: f.friendId, partnerName: f.name, mode: 'send' }
                  })}
                >
                  <Text style={styles.actionTextPrimary}>DUO</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(f.friendId)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  msg: { fontSize: 13 },
  section: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic' },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  reqActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accept: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  acceptText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  decline: { color: colors.textMuted, fontSize: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  remove: { color: colors.textMuted, fontSize: 13 },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  searchResultUsername: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  friendCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  username: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  workoutBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 2,
  },
  workoutLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  workoutText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionTextMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionTextPrimary: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  removeText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
