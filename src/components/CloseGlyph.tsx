import { View } from 'react-native';

/** An X drawn with two rotated bars (no SVG library needed). */
export function CloseGlyph({ color, size = 20 }: { color: string; size?: number }) {
  const bar = { position: 'absolute' as const, width: size, height: 2, borderRadius: 1, backgroundColor: color };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}
