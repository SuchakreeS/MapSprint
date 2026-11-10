// Screen 09 Saving drive (design/screens/*/09-saving-drive.png, design/source/ScrSaving.dc.html).
// Shown after Finish for a signed-in drive: the ring follows the real upload, then the recap opens with the server's final numbers.
// No signal: after 10 s the "safe on your phone" note takes over and "Open recap when ready" leaves the screen; the drive uploads
// by itself later (History shows "Waiting to upload").
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { getUpload } from '@/features/recording/db';
import { getUploadPhase, runUploadQueue } from '@/features/sync/upload-runner';
import { savingView, type StepState } from '@/lib/saving';
import { rejectReasonText } from '@/lib/upload-queue';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const RING = 168;
const STROKE = 8;
const R = 74;
const CIRC = 2 * Math.PI * R;

function Spinner({ color }: { color: string }) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
        <Path d="M12 3a9 9 0 1 1-9 9" />
      </Svg>
    </Animated.View>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const { c } = useTheme();
  if (state === 'working') return <Spinner color={c.primaryText} />;
  if (state === 'done') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={9} />
        <Path d="M8 12l3 3 5-6" />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2}>
      <Circle cx={12} cy={12} r={9} />
    </Svg>
  );
}

const STEP_WORD: Record<StepState, string> = { waiting: 'Waiting', working: 'Working…', done: 'Done' };

function StepRow({ title, state, last }: { title: string; state: StepState; last?: boolean }) {
  const { c, type, fonts } = useTheme();
  return (
    <View style={[styles.step, !last && { borderBottomWidth: 1, borderBottomColor: c.line }]}>
      <StepIcon state={state} />
      <Text style={[type.rowTitle, styles.grow, { color: state === 'waiting' ? c.muted : c.text, fontFamily: fonts.bodyBold }]}>{title}</Text>
      <Text style={[type.caption, { color: c.muted }]}>{STEP_WORD[state]}</Text>
    </View>
  );
}

export default function SavingScreen() {
  const { c, type, fonts } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sessionId = Number(id);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [row, setRow] = useState(() => getUpload(sessionId));

  // Re-read the queue row twice a second, and make sure the queue is running (Finish already started it).
  useEffect(() => {
    void runUploadQueue();
    const timer = setInterval(() => {
      setRow(getUpload(sessionId));
      setNow(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, [sessionId]);

  const view = savingView(row, getUploadPhase(sessionId), now - startedAt);
  const openRecap = () => router.replace({ pathname: '/record/recap', params: { id: String(sessionId) } });

  // Counted (or nothing to count): the recap opens by itself.
  const go = view.outcome === 'counted' || view.outcome === 'local';
  useEffect(() => {
    if (go) router.replace({ pathname: '/record/recap', params: { id: String(sessionId) } });
  }, [go, sessionId]);

  const dash = (CIRC * view.percent) / 100;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.center}>
        <View style={styles.ringBox}>
          <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} style={StyleSheet.absoluteFill}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={c.line} strokeWidth={STROKE} />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke={c.primaryText}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View style={styles.ringText}>
            <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 48, lineHeight: 48 }}>{view.percent}%</Text>
            <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyBold }]}>{view.label}</Text>
          </View>
        </View>

        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[type.sheetTitle, { color: c.text, textAlign: 'center' }]}>
            {view.outcome === 'rejected' ? "Couldn't count this drive" : 'Saving your drive'}
          </Text>
          <Text style={[type.body, { color: c.muted, textAlign: 'center' }]}>
            {view.outcome === 'rejected' ? rejectReasonText(row?.reason) : 'Checking your track and adding up your numbers.'}
          </Text>
        </View>

        <View style={[styles.steps, { backgroundColor: c.surface, borderColor: c.line }]}>
          <StepRow title="Track cleaned" state={view.steps.cleaned} />
          <StepRow title="Speed and distance" state={view.steps.speed} last />
        </View>

        <View style={[styles.note, { backgroundColor: c.surface2, opacity: view.noSignal ? 1 : 0.75 }]}>
          <Text style={[type.small, styles.grow, { color: c.muted }]}>
            No signal? Your drive is safe on your phone and uploads by itself when you&apos;re back online.
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        {view.outcome === 'rejected' ? (
          <Button label="View on this phone" onPress={openRecap} />
        ) : (
          <Button label="Open recap when ready" variant="ghost" onPress={() => router.replace('/')} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: space.xl },
  ringBox: { width: RING, height: RING },
  ringText: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  titles: { alignItems: 'center', gap: space.sm },
  steps: { alignSelf: 'stretch', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: 4 },
  step: { height: 52, flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  note: { alignSelf: 'stretch', borderRadius: radius.notice, padding: space.md },
  bottom: { paddingHorizontal: space.xl, paddingBottom: space.lg },
});
