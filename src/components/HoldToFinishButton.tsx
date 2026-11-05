import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** How long the button must be held (safety rule, design/README.md warning 4). */
export const HOLD_MS = 800;

interface Props {
  /** Called once when the hold completes. May be async; the button re-arms when it settles. */
  onFinish: () => void | Promise<void>;
  /** True above 10 km/h: touches are ignored and any hold in progress is cancelled. */
  locked: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Flag drawn with Views (no SVG library needed). */
function FlagGlyph({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.flag}>
      <View style={[styles.pole, { backgroundColor: color }]} />
      <View style={[styles.cloth, { borderLeftColor: color }]} />
    </View>
  );
}

export function HoldToFinishButton({ onFinish, locked, label = 'Hold to finish', style }: Props) {
  const { c, type } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const busy = useRef(false);

  const reset = () => {
    progress.stopAnimation();
    progress.setValue(0);
  };

  const finish = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await onFinish();
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    if (locked) {
      progress.stopAnimation();
      progress.setValue(0);
    }
  }, [locked, progress]);

  const onPressIn = () => {
    if (locked || busy.current) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      progress.setValue(0);
      finish();
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold for one second to finish the drive"
      accessibilityState={{ disabled: locked }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (!locked) finish();
      }}
      onPressIn={onPressIn}
      onPressOut={reset}
      style={[styles.base, { backgroundColor: c.primary, opacity: locked ? 0.4 : 1 }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            backgroundColor: c.onPrimary,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
      <FlagGlyph color={c.onPrimary} />
      <Text style={[type.button, { color: c.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 60,
    borderRadius: radius.button,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  // Progress overlay, 22% like the design (design/source/Hud2.dc.html).
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.22 },
  flag: { width: 20, height: 20 },
  pole: { position: 'absolute', left: 3, top: 2, width: 2, height: 17, borderRadius: 1 },
  cloth: {
    position: 'absolute',
    left: 5,
    top: 3,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
