import React, { useEffect, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getAvatarBg } from '../../utils/formatting/avatarColors';
import { getAvatarUrl } from '../../services/users/avatar';

/**
 * A person's avatar: their initials on a colour derived from their name, which
 * is what the whole app uses. One component so Home, Me and the friend list
 * can't drift apart — Home used to show a stock photo from the mock data.
 *
 * Pass `uri` when you already have the photo (your own profile does). Pass
 * `userId` for someone else and it resolves theirs from Storage, because their
 * profile document — where the URL is kept — is owner-only.
 */
export default function Avatar({
  name,
  size = 40,
  uri,
  userId,
  style,
}: {
  name?: string | null;
  size?: number;
  uri?: string | null;
  userId?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const label = (name || 'User').trim();
  const initials = label.slice(0, 2).toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };

  const [resolved, setResolved] = useState<string | null>(uri ?? null);
  useEffect(() => {
    if (uri) {
      setResolved(uri);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    getAvatarUrl(userId).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [uri, userId]);

  if (resolved) return <Image source={{ uri: resolved }} style={[box, style as any]} />;

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
