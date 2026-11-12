// Map tab (design 17, core only; plan 3.4): the blueprint fog over Mapbox Standard, the explored-cells card, recenter and a
// 3D toggle. 3D buildings stand only inside explored cells (a clip layer in the style JSON). Never shown while recording.
// Not here yet: the All time / This week switch and the Districts sheet (plan 3.8).
import { Camera, LocationPuck, MapView } from '@rnmapbox/maps';
import { useFocusEffect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecenterGlyph } from '@/components/RecenterGlyph';
import { useExploredCells } from '@/features/map/explored';
import { FogLayers } from '@/features/map/FogLayers';
import { exploredAreaKm2, fogFeature, WORLD_BOX } from '@/lib/fog';
import { formatCount } from '@/lib/format';
import { standardStyleJSON } from '@/lib/map-style';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Bangkok, for when there is no location yet. */
const DEFAULT_CENTER: [number, number] = [100.5018, 13.7563];

export default function MapTab() {
  const { mode, c, type, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const { cells, refresh } = useExploredCells();
  const [following, setFollowing] = useState(true);
  const [threeD, setThreeD] = useState(false);
  const [gridCenter, setGridCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Coming back from a recap: read the cells again (the drive may have just been counted).
  useFocusEffect(refresh);

  // 3D: the clip polygon (= the fog) lives inside the style JSON, so the style is rebuilt when the cells change.
  const styleJSON = useMemo(
    () => standardStyleJSON(mode, c, threeD ? { threeD: { clip: fogFeature(cells, WORLD_BOX) } } : undefined),
    [mode, c, threeD, cells],
  );
  const area = useMemo(() => exploredAreaKm2(cells), [cells]);
  const count = cells.size;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <MapView
        key={`${mode}-${threeD ? `3d-${count}` : 'flat'}`}
        style={styles.fill}
        styleJSON={styleJSON}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onMapIdle={(state) => {
          const [lng, lat] = state.properties.center;
          setGridCenter({ lat, lng });
        }}>
        <Camera
          followUserLocation={following}
          followZoomLevel={14}
          followPitch={threeD ? 60 : 0}
          pitch={threeD ? 60 : 0}
          defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: 11 }}
          onUserTrackingModeChange={(e) => {
            if (!e.nativeEvent.payload.followUserLocation) setFollowing(false);
          }}
        />
        <FogLayers cells={cells} box={WORLD_BOX} gridCenter={gridCenter} />
        <LocationPuck pulsing={{ isEnabled: true }} />
      </MapView>

      <View
        accessible
        accessibilityLabel={`${formatCount(count)} cells explored, area ${area.toFixed(1)} square kilometres`}
        style={[styles.card, { top: insets.top + space.sm, backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.cardRow}>
          <View>
            <Text style={[type.label, { color: c.muted }]}>CELLS EXPLORED</Text>
            <Text style={[type.statTile, { color: c.text }]}>{formatCount(count)}</Text>
          </View>
          <View style={styles.right}>
            <Text style={[type.label, { color: c.muted }]}>AREA</Text>
            <Text style={[type.statTile, { color: c.text }]}>
              {area.toFixed(1)}
              <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyMedium }]}> km²</Text>
            </Text>
          </View>
        </View>
        {count === 0 ? <Text style={[type.caption, { color: c.muted }]}>Drive to clear the fog</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={threeD ? 'Hide 3D buildings' : 'Show 3D buildings'}
        onPress={() => setThreeD((v) => !v)}
        style={[styles.button, styles.threeD, { backgroundColor: threeD ? c.accentFill : c.surface, borderColor: c.line }]}>
        <Text style={[type.caption, { fontFamily: fonts.bodyBold, color: threeD ? c.onAccent : c.text }]}>
          {threeD ? '2D' : '3D'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter map on your location"
        onPress={() => setFollowing(true)}
        style={[styles.button, styles.recenter, { backgroundColor: c.surface, borderColor: c.line }]}>
        <RecenterGlyph color={c.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    padding: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: space.xs,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  right: { alignItems: 'flex-end' },
  button: {
    position: 'absolute',
    right: space.lg,
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenter: { bottom: space.lg },
  threeD: { bottom: space.lg + 48 + space.sm },
});
