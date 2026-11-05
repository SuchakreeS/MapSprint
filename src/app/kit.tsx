// Temporary preview of the shared UI kit. Removed with the spike screens (plan.md 1.12).
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { PlayGlyph } from '@/components/PlayGlyph';
import { APP_NAME } from '@/constants/app';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { SpeedGauge } from '@/components/SpeedGauge';
import { Stat } from '@/components/Stat';
import { Switch } from '@/components/Switch';
import { formatDistanceKm, formatDuration, formatSpeedKmh } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function KitPreview() {
  const { c, type } = useTheme();
  const [sound, setSound] = useState(true);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title="Header with back" onBack={() => {}} />
      <Text style={[type.wordmark, { color: c.gold }]}>{APP_NAME.toUpperCase()}</Text>
      <Text style={[type.title, { color: c.text }]}>Title in Sora</Text>
      <Text style={[type.body, { color: c.muted }]}>Body text in Manrope.</Text>

      <Card style={styles.card}>
        <Stat label="Speed" value={formatSpeedKmh(42.4)} unit="km/h" size="hud" />
        <Stat label="Speed (no GPS)" value={formatSpeedKmh(null)} unit="km/h" />
        <Stat label="Distance" value={formatDistanceKm(9410)} unit="km" />
        <Stat label="Time" value={formatDuration(5327)} />
      </Card>

      <Card style={styles.card}>
        <Switch label="Sound" value={sound} onValueChange={setSound} />
      </Card>

      {/* Gauge edge cases: unknown speed, normal, into the red band, beyond full scale. */}
      <Card style={styles.gauges}>
        <SpeedGauge kmh={null} />
        <SpeedGauge kmh={64} />
        <SpeedGauge kmh={150} />
        <SpeedGauge kmh={200} />
      </Card>

      <Button label="Start drive" size="lg" onPress={() => {}} leading={(color) => <PlayGlyph color={color} />} />
      <Button label="Continue" onPress={() => {}} />
      <Button label="Pause" variant="secondary" onPress={() => {}} />
      <Button label="Not now" variant="ghost" onPress={() => {}} />
      <Button label="Discard" variant="danger" onPress={() => {}} />
      <Button label="Disabled" disabled onPress={() => setSound(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md },
  card: { gap: space.md },
  gauges: { gap: space.lg, alignItems: 'center' },
});
