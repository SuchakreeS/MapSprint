import { Camera, LocationPuck, MapView } from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CloseGlyph } from '@/components/CloseGlyph';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PlayGlyph } from '@/components/PlayGlyph';
import { Switch } from '@/components/Switch';
import { useGpsSignal } from '@/features/recording/use-gps-signal';
import { getSoundOn, hideBatteryTip, isBatteryTipHidden, setSoundOn } from '@/features/settings/prefs';
import { needsSignalConfirm, type SignalQuality } from '@/lib/gps-signal';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MAP_STYLE = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
};

// Design 07 shows "Strong"; we keep Weak and Searching so the driver knows before starting.
const SIGNAL_LABEL: Record<SignalQuality, string> = {
  excellent: 'Strong',
  good: 'Strong',
  weak: 'Weak',
  searching: 'Searching…',
};

export default function PreDriveScreen() {
  const { mode, c, type, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const { quality } = useGpsSignal();
  const [sound, setSound] = useState(getSoundOn);
  const [tipHidden, setTipHidden] = useState(isBatteryTipHidden);
  const [warnVisible, setWarnVisible] = useState(false);

  const start = () => router.replace('/record/hud');
  const onStart = () => (needsSignalConfirm(quality) ? setWarnVisible(true) : start());

  const strong = quality === 'excellent' || quality === 'good';
  const signalColor = strong ? c.success : quality === 'weak' ? c.danger : c.muted;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <MapView
        style={styles.map}
        styleURL={MAP_STYLE[mode]}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}>
        <Camera followUserLocation followZoomLevel={15.5} />
        <LocationPuck pulsing={{ isEnabled: true }} />
      </MapView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => router.back()}
        style={[
          styles.close,
          { top: insets.top + 8, backgroundColor: c.surface, borderColor: c.line },
        ]}>
        <CloseGlyph color={c.text} size={22} />
      </Pressable>

      <View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 8 },
        ]}>
        <View style={[styles.handle, { backgroundColor: c.line }]} />

        <View style={styles.head}>
          <Text accessibilityRole="header" style={[type.sheetTitle, { color: c.text }]}>
            Ready to drive?
          </Text>
          <Text style={[type.small, styles.sub, { color: c.muted }]}>
            Set up your phone before you move. Controls lock above 10 km/h.
          </Text>
        </View>

        <View style={[styles.list, { backgroundColor: c.surface2 }]}>
          <View style={[styles.row, { minHeight: 56, borderBottomColor: c.line }]}>
            <View style={[styles.statusRing, { borderColor: signalColor }]}>
              {strong ? (
                <View style={[styles.tick, { borderColor: signalColor }]} />
              ) : quality === 'weak' ? (
                <Text style={{ color: signalColor, fontFamily: fonts.bodyBold, fontSize: 13 }}>!</Text>
              ) : null}
            </View>
            <Text style={[type.rowTitle, styles.grow, { color: c.text }]}>GPS signal</Text>
            <Text style={[type.small, { color: signalColor, fontFamily: fonts.bodyBold }]}>
              {SIGNAL_LABEL[quality]}
            </Text>
          </View>

          {!tipHidden && (
            <View style={[styles.row, { minHeight: 64, borderBottomColor: c.line }]}>
              <View style={[styles.battery, { borderColor: c.gold }]} />
              <Pressable
                accessibilityRole="button"
                onPress={() => Linking.openSettings()}
                style={styles.grow}>
                <Text style={[type.rowTitle, { color: c.text }]}>Battery: set to Unrestricted</Text>
                <Text style={[type.caption, { color: c.muted }]}>
                  Keeps recording going with the screen off. Tap to open settings.
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hide battery tip"
                onPress={() => {
                  hideBatteryTip();
                  setTipHidden(true);
                }}
                hitSlop={8}>
                <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyBold }]}>Hide</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.row, styles.rowLast, { minHeight: 56 }]}>
            <View style={[styles.carDot, { backgroundColor: c.accentFill, borderColor: c.line }]} />
            <View style={styles.grow}>
              <Text style={[type.rowTitle, { color: c.text }]}>My car</Text>
              <Text style={[type.caption, { color: c.muted }]}>Choosing a car comes with sign-up later.</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 22 }}>›</Text>
          </View>
        </View>

        <Switch
          label="Sound cues and voice"
          caption="Chime for new cells, voice for new districts"
          value={sound}
          onValueChange={(v) => {
            setSound(v);
            setSoundOn(v);
          }}
        />

        <Button
          label="Start drive"
          size="lg"
          onPress={onStart}
          leading={(color) => <PlayGlyph color={color} />}
        />
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  map: { position: 'absolute', left: 0, right: 0, top: 0, height: '58%' },
  close: {
    position: 'absolute',
    left: space.lg,
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    gap: space.lg,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: { gap: 4 },
  sub: { lineHeight: 21 },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  grow: { flex: 1, gap: 2 },
  statusRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 5,
    height: 9,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },
  battery: { width: 22, height: 13, borderWidth: 2, borderRadius: 3 },
  carDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
});
