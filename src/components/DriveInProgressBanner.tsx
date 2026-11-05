import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDriveInProgress } from '@/features/recording/use-drive-in-progress';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

// Sits above the tab bar and its raised Record circle.
const ABOVE_TAB_BAR = 49 + 40;

/**
 * Floating pill shown on the tabs while a drive is still recording, so a forgotten drive is
 * noticed the moment the app opens. Tapping it opens the HUD (which asks to finish a drive that
 * has been stopped for a long time). A notification for this comes later (Phase 4).
 */
export function DriveInProgressBanner() {
  const { c, type, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const active = useDriveInProgress();
  if (!active) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Drive in progress. Open to finish."
      onPress={() => router.push('/record/hud')}
      style={[
        styles.pill,
        { bottom: insets.bottom + ABOVE_TAB_BAR, backgroundColor: c.surface, borderColor: c.primary },
      ]}>
      <View style={[styles.dot, { backgroundColor: c.danger }]} />
      <View style={styles.text}>
        <Text style={{ color: c.text, fontFamily: fonts.bodyBold, fontSize: 14 }}>Drive in progress</Text>
        <Text style={[type.caption, { color: c.muted }]}>Still recording. Tap to open and finish.</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    minHeight: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1, gap: 2 },
});
