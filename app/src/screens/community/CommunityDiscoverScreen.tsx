import React, { useState, useEffect } from 'react';
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
import { ChevronLeft, Search, Compass, Globe, Key, Lock, Plus } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentUser } from '../../context/CurrentUser';
import { discoverCommunities, searchCommunities, joinCommunity, joinByInviteCode } from '../../services/index';
import type { Community } from '../../models/index';
import { getCommunityBg } from '../../utils/formatting/avatarColors';

export default function CommunityDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { profile, refresh } = useCurrentUser();

  const [searchVal, setSearchVal] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadDiscover = async () => {
    setLoading(true);
    try {
      const list = await discoverCommunities(30);
      setCommunities(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscover();
  }, []);

  const handleSearch = async () => {
    if (!searchVal.trim()) {
      loadDiscover();
      return;
    }
    setLoading(true);
    try {
      const results = await searchCommunities(searchVal.trim());
      setCommunities(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (communityId: string) => {
    if (!profile) return;
    setJoiningId(communityId);
    try {
      await joinCommunity(profile.id, profile.displayName, communityId);
      await refresh();
      Alert.alert('Joined!', 'You are now a member of this space.', [
        { text: 'OK', onPress: () => navigation.navigate('CommunityDetail', { communityId }) },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not join space.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleInviteCodeJoin = async () => {
    if (!profile || !inviteCode.trim()) return;
    setInviteBusy(true);
    try {
      const communityId = await joinByInviteCode(profile.id, profile.displayName, inviteCode.trim());
      if (communityId) {
        await refresh();
        setInviteCode('');
        Alert.alert('Joined!', 'Successfully joined the space using your invite code.', [
          { text: 'OK', onPress: () => navigation.navigate('CommunityDetail', { communityId }) },
        ]);
      } else {
        Alert.alert('Invalid Code', 'No space found matching this invite code.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not join space.');
    } finally {
      setInviteBusy(false);
    }
  };


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Discover Spaces</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Search Box */}
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search public gyms, colleges, groups..."
            placeholderTextColor={colors.textMuted}
            value={searchVal}
            onChangeText={setSearchVal}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchVal.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchVal(''); loadDiscover(); }}>
              <Typography variant="caption" color={colors.primary} style={{ marginRight: spacing.sm }}>
                Clear
              </Typography>
            </TouchableOpacity>
          )}
        </View>

        {/* Invite Code Card */}
        <Card style={styles.codeCard}>
          <Typography variant="bodyBold" style={{ marginBottom: 4 }}>Join Invite-Only Space</Typography>
          <Typography variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            Have a 6-character code? Enter it below to join a private space.
          </Typography>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g. AB49XY"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
            <Button
              variant="primary"
              size="sm"
              onPress={handleInviteCodeJoin}
              disabled={!inviteCode.trim() || inviteBusy}
            >
              {inviteBusy ? <ActivityIndicator size="small" color={colors.primaryDark} /> : 'Join'}
            </Button>
          </View>
        </Card>

        {/* Create Space Banner */}
        <Card style={styles.createBanner}>
          <View style={{ flex: 1 }}>
            <Typography variant="bodyBold">Can't find your space?</Typography>
            <Typography variant="caption" color={colors.textMuted}>
              Create a custom space for your workout squad in 1 minute.
            </Typography>
          </View>
          <Button
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('CommunityCreate')}
          >
            <Plus size={14} color={colors.primary} style={{ marginRight: 4 }} />
            Create
          </Button>
        </Card>

        {/* Results List */}
        <Typography variant="h2" style={styles.sectionTitle}>
          {searchVal.trim() ? 'Search Results' : 'Recommended Public Spaces'}
        </Typography>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : communities.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Typography variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
              No spaces found matching your search. Try another query or create your own!
            </Typography>
          </Card>
        ) : (
          communities.map((item) => {
            const isJoined = profile?.communityIds?.includes(item.id);
            return (
              <Card key={item.id} style={styles.commCard}>
                <View style={[styles.avatar, { backgroundColor: getCommunityBg(item.name) }]}>
                  <Typography variant="h2" style={styles.avatarText}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </Typography>
                </View>
                <View style={styles.commInfo}>
                  <Typography variant="bodyBold">{item.name}</Typography>
                  <View style={styles.metaRow}>
                    {item.privacy === 'public' ? (
                      <Globe size={12} color={colors.textMuted} />
                    ) : (
                      <Lock size={12} color={colors.textMuted} />
                    )}
                    <Typography variant="caption" color={colors.textMuted} style={{ textTransform: 'capitalize' }}>
                      {item.type} • {item.memberCount} members
                    </Typography>
                  </View>
                  {item.trainingNowCount && item.trainingNowCount > 0 ? (
                    <View style={styles.trainingBadge}>
                      <View style={styles.activeDot} />
                      <Typography style={styles.trainingText}>
                        {item.trainingNowCount} training now
                      </Typography>
                    </View>
                  ) : null}
                </View>
                <View style={styles.actionBtn}>
                  {isJoined ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      style={{ paddingHorizontal: 12 }}
                    >
                      Joined
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onPress={() => handleJoin(item.id)}
                      disabled={joiningId === item.id}
                      style={{ paddingHorizontal: 16 }}
                    >
                      {joiningId === item.id ? (
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      ) : (
                        'Join'
                      )}
                    </Button>
                  )}
                </View>
              </Card>
            );
          })
        )}
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
    gap: spacing.md,
    paddingBottom: 60,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  codeCard: {
    gap: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  createBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  sectionTitle: {
    marginTop: spacing.xs,
  },
  centerLoading: {
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    padding: spacing.xl,
  },
  commCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  commInfo: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(72, 187, 149, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  trainingText: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: '700',
  },
  actionBtn: {
    justifyContent: 'center',
  },
});
