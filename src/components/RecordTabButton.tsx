import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RecordIcon } from '@/components/icons';
import { isRecording } from '@/features/recording/recorder';
import { useTheme } from '@/theme/use-theme';

const SIZE = 56;
const RING = 4;

/** Raised centre button of the tab bar. Opens the record flow instead of a tab. */
export function RecordTabButton() {
  const { c, fonts } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Record a drive"
      onPress={async () => {
        // A drive is already running (app was left or restarted): go back to its HUD.
        if (await isRecording()) return router.push('/record/hud');
        const granted = (await Location.getForegroundPermissionsAsync()).granted;
        router.push(granted ? '/record/pre-drive' : '/location?next=record');
      }}
      style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.85 : 1 }]}>
      <View
        style={[
          styles.circle,
          { backgroundColor: c.accentFill, borderColor: c.surface },
        ]}>
        <RecordIcon color={c.onAccent} />
      </View>
      <Text style={{ color: c.text, fontFamily: fonts.bodyBold, fontSize: 12 }}>Record</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  circle: {
    // 56 px visible circle plus the 4 px ring in the bar colour (design/source/KitTabBar.dc.html).
    width: SIZE + RING * 2,
    height: SIZE + RING * 2,
    borderRadius: (SIZE + RING * 2) / 2,
    borderWidth: RING,
    marginTop: -24 - RING,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
