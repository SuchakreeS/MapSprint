// Screen 22 Badges (design/screens/*/22-badges.png, design/source/ScrBadges.dc.html).
// 10 badges: unlocked ones with their date, locked ones with a progress meter, and the three that cannot be earned yet
// (Zen Driver needs the smooth score, District Hunter and Province Collector need district maps) as "Coming soon".
// The server awards badges when a drive is counted; this screen only reads them.
import { router, useFocusEffect } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeMark } from '@/components/BadgeMark';
import { Header } from '@/components/Header';
import { LockedFeature } from '@/components/LockedFeature';
import { useAuth } from '@/features/auth/auth-provider';
import { totalsOf, useBadges } from '@/features/game/use-badges';
import { BADGES, badgeProgress, formatBadgeDate, unlockedCount, type BadgeInfo } from '@/lib/badges';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function BadgeCard({ badge, unlockedAt, progress }: { badge: BadgeInfo; unlockedAt: string | undefined; progress: ReturnType<typeof badgeProgress> }) {
  const { c, type, fonts } = useTheme();
  const open = unlockedAt != null;
  return (
    <View
      accessible
      accessibilityLabel={`${badge.name}. ${badge.rule}. ${open ? `Unlocked ${formatBadgeDate(unlockedAt)}` : progress.kind === 'soon' ? 'Coming soon' : progress.text}`}
      style={[styles.card, { backgroundColor: c.surface, borderColor: open ? c.line : c.muted, borderStyle: open ? 'solid' : 'dashed' }]}>
      <BadgeMark mark={badge.mark} locked={!open} />
      <Text style={[type.rowTitle, { color: c.text }]}>{badge.name}</Text>
      <Text style={[type.small, { color: c.muted }]}>{badge.rule}</Text>
      {open ? (
        <Text style={[type.caption, { color: c.gold, fontFamily: fonts.bodyBold }]}>{`Unlocked ${formatBadgeDate(unlockedAt)}`}</Text>
      ) : progress.kind === 'soon' ? (
        <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyBold }]}>Coming soon</Text>
      ) : (
        <View style={styles.meter}>
          <View style={[styles.track, { backgroundColor: c.line }]}>
            <View style={[styles.fill, { backgroundColor: c.primary, width: `${Math.round(progress.fraction * 100)}%` }]} />
          </View>
          <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyBold }]}>{progress.text}</Text>
        </View>
      )}
    </View>
  );
}

export default function BadgesScreen() {
  const { c, type, fonts } = useTheme();
  const { guest, userId } = useAuth();
  const { data, refresh } = useBadges();
  useFocusEffect(refresh);
  const signedIn = !!userId && !guest;
  const [now] = useState(Date.now); // read the clock once (not while rendering) for the streak
  const totals = useMemo(() => totalsOf(data ?? { unlocked: {}, cells: 0, distanceM: 0, days: [] }, now), [data, now]);

  if (!signedIn) {
    return <LockedFeature title="Badges" pitch="Make an account to earn badges for your drives and the roads you explore." />;
  }

  const unlocked = data?.unlocked ?? {};
  const count = unlockedCount(Object.keys(unlocked));
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Header title="Badges" onBack={() => router.back()} />

        <View style={[styles.summary, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[type.body, { color: c.muted }]}>
            <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 28 }}>{count}</Text>
            {` of ${BADGES.length} unlocked`}
          </Text>
          <View style={[styles.track, { backgroundColor: c.line, height: 8, borderRadius: 4 }]}>
            <View style={[styles.fill, { backgroundColor: c.primary, height: 8, width: `${Math.round((count / BADGES.length) * 100)}%` }]} />
          </View>
        </View>

        {data == null ? <Text style={[type.caption, { color: c.muted }]}>Loading your badges…</Text> : null}

        <View style={styles.grid}>
          {BADGES.map((b) => (
            <View key={b.code} style={styles.cell}>
              <BadgeCard badge={b} unlockedAt={unlocked[b.code]} progress={badgeProgress(b.code, totals)} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.lg, gap: space.lg },
  summary: { padding: space.lg, borderRadius: 18, borderWidth: 1, gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '50%', padding: 4 },
  card: { flex: 1, padding: 14, borderRadius: 18, borderWidth: 1, gap: space.sm },
  meter: { gap: space.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
