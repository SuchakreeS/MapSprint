// Profile tab badges row (design 20): "BADGES · x OF 10", up to four unlocked marks (newest first) and "See all".
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBadges } from '@/features/game/use-badges';
import { BADGES, badgeByCode, unlockedCount } from '@/lib/badges';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { BadgeMark } from './BadgeMark';

export function ProfileBadges() {
  const { c, type, fonts } = useTheme();
  const { data, refresh } = useBadges();
  useFocusEffect(refresh);
  const entries = Object.entries(data?.unlocked ?? {})
    .filter(([code]) => badgeByCode(code))
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 4);
  const count = unlockedCount(Object.keys(data?.unlocked ?? {}));
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.head}>
        <Text style={[type.label, { color: c.muted }]}>{`BADGES · ${count} OF ${BADGES.length}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all badges" onPress={() => router.push('/badges')} hitSlop={12}>
          <Text style={[type.small, { color: c.primaryText, fontFamily: fonts.bodyBold }]}>See all</Text>
        </Pressable>
      </View>
      {entries.length > 0 ? (
        <View style={styles.marks}>
          {entries.map(([code]) => (
            <BadgeMark key={code} mark={badgeByCode(code)?.mark ?? ''} size={44} />
          ))}
        </View>
      ) : (
        <Text style={[type.small, { color: c.muted }]}>Your first badge comes with your first drive.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marks: { flexDirection: 'row', gap: space.sm },
});
