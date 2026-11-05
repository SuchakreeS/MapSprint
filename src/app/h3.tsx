import { cellsToMultiPolygon, gridPathCells, latLngToCell } from 'h3-js';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

// Expected values were computed with h3-js 4.5.0 in Node.
const EXPECTED = { start: '8964a4b138fffff', end: '8964a4ba0a3ffff', pathLen: 20, polys: 1 };

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

function runChecks(): { checks: Check[]; ms: number } {
  const t0 = Date.now();
  const checks: Check[] = [];
  try {
    const start = latLngToCell(13.7563, 100.5018, 9);
    const end = latLngToCell(13.79, 100.55, 9);
    checks.push({ name: 'latLngToCell (Bangkok, res 9)', pass: start === EXPECTED.start && end === EXPECTED.end, detail: `${start} → ${end}` });
    const path = gridPathCells(start, end);
    checks.push({ name: 'gridPathCells', pass: path.length === EXPECTED.pathLen, detail: `${path.length} cells` });
    const polys = cellsToMultiPolygon(path, true);
    checks.push({ name: 'cellsToMultiPolygon', pass: polys.length === EXPECTED.polys, detail: `${polys.length} polygon(s)` });
    // Speed test: 3,600 points ≈ one hour of driving at 1 Hz.
    const t1 = Date.now();
    for (let i = 0; i < 3600; i++) latLngToCell(13.75 + i * 0.00001, 100.5 + i * 0.00001, 9);
    const perHour = Date.now() - t1;
    checks.push({ name: '3,600 conversions (1 h drive)', pass: perHour < 1000, detail: `${perHour} ms` });
  } catch (e) {
    checks.push({ name: 'h3-js loaded', pass: false, detail: String(e) });
  }
  return { checks, ms: Date.now() - t0 };
}

export default function H3Spike() {
  const { c } = useTheme();
  const { checks, ms } = useMemo(() => runChecks(), []);
  const allPass = checks.length > 0 && checks.every((x) => x.pass);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[styles.result, { color: allPass ? c.success : c.danger }]}>
        {allPass ? 'PASS' : 'FAIL'} · {ms} ms total
      </Text>
      {checks.map((x) => (
        <View key={x.name} style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={{ color: x.pass ? c.success : c.danger, fontWeight: '700' }}>{x.pass ? 'PASS' : 'FAIL'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{x.name}</Text>
            <Text style={{ color: c.muted }}>{x.detail}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md },
  result: { fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
