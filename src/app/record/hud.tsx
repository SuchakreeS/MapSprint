import { Camera, LineLayer, LocationPuck, MapView, ShapeSource } from '@rnmapbox/maps';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HoldToFinishButton } from '@/components/HoldToFinishButton';
import { HudStat } from '@/components/HudStat';
import { PauseGlyph } from '@/components/PauseGlyph';
import { PlayGlyph } from '@/components/PlayGlyph';
import { SpeedGauge } from '@/components/SpeedGauge';
import { MAP_STYLE } from '@/features/map/map-style';
import { getActiveSessionId, getCurrentOwner } from '@/features/recording/db';
import { stopRecording } from '@/features/recording/recorder';
import { useLiveDrive } from '@/features/recording/use-live-drive';
import { getAutoPauseMs, getKeepAwakeOn } from '@/features/settings/prefs';
import { formatDistanceKm, formatDuration, formatKmh1 } from '@/lib/format';
import { shouldPromptFinish, stoppedForMs } from '@/lib/finish-prompt';
import { controlsLocked } from '@/lib/hud';
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
  const { mode, c, fonts, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, error, elapsedS, snapshot, speedKmh, paused, nowMs, route, pause, resume } = useLiveDrive();
  const [following, setFollowing] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [finishError, setFinishError] = useState<string | null>(null);
  // "Keep recording" on the stopped-for-a-while prompt snoozes it (see finish-prompt.ts).
  const [promptDismissedAt, setPromptDismissedAt] = useState<number | null>(null);

  const askToFinish = shouldPromptFinish(paused, nowMs, promptDismissedAt);

  const locked = controlsLocked(speedKmh);

  // Screen stays on while the HUD is open, and the Android back button does nothing:
  // the only way out is Hold to finish.
  useEffect(() => {
    if (!getKeepAwakeOn()) return; // Settings > Recording > Keep screen on
    void activateKeepAwakeAsync('hud');
    return () => void deactivateKeepAwake('hud');
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const finish = async () => {
    try {
      const id = getActiveSessionId(); // stopRecording clears it
      const signedIn = getCurrentOwner() != null;
      await stopRecording();
      // Signed in: the Saving screen uploads the drive and the recap opens with the server's final numbers. Guests: local recap.
      router.replace(
        id == null ? '/' : { pathname: signedIn ? '/record/saving' : '/record/recap', params: { id: String(id) } },
      );
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Could not stop the recording.');
    }
  };

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
          followPadding={{ paddingBottom: sheetHeight, paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}
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

      {locked && (
        <View
          pointerEvents="none"
          accessibilityRole="alert"
          style={[styles.lockPill, { top: insets.top + space.sm, backgroundColor: c.overlayPill }]}>
          <Text style={[type.caption, { fontFamily: fonts.bodyBold, color: c.danger }]}>
            Controls locked while moving
          </Text>
        </View>
      )}

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
              <SpeedGauge kmh={ready ? speedKmh : null} />
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

            {paused && (
              <Text style={[type.caption, styles.lockNote, { color: c.muted }]}>
                {paused.kind === 'auto'
                  ? `Paused: stopped for ${Math.round(getAutoPauseMs() / 60_000)} min. Moving again resumes the drive.`
                  : 'Paused. Nothing is recorded until you resume.'}
              </Text>
            )}
            <View style={styles.actions}>
              <Button
                label={paused ? 'Resume' : 'Pause'}
                variant="secondary"
                size="lg"
                disabled={locked || !ready}
                onPress={paused ? resume : pause}
                leading={(color) =>
                  paused ? <PlayGlyph color={color} /> : <PauseGlyph color={color} />
                }
                style={styles.pause}
              />
              <HoldToFinishButton locked={locked} onFinish={finish} style={styles.finish} />
            </View>
          </>
        )}
      </View>

      <ConfirmDialog
        visible={askToFinish && finishError == null}
        emphasis="confirm"
        tag="STILL RECORDING"
        title="Finish this drive?"
        message={`You have been stopped for ${Math.floor(stoppedForMs(paused, nowMs) / 60_000)} min and the drive is still recording. Finish and save it, or keep recording?`}
        cancelLabel="Keep recording"
        confirmLabel="Finish drive"
        onCancel={() => setPromptDismissedAt(nowMs)}
        onConfirm={finish}
      />

      <ConfirmDialog
        visible={finishError != null}
        tag="ERROR"
        title="Could not finish the drive"
        message={`${finishError ?? ''} Your points are saved on this phone. Try again?`}
        cancelLabel="Keep driving"
        confirmLabel="Try again"
        onCancel={() => setFinishError(null)}
        onConfirm={() => {
          setFinishError(null);
          finish();
        }}
      />
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
  lockPill: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
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
  lockNote: { textAlign: 'center', marginTop: space.md },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  pause: { flex: 1, paddingHorizontal: space.md },
  finish: { flex: 2 },
  error: { gap: space.md, paddingVertical: space.xl },
});
