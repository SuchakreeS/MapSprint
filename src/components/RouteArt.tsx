import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fitRoute, type Pt } from '@/lib/route-art';
import type { RouteCoord } from '@/lib/route-line';
import { useTheme } from '@/theme/use-theme';

interface Props {
  coords: RouteCoord[];
  height: number;
  /** Fixed width; otherwise fills the parent. */
  width?: number;
  /** Route line thickness in px. */
  thickness?: number;
  /** Soft wider line under the route (recap). */
  glow?: boolean;
  /** Start ring and end dot (recap). */
  markers?: boolean;
  /** `fine` = blueprint grid, `cross` = two centre lines, `none`. */
  grid?: 'fine' | 'cross' | 'none';
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

const GRID_STEP = 14;

function Segment({ a, b, thickness, color, opacity = 1 }: { a: Pt; b: Pt; thickness: number; color: string; opacity?: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: (a.x + b.x) / 2 - len / 2,
        top: (a.y + b.y) / 2 - thickness / 2,
        width: len,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        opacity,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}

/**
 * A route drawn on a blueprint grid, built from Views (no SVG library). North is up and the
 * true shape is kept. Colours come from the theme: the route is `primary`, the grid is `muted`.
 */
export function RouteArt({
  coords,
  height,
  width,
  thickness = 3,
  glow = false,
  markers = false,
  grid = 'cross',
  padding = 8,
  style,
}: Props) {
  const { c } = useTheme();
  const [measured, setMeasured] = useState(0);
  const w = width ?? measured;

  const pts = useMemo(() => (w > 0 ? fitRoute(coords, w, height, padding) : []), [coords, w, height, padding]);

  const verticals = grid === 'fine' ? Math.floor(w / GRID_STEP) : 0;
  const horizontals = grid === 'fine' ? Math.floor(height / GRID_STEP) : 0;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={width == null ? (e) => setMeasured(e.nativeEvent.layout.width) : undefined}
      style={[{ height, width: width ?? '100%', overflow: 'hidden' }, style]}>
      {grid === 'cross' && w > 0 && (
        <>
          <View style={[styles.line, { left: 0, right: 0, top: height / 2, height: 1, backgroundColor: c.muted, opacity: 0.4 }]} />
          <View style={[styles.line, { top: 0, bottom: 0, left: w / 2, width: 1, backgroundColor: c.muted, opacity: 0.4 }]} />
        </>
      )}
      {Array.from({ length: verticals }, (_, i) => (
        <View key={`v${i}`} style={[styles.line, { top: 0, bottom: 0, left: (i + 1) * GRID_STEP, width: 1, backgroundColor: c.muted, opacity: 0.18 }]} />
      ))}
      {Array.from({ length: horizontals }, (_, i) => (
        <View key={`h${i}`} style={[styles.line, { left: 0, right: 0, top: (i + 1) * GRID_STEP, height: 1, backgroundColor: c.muted, opacity: 0.18 }]} />
      ))}

      {glow &&
        pts.slice(1).map((p, i) => (
          <Segment key={`g${i}`} a={pts[i]} b={p} thickness={thickness * 2.5} color={c.primary} opacity={0.18} />
        ))}
      {pts.slice(1).map((p, i) => (
        <Segment key={`r${i}`} a={pts[i]} b={p} thickness={thickness} color={c.primary} />
      ))}

      {markers && pts.length > 0 && (
        <>
          <View style={[styles.start, { left: pts[0].x - 6, top: pts[0].y - 6, backgroundColor: c.bg, borderColor: c.primary }]} />
          <View
            style={[
              styles.end,
              { left: pts[pts.length - 1].x - 7, top: pts[pts.length - 1].y - 7, backgroundColor: c.primary, borderColor: c.bg },
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute' },
  start: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  end: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
});
