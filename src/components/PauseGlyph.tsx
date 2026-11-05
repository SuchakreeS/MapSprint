import { View } from 'react-native';

/** Two solid bars drawn with Views (no SVG library needed). */
export function PauseGlyph({ color, size = 20 }: { color: string; size?: number }) {
  const bar = { width: size * 0.2, height: size * 0.75, borderRadius: 2, backgroundColor: color };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: size * 0.2 }}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}
