import { View } from 'react-native';

/** Solid play triangle drawn with borders (no SVG library needed). */
export function PlayGlyph({ color, size = 20 }: { color: string; size?: number }) {
  const half = size * 0.45;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 0,
        height: 0,
        borderTopWidth: half,
        borderBottomWidth: half,
        borderLeftWidth: size * 0.6,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
        marginLeft: size * 0.1,
      }}
    />
  );
}
