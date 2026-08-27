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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, ChevronRight, Check } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import {
  searchUsersByUsername,
  getIncomingRequests,
  acceptRequest,
  declineRequest,
} from '../../services/index';
import { useCurrentUser } from '../../context/CurrentUser';
import type { FriendRequest, User } from '../../models/index';

/**
 * Add Friends — dedicated page opened from the Social > Friends header icon.
 * Search users by username AND manage incoming requests (accept/decline) here.
 */
export default function AddFriendsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile } = useCurrentUser();

  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!profile) return;
    setLoadingReqs(true);
    try {
      setRequests(await getIncomingRequests(profile.id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReqs(false);
    }
  }, [profile]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Debounced username search.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery);
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
    loadRequests();
  };
  const onDecline = async (id: string) => {
    await declineRequest(id);
    loadRequests();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.title}>Add Friends</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Search */}
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Search results */}
        {searchQuery.trim() !== '' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>
            {searching ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.empty}>No users found with that username.</Text>
            ) : (
              searchResults.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(user.displayName || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{user.displayName}</Text>
                    <Text style={styles.rowSub}>{user.username || '@lifter'}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Incoming requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Friend Requests{requests.length > 0 ? ` (${requests.length})` : ''}
          </Text>
          {loadingReqs ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : requests.length === 0 ? (
            <Text style={styles.empty}>No pending requests.</Text>
          ) : (
            requests.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(r.fromName || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={[styles.rowName, { flex: 1 }]}>{r.fromName}</Text>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(r)}>
                  <Check size={14} color={colors.primaryDark} strokeWidth={3} />
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline(r.id)}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  searchWrap: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },

  section: { gap: spacing.xs },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.primary, fontSize: 12, marginTop: 2 },

  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  acceptText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  declineBtn: { paddingHorizontal: 8, paddingVertical: 7 },
  declineText: { color: '#F87171', fontSize: 12, fontWeight: '700' },
});
