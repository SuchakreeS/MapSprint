// "BADGES UNLOCKED" on the drive recap (design 10): a card per badge this drive unlocked, with a gold ring and its XP.
import { StyleSheet, Text, View } from 'react-native';

import { badgeByCode, type BadgeInfo } from '@/lib/badges';
import { formatCount } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { BadgeMark } from './BadgeMark';

export function UnlockedBadges({ codes }: { codes: readonly string[] }) {
  const { c, type, fonts } = useTheme();
  const badges = codes.map(badgeByCode).filter((b): b is BadgeInfo => b != null);
  if (badges.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[type.label, { color: c.muted }]}>
        BADGES UNLOCKED
      </Text>
      <View style={styles.grid}>
        {badges.map((b) => (
          <View key={b.code} style={styles.cell}>
            <View
              accessible
              accessibilityLabel={`${b.name} unlocked. ${b.rule}. Plus ${b.xp} XP`}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
              <BadgeMark mark={b.mark} size={44} ring />
              <Text style={[type.rowTitle, { color: c.text }]}>{b.name}</Text>
              <Text style={[type.small, { color: c.muted }]}>{b.rule}</Text>
              <Text style={[type.caption, { color: c.primaryText, fontFamily: fonts.bodyBold }]}>{`+${formatCount(b.xp)} XP`}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '50%', padding: 4 },
  card: { flex: 1, padding: space.md, borderRadius: radius.lg, borderWidth: 1, gap: space.xs },
});
