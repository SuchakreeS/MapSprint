import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function ProfileTab() {
  const { c, type } = useTheme();
  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Header title="Profile" />
      <Text style={[type.body, { color: c.muted }]}>Profile and drive history arrive in task 1.7.</Text>
      {/* Temporary: reach the Phase 0 spike screens and kit preview. Removed with 1.12. */}
      <Link href="/dev" style={[type.body, { color: c.primaryText }]}>
        Dev: spikes and UI kit preview
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.lg, gap: space.md },
});
