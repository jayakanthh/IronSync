import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { colors, spacing, radius } from '../../theme/colors';
import { ChevronLeft, Globe, Lock } from 'lucide-react-native';

import { getCommunity } from '../../services/index';
import type { Community } from '../../models/index';
import { getCommunityBg } from '../../utils/formatting/avatarColors';

import OverviewTab from '../../components/community/OverviewTab';
import PeopleTab from '../../components/community/PeopleTab';
import WorkoutsTab from '../../components/community/WorkoutsTab';
import AchievementsTab from '../../components/community/AchievementsTab';
import ChallengesTab from '../../components/community/ChallengesTab';

type TabType = 'overview' | 'people' | 'workouts' | 'achievements' | 'challenges';

export default function CommunityDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { communityId } = route.params;

  const [community, setCommunity] = useState<Community | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    async function load() {
      const c = await getCommunity(communityId);
      setCommunity(c);
    }
    load();
  }, [communityId]);

  if (!community) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'people':
        return <PeopleTab community={community} />;
      case 'workouts':
        return <WorkoutsTab community={community} />;
      case 'achievements':
        return <AchievementsTab community={community} />;
      case 'challenges':
        return <ChallengesTab community={community} />;
      default:
        return <OverviewTab community={community} onTabChange={(t) => setActiveTab(t as TabType)} />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Detail Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleGroup}>
          <View style={[styles.headerAvatar, { backgroundColor: getCommunityBg(community.name) }]}>
            <Typography variant="h2" style={{ color: '#FFF' }}>
              {community.name.slice(0, 2).toUpperCase()}
            </Typography>
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h2">{community.name}</Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {community.privacy === 'public' ? (
                <Globe size={12} color={colors.textMuted} />
              ) : (
                <Lock size={12} color={colors.textMuted} />
              )}
              <Typography variant="caption" color={colors.textMuted}>
                {community.memberCount} members · {community.trainingNowCount || 0} training
              </Typography>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs Menu */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.tabsStrip}
        >
          {(['overview', 'people', 'workouts', 'achievements', 'challenges'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Typography
                variant="caption"
                color={activeTab === tab ? colors.primary : colors.textMuted}
                style={{ fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: spacing.sm }}
              >
                {tab}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Tab View */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
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
  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsStrip: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  content: {
    flex: 1,
  }
});
