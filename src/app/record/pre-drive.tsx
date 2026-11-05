import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Header } from '@/components/Header';
import { Switch } from '@/components/Switch';
import { useGpsSignal } from '@/features/recording/use-gps-signal';
import { getSoundOn, hideBatteryTip, isBatteryTipHidden, setSoundOn } from '@/features/settings/prefs';
import { needsSignalConfirm, type SignalQuality } from '@/lib/gps-signal';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const SIGNAL_TEXT: Record<SignalQuality, string> = {
  searching: 'Searching for GPS...',
  weak: 'Weak signal. Move to open sky if you can.',
  good: 'Good signal',
  excellent: 'Excellent signal',
};

export default function PreDriveScreen() {
  const { c, type } = useTheme();
  const { quality, accuracyM } = useGpsSignal();
  const [sound, setSound] = useState(getSoundOn);
  const [tipHidden, setTipHidden] = useState(isBatteryTipHidden);

  const start = () => router.replace('/record/hud');

  const [warnVisible, setWarnVisible] = useState(false);

  const onStart = () => (needsSignalConfirm(quality) ? setWarnVisible(true) : start());

  const signalColor =
    quality === 'excellent' || quality === 'good' ? c.success : quality === 'weak' ? c.danger : c.muted;

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Header title="Pre-drive check" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.list}>
        <Card style={styles.card}>
          <Text style={[type.label, { color: c.muted }]}>GPS SIGNAL</Text>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: signalColor }]} />
            <Text style={[type.body, { color: c.text }]}>{SIGNAL_TEXT[quality]}</Text>
          </View>
          {accuracyM != null && (
            <Text style={[type.caption, { color: c.muted }]}>Accuracy about {Math.round(accuracyM)} m</Text>
          )}
        </Card>

        {!tipHidden && (
          <Card style={styles.card}>
            <Text style={[type.label, { color: c.muted }]}>BATTERY TIP (SAMSUNG)</Text>
            <Text style={[type.body, { color: c.text }]}>
              Set Battery to Unrestricted for Mapsprint so recording keeps going with the screen off.
            </Text>
            <View style={styles.row}>
              <Button label="Open settings" variant="secondary" onPress={() => Linking.openSettings()} />
              <Button
                label="Got it"
                variant="secondary"
                onPress={() => {
                  hideBatteryTip();
                  setTipHidden(true);
                }}
              />
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={[type.label, { color: c.muted }]}>CAR</Text>
          <Text style={[type.body, { color: c.text }]}>My car</Text>
          <Text style={[type.caption, { color: c.muted }]}>Choosing a car comes with sign-up later.</Text>
        </Card>

        <Card>
          <Switch
            label="Sound"
            value={sound}
            onValueChange={(v) => {
              setSound(v);
              setSoundOn(v);
            }}
          />
        </Card>
      </ScrollView>

      <Button label="Start drive" onPress={onStart} />

      <ConfirmDialog
        visible={warnVisible}
        tag="WARNING"
        title={quality === 'searching' ? 'No GPS fix yet' : 'GPS signal is weak'}
        message="Your distance and route may be wrong, and some points may be dropped. Start anyway and accept that the result may not be accurate?"
        cancelLabel="Wait for signal"
        confirmLabel="Start anyway"
        onCancel={() => setWarnVisible(false)}
        onConfirm={() => {
          setWarnVisible(false);
          start();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.lg, gap: space.md },
  list: { gap: space.md },
  card: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
