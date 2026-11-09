// Building blocks for the Settings screens (designs 26-29): page shell, section label, grouped card,
// tappable row, and a segmented control.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Screen shell: safe area, back button, scrolling body. */
export function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Header title={title} onBack={() => router.back()} />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { c, type } = useTheme();
  return <Text style={[type.label, styles.section, { color: c.muted }]}>{children.toUpperCase()}</Text>;
}

/** Rounded card holding rows; a hairline sits between children. */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>;
}

export function Divider() {
  const { c } = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.line }]} />;
}

interface RowProps {
  title: string;
  caption?: string;
  /** Right side: a value ("Connected") instead of the chevron. */
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  /** Greyed out and not tappable ("Coming soon"). */
  disabled?: boolean;
  danger?: boolean;
}

export function SettingsRow({ title, caption, value, valueColor, onPress, disabled, danger }: RowProps) {
  const { c, type, fonts } = useTheme();
  const tappable = !!onPress && !disabled;
  return (
    <Pressable
      accessibilityRole={tappable ? 'button' : 'text'}
      accessibilityState={{ disabled: !tappable }}
      onPress={tappable ? onPress : undefined}
      style={({ pressed }) => [styles.row, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <View style={styles.rowText}>
        <Text style={[type.rowTitle, { color: danger ? c.danger : c.text }]}>{title}</Text>
        {caption ? <Text style={[type.caption, { color: c.muted }]}>{caption}</Text> : null}
      </View>
      {value ? (
        <Text style={{ color: valueColor ?? c.muted, fontFamily: fonts.bodyBold, fontSize: 15 }}>{value}</Text>
      ) : tappable ? (
        <Text style={{ color: c.muted, fontSize: 22 }}>›</Text>
      ) : null}
    </Pressable>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Dark | Light | System style selector (design 26, 28). */
export function Segmented<T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>) {
  const { c, fonts } = useTheme();
  return (
    <View style={styles.segWrap}>
      <Text style={[styles.segLabel, { color: c.text, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      <View style={[styles.segTrack, { backgroundColor: c.surface2 }]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.segItem, selected && { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]}>
              <Text style={{ color: selected ? c.text : c.muted, fontFamily: fonts.bodyBold, fontSize: 15 }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Padding wrapper so a Switch row lines up with SettingsRow inside a group. */
export function SwitchRow({ children }: { children: ReactNode }) {
  return <View style={styles.switchRow}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
  section: { marginTop: space.md, marginLeft: space.xs },
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },
  row: { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: 2 },
  switchRow: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  segWrap: { padding: space.lg, gap: space.md },
  segLabel: { fontSize: 17 },
  segTrack: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
});
