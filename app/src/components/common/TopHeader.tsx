import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Bell, Flame, Award } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/colors';
import { Typography } from '../ui/Typography';
import { UserProfile } from '../../types/ironsync';

interface TopHeaderProps {
  user: UserProfile;
  onAvatarPress: () => void;
  onNotificationPress: () => void;
  unreadNotifsCount?: number;
  onOpenStreak?: () => void;
  onOpenStrengthPR?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  onAvatarPress,
  onNotificationPress,
  unreadNotifsCount = 2,
  onOpenStreak,
  onOpenStrengthPR,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const containerStyle = {
    backgroundColor: theme.colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 40,
    paddingTop: Math.max(insets.top, 12) + 6,
  };

  return (
    <View style={containerStyle}>
      <View style={styles.leftSection}>
        <TouchableOpacity 
          onPress={onAvatarPress} 
          style={[styles.avatarContainer, { borderColor: theme.colors.primary + '4d' }]}
        >
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Typography variant="h1" color={theme.colors.textPrimary} style={styles.logoText}>
            Iron<Typography variant="h1" color={theme.colors.primary}>Sync</Typography>
          </Typography>
        </View>
      </View>

      <View style={styles.rightSection}>
        {onOpenStreak && (
          <TouchableOpacity onPress={onOpenStreak} style={styles.iconBtn}>
            <Flame size={20} color={theme.colors.warning} />
          </TouchableOpacity>
        )}

        {onOpenStrengthPR && (
          <TouchableOpacity onPress={onOpenStrengthPR} style={styles.iconBtn}>
            <Award size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onNotificationPress} style={styles.iconBtn}>
          <Bell size={22} color={theme.colors.textSecondary} />
          {unreadNotifsCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface }]} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
    marginRight: 6,
  },
  logoText: {
    letterSpacing: -0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 999,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});

export default TopHeader;
