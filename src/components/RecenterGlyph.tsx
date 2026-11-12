import { StyleSheet, View } from 'react-native';

/** Drawn crosshair for recenter buttons (no SVG library needed). */
export function RecenterGlyph({ color }: { color: string }) {
  return (
    <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ring, { borderColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
