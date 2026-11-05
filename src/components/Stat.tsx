import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/use-theme';

interface Props {
  label: string;
  /** Already formatted (see src/lib/format.ts). Stat is display only. */
  value: string;
  unit?: string;
  size?: 'hud' | 'normal';
  style?: StyleProp<ViewStyle>;
}

export function Stat({ label, value, unit, size = 'normal', style }: Props) {
  const { c, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}
      style={style}>
      <Text style={[type.label, { color: c.muted }]}>{label.toUpperCase()}</Text>
      <View style={styles.row}>
        <Text style={[size === 'hud' ? type.hudNumber : type.statNumber, { color: c.text }]}>
          {value}
        </Text>
        {unit ? <Text style={[type.caption, { color: c.muted }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
});
