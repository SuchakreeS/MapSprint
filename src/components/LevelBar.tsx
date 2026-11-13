// 12-segment LED level bar (design 10 recap, 20 profile). Lit segments: 1-5 low, 6-9 mid, 10-12 high colour; unlit = line colour.
import { StyleSheet, View } from 'react-native';

import { LED_SEGMENTS, litSegments } from '@/lib/levels';
import { useTheme } from '@/theme/use-theme';

export function LevelBar({ fraction }: { fraction: number }) {
  const { c } = useTheme();
  const lit = litSegments(fraction);
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: LED_SEGMENTS }, (_, i) => (
        <View
          key={i}
          style={[styles.led, { backgroundColor: i >= lit ? c.line : i < 5 ? c.ledLow : i < 9 ? c.ledMid : c.ledHigh }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  led: { flex: 1, height: 8, borderRadius: 2 },
});
