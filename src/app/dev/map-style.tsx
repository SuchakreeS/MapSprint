// THROWAWAY (plan 3.0 map style spike). Not linked from the app. Open it with:
//   adb shell am start -a android.intent.action.VIEW -d "mapsprint://dev/map-style" com.suchakree.mapsprint
// Delete this file and src/features/dev/ after the decision is written in handoff.md ("Spike 3.0").
import {
  Camera,
  FillExtrusionLayer,
  FillLayer,
  LineLayer,
  MapView,
  ShapeSource,
  StyleImport,
  VectorSource,
} from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAP_STYLE } from '@/features/map/map-style';
import {
  buildingStats,
  emptyFc,
  exploredCells,
  exploredOutlineFc,
  fogFc,
  hexGridFc,
  pickBuildingsInCells,
  PLACES,
  squareGridFc,
  type BuildingStats,
  type FC,
} from '@/features/dev/map-style-spike';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type StyleKind = 'classic' | 'std' | 'stdurl';
type Place = 'bangkok' | 'pathum' | 'me';
type Ext = 'off' | 'all' | 'std' | 'own' | 'js';
type Grid = 'off' | 'square' | 'hex';

const STANDARD_URL = 'mapbox://styles/mapbox/standard';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c, type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? c.primary : c.surface2, borderColor: c.line }]}>
      <Text style={[type.caption, { color: on ? c.onPrimary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  const { c, type } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type.label, { color: c.muted }]}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export default function MapStyleSpike() {
  const { mode, c, type } = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<React.ComponentRef<typeof Camera>>(null);
  const mapRef = useRef<React.ComponentRef<typeof MapView>>(null);

  const [styleKind, setStyleKind] = useState<StyleKind>('std');
  const [preset, setPreset] = useState<'dawn' | 'day' | 'dusk' | 'night'>('night');
  const [theme, setTheme] = useState<'default' | 'faded' | 'monochrome'>('default');
  const [tuned, setTuned] = useState(false);
  const [place, setPlace] = useState<Place>('bangkok');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [pitch, setPitch] = useState(60);
  const [fogOn, setFogOn] = useState(true);
  const [fogOpacity, setFogOpacity] = useState(0.75);
  const [slot, setSlot] = useState<'middle' | 'top'>('middle');
  const [grid, setGrid] = useState<Grid>('square');
  const [outline, setOutline] = useState(true);
  const [ext, setExt] = useState<Ext>('std');
  const [clipLabels, setClipLabels] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [probe, setProbe] = useState(false);
  const [note, setNote] = useState('');
  const [stats, setStats] = useState<BuildingStats | null>(null);
  const [picked, setPicked] = useState<FC>(emptyFc);

  // FPS test (question 5): refs for the hot path, state only once per second.
  const [orbit, setOrbit] = useState(false);
  const [fps, setFps] = useState({ cur: 0, avg: 0, min: 0, secs: 0 });
  const frames = useRef(0);
  const acc = useRef({ sum: 0, n: 0, min: 999 });

  const point = place === 'me' && me ? me : place === 'me' ? PLACES.bangkok : PLACES[place];
  const { lat, lng } = point;
  const cells = useMemo(() => exploredCells(lat, lng), [lat, lng]);
  const fog = useMemo(() => fogFc(lat, lng, cells), [lat, lng, cells]);
  const outlineFc = useMemo(() => exploredOutlineFc(cells), [cells]);
  const gridFc = useMemo(
    () => (grid === 'square' ? squareGridFc(lat, lng) : grid === 'hex' ? hexGridFc(lat, lng) : emptyFc()),
    [grid, lat, lng],
  );

  const isStd = styleKind !== 'classic';
  const show3d = ext === 'all' || ext === 'std';
  const stdConfig = useMemo(
    () => ({
      lightPreset: preset,
      theme,
      show3dBuildings: show3d,
      show3dObjects: show3d,
      show3dLandmarks: show3d,
      show3dFacades: show3d,
      show3dTrees: false,
      ...(tuned
        ? {
            colorLand: c.surface,
            colorRoads: c.surface2,
            colorMotorways: c.gold,
            colorWater: c.bg,
            colorBuildings: c.surface2,
            colorGreenspaces: c.surface,
          }
        : {}),
    }),
    [preset, theme, show3d, tuned, c],
  );

  // Standard as a style JSON so we can add a CLIP layer (the rnmapbox library has no component for it).
  const styleJSON = useMemo(() => {
    const layers: unknown[] = [];
    // Own 3D layer inside the JSON: the rnmapbox FillExtrusionLayer component has no `slot` prop, a JSON layer does.
    if (ext === 'own' || ext === 'js') {
      layers.push({
        id: 'own-3d',
        type: 'fill-extrusion',
        source: 'streets',
        'source-layer': 'building',
        minzoom: 13,
        slot: 'middle',
        filter: ['any', ['==', ['get', 'extrude'], 'true'], ['==', ['get', 'extrude'], true]],
        paint: {
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-color': c.muted,
          'fill-extrusion-opacity': ext === 'own' ? 0.85 : 0,
        },
      });
    }
    if (ext === 'std') {
      layers.push({
        id: 'clip-unexplored',
        type: 'clip',
        source: 'unexplored',
        slot: 'top',
        layout: { 'clip-layer-types': clipLabels ? ['model', 'symbol'] : ['model'] },
      });
    }
    return JSON.stringify({
      version: 8,
      name: 'spike-standard',
      imports: [{ id: 'basemap', url: STANDARD_URL, config: stdConfig }],
      sources: {
        unexplored: { type: 'geojson', data: fog },
        streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      },
      layers,
    });
  }, [ext, clipLabels, stdConfig, fog, c.muted]);

  // Remount the map when the style itself changes (the style JSON is fixed at load).
  const mapKey =
    styleKind === 'std'
      ? `std-${styleJSON.length}-${preset}-${theme}-${tuned}-${ext}-${clipLabels}-${place}`
      : styleKind === 'stdurl'
        ? 'stdurl'
        : `classic-${mode}`;

  useEffect(() => {
    if (place !== 'me' || me) return;
    let alive = true;
    (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        const pos = last ?? (await Location.getCurrentPositionAsync({}));
        if (alive) setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        if (alive) setNote('No location yet (open Pre-drive once, or turn GPS on).');
      }
    })();
    return () => {
      alive = false;
    };
  }, [place, me]);

  useEffect(() => {
    if (!orbit) return;
    frames.current = 0;
    acc.current = { sum: 0, n: 0, min: 999 };
    let heading = 0;
    let secs = 0;
    const id = setInterval(() => {
      heading = (heading + 30) % 360;
      cameraRef.current?.setCamera({ heading, animationDuration: 1000, animationMode: 'linearTo' });
      const cur = frames.current;
      frames.current = 0;
      secs++;
      const a = acc.current;
      a.sum += cur;
      a.n++;
      a.min = Math.min(a.min, cur);
      setFps({ cur, avg: Math.round(a.sum / a.n), min: a.min, secs });
    }, 1000);
    return () => clearInterval(id);
  }, [orbit]);

  const jsonHasSource = styleKind === 'std' && (ext === 'own' || ext === 'js');
  const needSource = styleKind !== 'std' && (ext === 'own' || ext === 'js' || probe);

  const queryBuildings = async (): Promise<FC | null> => {
    if (!mapRef.current) return null;
    if (styleKind === 'std' && !jsonHasSource) {
      setNote('Pick "Own 3D layer" or "Own 3D: JS pick" first (the JSON style only loads building tiles then).');
      return null;
    }
    if (!needSource && styleKind !== 'std') {
      setProbe(true);
      await sleep(1800); // let the building tiles load
    }
    try {
      return await mapRef.current.querySourceFeatures('streets', [], ['building']);
    } catch (e) {
      setNote(`Query failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setProbe(false);
    }
  };

  const countBuildings = async () => {
    setNote('Counting…');
    const fc = await queryBuildings();
    if (!fc) return;
    setStats(buildingStats(fc));
    setNote('');
  };

  const pickBuildings = async () => {
    setNote('Picking…');
    const t0 = Date.now();
    const fc = await queryBuildings();
    if (!fc) return;
    const keep = pickBuildingsInCells(fc, cells);
    setPicked(keep);
    setNote(`JS pick: ${keep.features.length} of ${fc.features.length} buildings in ${Date.now() - t0} ms`);
  };

  const extStyle = {
    fillExtrusionHeight: ['coalesce', ['get', 'height'], 8] as never,
    fillExtrusionBase: ['coalesce', ['get', 'min_height'], 0] as never,
    fillExtrusionColor: c.muted,
    fillExtrusionOpacity: 0.85,
  };
  const layerPos = isStd ? { slot } : { belowLayerID: 'road-label' };

  const map = (
    <MapView
      key={mapKey}
      ref={mapRef}
      style={styles.fill}
      {...(styleKind === 'std' ? { styleJSON } : { styleURL: styleKind === 'stdurl' ? STANDARD_URL : MAP_STYLE[mode] })}
      scaleBarEnabled={false}
      compassEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
      onDidFinishRenderingFrame={() => {
        frames.current++;
      }}>
      <Camera
        ref={cameraRef}
        centerCoordinate={[lng, lat]}
        zoomLevel={16}
        pitch={pitch}
        animationDuration={0}
      />
      {styleKind === 'stdurl' ? <StyleImport id="basemap" existing config={stdConfig} /> : null}

      {fogOn ? (
        <ShapeSource id="fog" shape={fog}>
          <FillLayer
            id="fog-fill"
            {...layerPos}
            style={{ fillColor: c.bg, fillOpacity: fogOpacity }}
          />
        </ShapeSource>
      ) : null}
      {grid !== 'off' ? (
        <ShapeSource id="grid" shape={gridFc}>
          <LineLayer
            id="grid-line"
            {...layerPos}
            style={{ lineColor: c.muted, lineOpacity: grid === 'hex' ? 0.5 : 0.3, lineWidth: 0.7 }}
          />
        </ShapeSource>
      ) : null}
      {outline ? (
        <ShapeSource id="outline" shape={outlineFc}>
          <LineLayer id="outline-line" {...layerPos} style={{ lineColor: c.primary, lineWidth: 2 }} />
        </ShapeSource>
      ) : null}

      {needSource ? (
        <VectorSource id="streets" url="mapbox://mapbox.mapbox-streets-v8">
          <FillExtrusionLayer
            id="own-3d"
            sourceID="streets"
            sourceLayerID="building"
            minZoomLevel={13}
            maxZoomLevel={22}
            filter={['any', ['==', ['get', 'extrude'], 'true'], ['==', ['get', 'extrude'], true]] as never}
            style={{ ...extStyle, fillExtrusionOpacity: ext === 'own' ? 0.85 : 0 }}
          />
        </VectorSource>
      ) : null}
      {ext === 'js' ? (
        <ShapeSource id="picked" shape={picked}>
          <FillExtrusionLayer id="picked-3d" minZoomLevel={13} maxZoomLevel={22} style={extStyle} />
        </ShapeSource>
      ) : null}
    </MapView>
  );

  const clipNote =
    ext === 'std' && styleKind !== 'std'
      ? 'Clip needs the "Standard (JSON)" style.'
      : ext === 'own' && styleKind === 'classic'
        ? 'Classic has no clip: own 3D shows everywhere.'
        : '';

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {map}

      <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Chip label="Exit" on={false} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Chip label={panelOpen ? 'Hide panel' : 'Show panel'} on={false} onPress={() => setPanelOpen((v) => !v)} />
        <View style={[styles.pill, { backgroundColor: c.overlayPill }]}>
          <Text style={[type.caption, { color: c.text }]}>
            {orbit ? `FPS ${fps.cur} · avg ${fps.avg} · min ${fps.min} · ${Math.floor(fps.secs / 60)}m${fps.secs % 60}s` : 'FPS: press Orbit'}
          </Text>
        </View>
      </View>

      {panelOpen ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: c.overlayPill, borderColor: c.line, paddingBottom: insets.bottom + 8 },
          ]}>
          <ScrollView style={styles.scroll}>
            <Row title="STYLE">
              <Chip label="Classic" on={styleKind === 'classic'} onPress={() => setStyleKind('classic')} />
              <Chip label="Standard (JSON + clip)" on={styleKind === 'std'} onPress={() => setStyleKind('std')} />
              <Chip label="Standard (URL)" on={styleKind === 'stdurl'} onPress={() => setStyleKind('stdurl')} />
            </Row>
            {isStd ? (
              <>
                <Row title="LIGHT PRESET">
                  {(['dawn', 'day', 'dusk', 'night'] as const).map((p) => (
                    <Chip key={p} label={p} on={preset === p} onPress={() => setPreset(p)} />
                  ))}
                </Row>
                <Row title="THEME / COLOURS">
                  {(['default', 'faded', 'monochrome'] as const).map((t) => (
                    <Chip key={t} label={t} on={theme === t} onPress={() => setTheme(t)} />
                  ))}
                  <Chip label="Tuned to Onyx/Pearl" on={tuned} onPress={() => setTuned((v) => !v)} />
                </Row>
              </>
            ) : null}
            <Row title="PLACE">
              <Chip label="Bangkok" on={place === 'bangkok'} onPress={() => setPlace('bangkok')} />
              <Chip label="Pathum Thani" on={place === 'pathum'} onPress={() => setPlace('pathum')} />
              <Chip label="My location" on={place === 'me'} onPress={() => setPlace('me')} />
              <Chip label={pitch === 60 ? 'Pitch 60' : 'Pitch 0'} on={pitch === 60} onPress={() => setPitch((p) => (p === 60 ? 0 : 60))} />
            </Row>
            <Row title="FOG">
              <Chip label={fogOn ? 'Fog on' : 'Fog off'} on={fogOn} onPress={() => setFogOn((v) => !v)} />
              {[0.6, 0.75, 0.9].map((o) => (
                <Chip key={o} label={String(o)} on={fogOpacity === o} onPress={() => setFogOpacity(o)} />
              ))}
              {isStd ? (
                <Chip label={`Slot: ${slot}`} on={false} onPress={() => setSlot((s) => (s === 'middle' ? 'top' : 'middle'))} />
              ) : null}
            </Row>
            <Row title="GRID / OUTLINE">
              {(['off', 'square', 'hex'] as const).map((g) => (
                <Chip key={g} label={g} on={grid === g} onPress={() => setGrid(g)} />
              ))}
              <Chip label="Explored outline" on={outline} onPress={() => setOutline((v) => !v)} />
            </Row>
            <Row title="3D BUILDINGS">
              <Chip label="Off" on={ext === 'off'} onPress={() => setExt('off')} />
              <Chip label="Everywhere (Standard)" on={ext === 'all'} onPress={() => setExt('all')} />
              <Chip label="Explored only: clip" on={ext === 'std'} onPress={() => setExt('std')} />
              <Chip label="Own 3D layer" on={ext === 'own'} onPress={() => setExt('own')} />
              <Chip label="Own 3D: JS pick" on={ext === 'js'} onPress={() => setExt('js')} />
              {ext === 'std' ? (
                <Chip label="Clip hides labels too" on={clipLabels} onPress={() => setClipLabels((v) => !v)} />
              ) : null}
            </Row>
            <Row title="TESTS">
              <Chip label="Count buildings" on={false} onPress={countBuildings} />
              {ext === 'js' ? <Chip label="Pick buildings" on={false} onPress={pickBuildings} /> : null}
              <Chip label={orbit ? 'Stop orbit' : 'Orbit (FPS)'} on={orbit} onPress={() => setOrbit((v) => !v)} />
            </Row>
            {stats ? (
              <Text style={[type.caption, { color: c.text }]}>
                Buildings loaded {stats.total} · extruded {stats.extruded} · with real height {stats.withHeight} ({stats.heightPct}%)
              </Text>
            ) : null}
            {clipNote ? <Text style={[type.caption, { color: c.danger }]}>{clipNote}</Text> : null}
            {note ? <Text style={[type.caption, { color: c.muted }]}>{note}</Text> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  pill: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.sm },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '52%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    paddingHorizontal: space.md,
  },
  scroll: { flexGrow: 0 },
  row: { marginBottom: space.sm, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
});
