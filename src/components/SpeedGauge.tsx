import { StyleSheet, Text, View } from 'react-native';

import { REDLINE_START, gaugeFraction } from '@/lib/hud';
import { formatSpeedKmh } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

// Geometry from design/source/Hud2.dc.html: 240x164 box, arc radius 96 centred at (120, 112),
// 240 degrees of sweep, 8 px stroke. Drawn with small rotated segments so no SVG library is needed;
// swap this file's body for an SVG arc if react-native-svg is added later.
const W = 240;
const H = 164;
const CX = 120;
const CY = 112;
const R = 96;
const STROKE = 8;
const SWEEP = 240;
const SEGMENTS = 80;
const SEG_LEN = (2 * Math.PI * R * (SWEEP / 360)) / SEGMENTS + 1.5; // slight overlap, no gaps

interface Props {
  /** Smoothed speed in km/h, or null when unknown. */
  kmh: number | null;
}

export function SpeedGauge({ kmh }: Props) {
  const { c, type } = useTheme();
  const fill = gaugeFraction(kmh);

  return (
    <View
      accessible
      accessibilityLabel={kmh == null ? 'Speed unknown' : `Speed ${formatSpeedKmh(kmh)} kilometres per hour`}
      style={styles.box}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const t = (i + 0.5) / SEGMENTS;
        const deg = -SWEEP / 2 + t * SWEEP; // clockwise from 12 o'clock
        const rad = (deg * Math.PI) / 180;
        const filled = t <= fill;
        const red = t >= REDLINE_START;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: SEG_LEN,
              height: STROKE,
              left: CX + R * Math.sin(rad) - SEG_LEN / 2,
              top: CY - R * Math.cos(rad) - STROKE / 2,
              transform: [{ rotate: `${deg}deg` }],
              backgroundColor: filled ? c.primary : red ? c.danger : c.line,
              opacity: !filled && red ? 0.5 : 1,
            }}
          />
        );
      })}

      <View style={styles.center}>
        <Text style={[type.hudNumber, { color: c.text }]}>{formatSpeedKmh(kmh)}</Text>
        <Text style={[type.label, styles.unit, { color: c.muted }]}>KM/H</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: W, height: H },
  center: { position: 'absolute', left: 0, right: 0, top: 40, alignItems: 'center' },
  unit: { marginTop: 2, letterSpacing: 1.9 },
});
