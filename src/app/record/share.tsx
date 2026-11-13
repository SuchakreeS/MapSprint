// Share drive as a picture (plan 3.6, design 11 without the feed parts). The card below is rendered on the phone, captured as a
// PNG and then saved to the photos or handed to the Android share sheet. Nothing is uploaded. Posting to the feed (title, who can
// see it) comes with the Feed in Phase 4, after privacy zones.
// Privacy: nothing within 300 m of the start or the finish is drawn by default (home / work), see src/lib/share-card.ts.
// Never shown: top speed (plan 3.10).
import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeMark } from '@/components/BadgeMark';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { RouteArt } from '@/components/RouteArt';
import { Switch } from '@/components/Switch';
import { APP_NAME } from '@/constants/app';
import { getUpload } from '@/features/recording/db';
import { loadDrive } from '@/features/recording/drive-history';
import { badgeByCode, type BadgeInfo } from '@/lib/badges';
import { driveTitle, formatDateTimeRange } from '@/lib/drive-format';
import { formatCount, formatDistanceKm, formatDuration } from '@/lib/format';
import { levelProgress } from '@/lib/levels';
import { SHARE_HIDE_ENDS_M, trimRouteEnds } from '@/lib/share-card';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function ShareScreen() {
  const { c, type, fonts } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sessionId = Number(id);
  const validId = Number.isInteger(sessionId) && sessionId > 0;
  const [drive] = useState(() => (validId ? loadDrive(sessionId) : null));
  const [upload] = useState(() => (validId ? getUpload(sessionId) : null));
  const server = upload?.state === 'counted' ? upload.stats : null;
  const [hideEnds, setHideEnds] = useState(true);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);

  const route = useMemo(() => (drive ? (hideEnds ? trimRouteEnds(drive.route, SHARE_HIDE_ENDS_M) : drive.route) : []), [drive, hideEnds]);

  if (!drive) {
    return (
      <SafeAreaView style={[styles.fill, styles.missing, { backgroundColor: c.bg }]}>
        <Text style={[type.heading, { color: c.text }]}>Drive not found</Text>
        <Button label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const s = drive.summary;
  const badges = (server?.badges ?? []).map(badgeByCode).filter((b): b is BadgeInfo => b != null);
  const level = server?.totalXp != null ? levelProgress(server.totalXp).level : null;

  /** The card as a temporary PNG file. */
  const capture = () => captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });

  const save = async () => {
    setBusy('save');
    setNote(null);
    let uri: string | null = null;
    try {
      uri = await capture();
      try {
        // Write-only: asks for nothing on Android 13+, and never for read access to the user's photos.
        await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      } catch {
        // Saving can still work without an explicit grant (Android 10+ writes through MediaStore); try it.
      }
      await MediaLibrary.Asset.create(uri);
      setNote('Saved to your photos.');
    } catch {
      setNote('Could not save the picture. Try Share… and save it from there.');
    } finally {
      if (uri) releaseCapture(uri); // the photo library keeps its own copy; remove the temp file
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    setNote(null);
    let uri: string | null = null;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setNote('Sharing is not available on this phone. Use Save to photos.');
        return;
      }
      uri = await capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your drive' });
    } catch {
      setNote('Could not open the share menu. Try Save to photos.');
    } finally {
      if (uri) releaseCapture(uri); // shareAsync resolves when the share sheet closes
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Header title="Share drive" onBack={() => router.back()} />

        {/* This view is what becomes the picture. collapsable={false}: Android must keep it as a real view to capture it. */}
        <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: c.bg, borderColor: c.line }]}>
          <View style={styles.cardTop}>
            <Text style={[type.wordmark, { color: c.primaryText }]}>{APP_NAME.toUpperCase()}</Text>
          </View>
          <View style={styles.titles}>
            <Text style={[type.sheetTitle, { color: c.text }]}>{driveTitle(drive.startedAt)}</Text>
            <Text style={[type.small, { color: c.muted }]}>{formatDateTimeRange(drive.startedAt, drive.endedAt, server?.elapsedS ?? s.elapsedS)}</Text>
          </View>

          <View style={[styles.route, { borderColor: c.line }]}>
            {route.length >= 2 ? (
              <RouteArt coords={route} height={220} thickness={4} glow markers={!hideEnds} grid="fine" padding={16} />
            ) : (
              <View style={styles.noRoute}>
                <Text style={[type.small, { color: c.muted, textAlign: 'center' }]}>Route hidden to protect where you start and finish</Text>
              </View>
            )}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[type.label, { color: c.muted }]}>DISTANCE</Text>
              <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 30 }}>
                {formatDistanceKm(server?.distanceM ?? s.distanceM)}
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}> km</Text>
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[type.label, { color: c.muted }]}>MOVING TIME</Text>
              <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 30 }}>{formatDuration(server?.movingS ?? s.movingS)}</Text>
            </View>
            {server?.xp ? (
              <View style={styles.stat}>
                <Text style={[type.label, { color: c.muted }]}>{level != null ? `XP · LEVEL ${level}` : 'XP'}</Text>
                <Text style={{ color: c.primaryText, fontFamily: fonts.displayBold, fontSize: 30 }}>{`+${formatCount(server.xp.total)}`}</Text>
              </View>
            ) : null}
          </View>

          {badges.length > 0 ? (
            <View style={styles.badges}>
              {badges.map((b) => (
                <View key={b.code} style={styles.badge}>
                  <BadgeMark mark={b.mark} size={32} />
                  <Text style={[type.caption, { color: c.text, fontFamily: fonts.bodyBold }]}>{b.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.option, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Switch
            label="Hide start and finish"
            caption={`Leaves out everything within ${SHARE_HIDE_ENDS_M} m of where you started and finished.`}
            value={hideEnds}
            onValueChange={setHideEnds}
          />
        </View>

        <Button label={busy === 'save' ? 'Saving…' : 'Save to photos'} onPress={save} disabled={busy != null} />
        <Button label={busy === 'share' ? 'Opening…' : 'Share…'} variant="secondary" onPress={share} disabled={busy != null} />
        {note ? (
          <Text accessibilityLiveRegion="polite" style={[type.small, { color: c.muted, textAlign: 'center' }]}>
            {note}
          </Text>
        ) : null}
        <Text style={[type.caption, { color: c.muted, textAlign: 'center' }]}>
          The picture is made on your phone and nothing is uploaded. Posting to the feed comes in a later update.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  wrap: { padding: space.lg, gap: space.md },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: space.lg, gap: space.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titles: { gap: space.xs },
  route: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  noRoute: { height: 220, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  stat: { gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  option: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.md },
});
