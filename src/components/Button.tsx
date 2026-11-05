import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** ghost = text only ("Not now", "Skip for now"). */
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** md = 56 high, lg = 60 high (the main action on a screen, e.g. Start drive). */
  size?: 'md' | 'lg';
  disabled?: boolean;
  /** Small glyph before the label, e.g. <PlayGlyph />. Inherits the label colour via `color`. */
  leading?: (color: string) => ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  leading,
  style,
}: Props) {
  const { c, type } = useTheme();
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface2, fg: c.text, border: c.line },
    danger: { bg: 'transparent', fg: c.danger, border: c.danger },
    ghost: { bg: 'transparent', fg: c.muted, border: 'transparent' },
  }[variant];
  const height = variant === 'ghost' ? 44 : size === 'lg' ? 60 : 56;
  const textStyle = size === 'lg' ? type.buttonLarge : variant === 'ghost' ? type.bodyStrong : type.button;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height, backgroundColor: look.bg, borderColor: look.border },
        { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {leading?.(look.fg)}
      <Text style={[textStyle, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
