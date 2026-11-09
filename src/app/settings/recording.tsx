// Screen 28 Recording settings (design/screens/*/28-recording-settings.png).
// Voice lines is hidden until the voice feature exists (plan 3.7). "Remind me to finish" is an extra row (not in the design).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Divider, Segmented, SettingsGroup, SettingsPage, SwitchRow } from '@/components/SettingsRow';
import { Switch } from '@/components/Switch';
import {
  getAutoPauseMin,
  getAutoPauseOn,
  getFinishReminderOn,
  getKeepAwakeOn,
  getSoundOn,
  setAutoPauseMin,
  setAutoPauseOn,
  setFinishReminderOn,
  setKeepAwakeOn,
  setSoundOn,
} from '@/features/settings/prefs';
import { AUTO_PAUSE_CHOICES_MIN, type AutoPauseMin } from '@/lib/recording-settings';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const PAUSE_OPTIONS = AUTO_PAUSE_CHOICES_MIN.map((m) => ({ value: m, label: `${m} min` }));

export default function RecordingSettingsScreen() {
  const { c, type } = useTheme();
  const [autoPause, setAutoPause] = useState(getAutoPauseOn);
  const [pauseMin, setPauseMin] = useState<AutoPauseMin>(getAutoPauseMin);
  const [sound, setSound] = useState(getSoundOn);
  const [keepAwake, setKeepAwake] = useState(getKeepAwakeOn);
  const [reminder, setReminder] = useState(getFinishReminderOn);

  return (
    <SettingsPage title="Recording">
      <SettingsGroup>
        <SwitchRow>
          <Switch
            label="Auto-pause"
            caption="Pauses the drive when you have been stopped for a while."
            value={autoPause}
            onValueChange={(v) => {
              setAutoPause(v);
              setAutoPauseOn(v);
            }}
          />
        </SwitchRow>
        <Divider />
        <SwitchRow>
          <Switch
            label="Sound cues"
            caption="Soft chime for each new cell, jingle on level-up. (Sounds arrive in a later update.)"
            value={sound}
            onValueChange={(v) => {
              setSound(v);
              setSoundOn(v);
            }}
          />
        </SwitchRow>
        <Divider />
        <SwitchRow>
          <Switch
            label="Keep screen on"
            caption="While the app is open during a drive."
            value={keepAwake}
            onValueChange={(v) => {
              setKeepAwake(v);
              setKeepAwakeOn(v);
            }}
          />
        </SwitchRow>
        <Divider />
        <SwitchRow>
          <Switch
            label="Remind me to finish"
            caption="A notification if the drive sits stopped for a long time while your phone is locked."
            value={reminder}
            onValueChange={(v) => {
              setReminder(v);
              setFinishReminderOn(v);
            }}
          />
        </SwitchRow>
      </SettingsGroup>

      {autoPause && (
        <SettingsGroup>
          <Segmented
            label="Auto-pause after stopped for"
            options={PAUSE_OPTIONS}
            value={pauseMin}
            onChange={(m) => {
              setPauseMin(m);
              setAutoPauseMin(m);
            }}
          />
        </SettingsGroup>
      )}

      <View style={[styles.note, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[type.small, { color: c.muted }]}>
          Metric units only: km and km/h. Changing auto-pause also changes the moving time shown for drives already on
          this phone.
        </Text>
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radius.md, borderWidth: 1, padding: space.lg },
});
