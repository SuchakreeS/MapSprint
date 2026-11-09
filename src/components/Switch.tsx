import { Pressable, StyleSheet, Text, View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  label: string;
  /** Small muted line under the label. */
  caption?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Greyed out and not tappable (e.g. waiting for the server). */
  disabled?: boolean;
}

/** Row with a custom 52x32 switch (design/source/ScrPreDrive.dc.html). */
export function Switch({ label, caption, value, onValueChange, disabled }: Props) {
  const { c, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      accessibilityLabel={label}
      onPress={() => onValueChange(!value)}
      style={[styles.row, disabled && { opacity: 0.5 }]}>
      <View style={styles.text}>
        <Text style={[type.rowTitle, { color: c.text }]}>{label}</Text>
        {caption ? <Text style={[type.caption, { color: c.muted }]}>{caption}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? c.primary : c.line }]}>
        <View
          style={[
            styles.knob,
            { left: value ? 24 : 4, backgroundColor: value ? c.onPrimary : c.muted },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
  track: { width: 52, height: 32, borderRadius: 16 },
  knob: { position: 'absolute', top: 4, width: 24, height: 24, borderRadius: 12 },
});
