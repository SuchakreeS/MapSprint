import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackIcon } from '@/components/icons';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  step: number;
  total: number;
  onBack?: () => void;
}

/** Onboarding top bar (designs 03-05): back arrow, "Step N of M", segmented progress bar. */
export function StepHeader({ step, total, onBack }: Props) {
  const { c, fonts } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
            <BackIcon color={c.text} />
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 13 }}>
          Step {step} of {total}
        </Text>
      </View>
      <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i < step ? c.primary : c.line }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: space.sm },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
