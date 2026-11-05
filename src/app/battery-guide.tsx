import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { APP_NAME } from '@/constants/app';
import { detectOem, orderedGuides, type OemGuide } from '@/lib/oem-guide';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Opens the system battery optimization list; falls back to this app's settings page. */
async function openBatterySettings() {
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}

function GuideCard({
  guide,
  mine,
  open,
  onToggle,
}: {
  guide: OemGuide;
  mine: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { c, type, fonts } = useTheme();
  return (
    <Card style={[styles.card, mine && { borderColor: c.primary }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${guide.name} steps`}
        onPress={onToggle}
        style={styles.cardHead}>
        <View style={styles.grow}>
          {mine && <Text style={[type.label, { color: c.gold }]}>YOUR PHONE</Text>}
          <Text style={[type.rowTitle, { color: c.text }]}>{guide.name}</Text>
        </View>
        <Text style={{ color: c.muted, fontSize: 22 }}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {open && (
        <View style={styles.steps}>
          {guide.steps.map((step, i) => (
            <View key={step} style={styles.step}>
              <Text style={{ color: c.primaryText, fontFamily: fonts.bodyBold, fontSize: 15, width: 18 }}>
                {i + 1}
              </Text>
              <Text style={[type.small, styles.grow, { color: c.text }]}>{step}</Text>
            </View>
          ))}
          {guide.note ? <Text style={[type.caption, { color: c.muted }]}>{guide.note}</Text> : null}
        </View>
      )}
    </Card>
  );
}

export default function BatteryGuideScreen() {
  const { c, type } = useTheme();
  const oem = detectOem(Device.manufacturer, Device.brand);
  const guides = orderedGuides(oem);
  const [openId, setOpenId] = useState<string>(guides[0].id);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Header title="Keep recording alive" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={[type.body, { color: c.muted }]}>
          Some phones stop apps in the background to save battery. Set {APP_NAME} to not be restricted so
          recording keeps going with the screen off.
        </Text>

        <View style={styles.actions}>
          <Button label="Open battery settings" onPress={openBatterySettings} />
          <Button label={`Open ${APP_NAME} settings`} variant="secondary" onPress={() => Linking.openSettings()} />
        </View>

        {guides.map((g, i) => (
          <GuideCard
            key={g.id}
            guide={g}
            mine={i === 0 && oem !== 'other'}
            open={openId === g.id}
            onToggle={() => setOpenId(openId === g.id ? '' : g.id)}
          />
        ))}

        <Text style={[type.caption, { color: c.muted }]}>
          Menus differ between phone models and Android versions. If you cannot find a setting, search
          the settings on your phone for “battery”. Steps are based on dontkillmyapp.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: space.lg },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  actions: { gap: space.sm },
  card: { gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  grow: { flex: 1, gap: 2 },
  steps: { gap: space.md },
  step: { flexDirection: 'row', gap: space.sm },
});
