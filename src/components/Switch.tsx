import { Pressable, StyleSheet, Switch as RNSwitch, Text } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Switch({ label, value, onValueChange }: Props) {
  const { c, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.row}>
      <Text style={[type.body, styles.label, { color: c.text }]}>{label}</Text>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.line, true: c.accentFill }}
        thumbColor={c.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { flex: 1 },
});
