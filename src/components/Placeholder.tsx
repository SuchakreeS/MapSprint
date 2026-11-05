import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  title: string;
  note: string;
  onBack?: () => void;
}

/** Stand-in body for screens that are routed but not built yet. */
export function Placeholder({ title, note, onBack }: Props) {
  const { c, type } = useTheme();
  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Header title={title} onBack={onBack} />
      <Text style={[type.body, { color: c.muted }]}>{note}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.lg, gap: space.md },
});
