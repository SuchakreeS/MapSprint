// The badge tile (design 10, 20, 22): yellow tile with the badge's mark, or a dashed padlock tile when locked.
// `ring` adds the gold ring the recap uses for a freshly unlocked badge.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';

interface Props {
  mark: string;
  locked?: boolean;
  size?: number;
  ring?: boolean;
}

export function BadgeMark({ mark, locked = false, size = 48, ring = false }: Props) {
  const { c, fonts } = useTheme();
  const tile = (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.29 },
        locked
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.muted }
          : { backgroundColor: c.accentFill },
      ]}>
      {locked ? (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="5" y="11" width="14" height="10" rx="2" />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </Svg>
      ) : (
        <Text
          allowFontScaling={false}
          style={{ color: c.onAccent, fontFamily: fonts.headingBold, fontSize: mark.length > 2 ? size * 0.3 : size * 0.34 }}>
          {mark}
        </Text>
      )}
    </View>
  );
  if (!ring) return tile;
  // Gold ring with a surface-coloured gap, like the design's `0 0 0 3px surface, 0 0 0 4px gold`.
  return (
    <View style={[styles.ring, { borderColor: c.gold, borderRadius: size * 0.29 + 4, padding: 3 }]}>{tile}</View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 1, alignSelf: 'flex-start' },
});
