import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

export function Card({ style, ...rest }: Props) {
  const { c } = useTheme();
  return (
    <View
      {...rest}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
});
