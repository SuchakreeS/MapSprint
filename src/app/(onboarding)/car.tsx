// Screen 05 Add your car (design 05, ScrAddCar.dc.html). Step 5 of 5. Skippable.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarForm } from '@/components/CarForm';
import { StepHeader } from '@/components/StepHeader';
import { useAuth } from '@/features/auth/auth-provider';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function CarScreen() {
  const { c, type } = useTheme();
  const { markCarDone } = useAuth();

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <StepHeader step={5} total={5} />
        <View style={styles.block}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
            Add your car
          </Text>
          <Text style={[type.body, { color: c.muted }]}>
            Its colour becomes your car icon on the map. You can add more cars later.
          </Text>
        </View>
        {/* The pre-drive screen picks this car up from the saved list, so nothing else to do here. */}
        <CarForm kind="car" saveLabel="Continue" skipLabel="Skip for now" onSaved={markCarDone} onSkip={markCarDone} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.xl, gap: space.xl, flexGrow: 1 },
  block: { gap: space.sm },
});
