import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Text under the field. Colour follows `status`. */
  hint?: string;
  status?: 'normal' | 'ok' | 'error';
  /** Fixed text before the input, e.g. "@" for usernames. */
  prefix?: string;
  /** Element at the right end, e.g. the show-password eye. */
  trailing?: ReactNode;
}

/** Labelled input from the onboarding designs (02, 04, 05): 56 high, radius 16, surface fill. */
export function TextField({ label, hint, status = 'normal', prefix, trailing, ...input }: Props) {
  const { c, type, fonts } = useTheme();
  const border = status === 'ok' ? c.success : status === 'error' ? c.danger : c.line;
  const hintColour = status === 'ok' ? c.success : status === 'error' ? c.danger : c.muted;
  return (
    <View style={styles.wrap}>
      <Text style={[type.bodyStrong, { color: c.text }]}>{label}</Text>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: border }]}>
        {prefix ? <Text style={[type.body, { color: c.muted }]}>{prefix}</Text> : null}
        <TextInput
          {...input}
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          style={[styles.input, { color: c.text, fontFamily: fonts.body }]}
        />
        {trailing}
      </View>
      {hint ? <Text style={[type.caption, { color: hintColour }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  box: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: space.md },
});
