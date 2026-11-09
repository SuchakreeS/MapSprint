import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { avatarInitial } from '@/lib/avatar';
import { useTheme } from '@/theme/use-theme';

interface Props {
  displayName?: string | null;
  username?: string | null;
  /** A displayable photo URL (signed URL or local file). Without one, the letter avatar is shown. */
  photoUri?: string | null;
  size?: number;
}

/** Round avatar with a gold ring (design 04). Letter of the display name when there is no photo. */
export function Avatar({ displayName, username, photoUri, size = 112 }: Props) {
  const { c, fonts } = useTheme();
  const ring = size >= 80 ? 2 : 1.5;
  return (
    <View
      accessibilityLabel={photoUri ? 'Profile photo' : `Avatar ${avatarInitial(displayName, username)}`}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: c.gold, backgroundColor: c.surface2 },
      ]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: c.muted, fontFamily: fonts.heading, fontSize: Math.round(size * 0.32) }}>
          {avatarInitial(displayName, username)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
