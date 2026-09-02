import React from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getAvatarBg } from '../../utils/formatting/avatarColors';

/**
 * A person's avatar: their initials on a colour derived from their name, which
 * is what the whole app uses. One component so Home, Me and the friend list
 * can't drift apart — Home used to show a stock photo from the mock data.
 *
 * `uri` is here for when real profile photos exist; nothing sets one today.
 */
export default function Avatar({
  name,
  size = 40,
  uri,
  style,
}: {
  name?: string | null;
  size?: number;
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const label = (name || 'User').trim();
  const initials = label.slice(0, 2).toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) return <Image source={{ uri }} style={[box, style as any]} />;

  return (
    <View style={[styles.wrap, box, { backgroundColor: getAvatarBg(label) }, style]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.38) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#ffffff', fontWeight: '800' },
});
