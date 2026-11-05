import { Pressable, StyleSheet, Text, View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  title: string;
  onBack?: () => void;
}

export function Header({ title, onBack }: Props) {
  const { c, type } = useTheme();
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.back}>
          <Text style={[type.heading, { color: c.text }]}>{'<'}</Text>
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" style={[type.heading, { color: c.text }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
