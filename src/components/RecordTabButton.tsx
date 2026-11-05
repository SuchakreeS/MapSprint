import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

const SIZE = 64;

/** Raised centre button of the tab bar. Opens the record flow instead of a tab. */
export function RecordTabButton() {
  const { c } = useTheme();
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start recording"
        onPress={async () => {
          const granted = (await Location.getForegroundPermissionsAsync()).granted;
          router.push(granted ? '/record/pre-drive' : '/location?next=record');
        }}
        style={({ pressed }) => [
          styles.circle,
          { backgroundColor: c.accentFill, borderColor: c.bg, opacity: pressed ? 0.85 : 1 },
        ]}>
        <View style={[styles.dot, { backgroundColor: c.onAccent }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center' },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    marginTop: -SIZE / 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  dot: { width: 22, height: 22, borderRadius: 11 },
});
