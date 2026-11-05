import { Camera, LineLayer, LocationPuck, MapView, ShapeSource } from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HudStat } from '@/components/HudStat';
import { PauseGlyph } from '@/components/PauseGlyph';
import { SpeedGauge } from '@/components/SpeedGauge';
import { MAP_STYLE } from '@/features/map/map-style';
import { useLiveDrive } from '@/features/recording/use-live-drive';
import { formatDistanceKm, formatDuration, formatKmh1 } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Drawn crosshair for the recenter button (no SVG library needed). */
function RecenterGlyph({ color }: { color: string }) {
  return (
    <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.glyphRing, { borderColor: color }]} />
      <View style={[styles.glyphDot, { backgroundColor: color }]} />
    </View>
  );
}

export default function HudScreen() {
  const { mode, c, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, error, elapsedS, snapshot, route } = useLiveDrive();
  const [following, setFollowing] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(0);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <MapView
        style={styles.map}
        styleURL={MAP_STYLE[mode]}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}>
        <Camera
          followUserLocation={following}
          followZoomLevel={16}
          onUserTrackingModeChange={(e) => {
            if (!e.nativeEvent.payload.followUserLocation) setFollowing(false);
          }}
        />
        {route.length >= 2 && (
          <ShapeSource
            id="drive-route"
            shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }}>
            <LineLayer
              id="drive-route-casing"
              style={{ lineColor: c.primary, lineOpacity: 0.18, lineWidth: 16, lineCap: 'round', lineJoin: 'round' }}
            />
            <LineLayer
              id="drive-route-line"
              style={{ lineColor: c.primary, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
        )}
        <LocationPuck puckBearingEnabled puckBearing="course" pulsing={{ isEnabled: true }} />
      </MapView>

      {sheetHeight > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter map on your car"
          onPress={() => setFollowing(true)}
          style={[styles.recenter, { bottom: sheetHeight + space.lg, backgroundColor: c.surface, borderColor: c.line }]}>
          <RecenterGlyph color={c.text} />
        </Pressable>
      )}

      <View
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 8 },
        ]}>
        <View style={[styles.handle, { backgroundColor: c.line }]} />

        {error ? (
          <View style={styles.error}>
            <Text style={[type.heading, { color: c.text }]}>Could not start recording</Text>
            <Text style={[type.body, { color: c.muted }]}>{error}</Text>
            <Button label="Back" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <View style={styles.gauge}>
              <SpeedGauge kmh={ready ? (snapshot?.lastKmh ?? null) : null} />
            </View>

            <View style={styles.stats}>
              <HudStat label="Moving avg" value={ready ? formatKmh1(snapshot?.avgMovingKmh) : '--'} unit="km/h" />
              <HudStat
                label="Distance"
                value={formatDistanceKm(snapshot?.distanceM ?? 0, 1)}
                unit="km"
                style={[styles.middle, { borderColor: c.line }]}
              />
              <HudStat label="Time" value={formatDuration(elapsedS)} />
            </View>

            {/* Placeholders until 1.5c (hold to finish, speed lock) and 1.6 (pause). */}
            <View style={styles.actions}>
              <Button
                label="Pause"
                variant="secondary"
                size="lg"
                disabled
                onPress={() => {}}
                leading={(color) => <PauseGlyph color={color} />}
                style={styles.pause}
              />
              <Button label="Hold to finish" size="lg" onPress={() => {}} style={styles.finish} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  map: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  recenter: {
    position: 'absolute',
    right: space.lg,
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  glyphRing: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  glyphDot: { width: 5, height: 5, borderRadius: 3 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  gauge: { alignSelf: 'center', marginTop: 8 },
  stats: { flexDirection: 'row', marginTop: 12 },
  middle: { borderLeftWidth: 1, borderRightWidth: 1 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  pause: { flex: 1, paddingHorizontal: space.md },
  finish: { flex: 2 },
  error: { gap: space.md, paddingVertical: space.xl },
});
