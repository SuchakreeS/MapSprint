import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/use-theme';

interface Props {
  label: string;
  value: string;
  unit?: string;
  style?: StyleProp<ViewStyle>;
}

/** One centred cell of the HUD stats row (value in Rajdhani, label in Manrope bold). */
export function HudStat({ label, value, unit, style }: Props) {
  const { c, type, fonts } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}
      style={[styles.cell, style]}>
      <Text style={[type.label, { color: c.muted }]}>{label.toUpperCase()}</Text>
      <Text style={[type.hudStat, { color: c.text }]}>
        {value}
        {unit ? (
          <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyMedium }]}>{` ${unit}`}</Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', gap: 2 },
});
