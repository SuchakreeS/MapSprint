// Screen 04 Set up your profile (design 04, ScrProfileSetup.dc.html). Step 4 of 5.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { CameraIcon, CheckIcon } from '@/components/icons';
import { StepHeader } from '@/components/StepHeader';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/auth-provider';
import { pickAvatarPhoto, uploadAvatar } from '@/features/auth/avatar-photo';
import { supabase } from '@/features/sync/supabase';
import { normalizeUsername, usernameProblem, type UsernameProblem } from '@/lib/username';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const CHECK_DELAY_MS = 400;
const DISPLAY_NAME_MAX = 40;

const PROBLEM_TEXT: Record<UsernameProblem, string> = {
  'too-short': 'At least 3 characters.',
  'too-long': 'At most 20 characters.',
  'bad-chars': 'Use only a–z, 0–9, _ and .',
};

export default function AboutYouScreen() {
  const { c, type } = useTheme();
  const { userId, suggestedName, profile, refreshProfile } = useAuth();
  const [rawUsername, setRawUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? suggestedName ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  /** Result of the last availability check, tagged with the username it was for. */
  const [check, setCheck] = useState<{ u: string; taken: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = normalizeUsername(rawUsername);
  const problem = username.length > 0 ? usernameProblem(username) : null;

  // Debounced "is it free?" check. The unique constraint in the database is the final word on save.
  useEffect(() => {
    if (!userId || username.length === 0 || usernameProblem(username)) return;
    const timer = setTimeout(async () => {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .limit(1);
      if (err) return; // offline: never claim "available" without an answer; the save checks again
      setCheck({ u: username, taken: (data?.length ?? 0) > 0 });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [username, userId]);

  const known = check?.u === username ? check : null;
  const status = problem || known?.taken ? 'error' : known ? 'ok' : 'normal';
  const hint = problem
    ? PROBLEM_TEXT[problem]
    : known?.taken
      ? 'That username is taken.'
      : known
        ? 'Username is available'
        : username
          ? 'Checking…'
          : 'Friends find you by this.';

  const canSave = !!userId && username.length > 0 && !problem && known?.taken !== true && !busy;

  const onPickPhoto = async () => {
    setError(null);
    try {
      const uri = await pickAvatarPhoto();
      if (uri) setPhoto(uri);
    } catch {
      setError('Could not open your photos. You can add a photo later.');
    }
  };

  const onContinue = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const name = displayName.trim().slice(0, DISPLAY_NAME_MAX) || null;
      const { error: err } = await supabase.from('profiles').update({ username, display_name: name }).eq('id', userId);
      if (err) {
        if (err.code === '23505') setCheck({ u: username, taken: true });
        throw new Error(err.code === '23505' ? 'That username was just taken. Try another.' : 'Could not save. Check your connection.');
      }
      // The photo is optional: a failed upload must never trap the user on this step.
      if (photo) await uploadAvatar(userId, photo).catch(() => undefined);
      await refreshProfile(); // onboarding guard moves on to the car step
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <StepHeader step={4} total={5} />
        <View style={styles.block}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
            Set up your profile
          </Text>
          <Text style={[type.body, { color: c.muted }]}>Friends find you by your username.</Text>
        </View>

        <View style={styles.avatarWrap}>
          <Avatar displayName={displayName} username={username} photoUri={photo} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photo ? 'Change photo' : 'Add a photo (optional)'}
            onPress={onPickPhoto}
            style={[styles.camera, { backgroundColor: c.accentFill, borderColor: c.bg }]}>
            <CameraIcon color={c.onAccent} />
          </Pressable>
        </View>

        <TextField
          label="Username"
          prefix="@"
          value={rawUsername}
          onChangeText={setRawUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          status={status}
          hint={hint}
          trailing={status === 'ok' ? <CheckIcon color={c.success} /> : undefined}
        />
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
        />

        <View style={styles.actions}>
          {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
          <Button label={busy ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={!canSave} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.xl, gap: space.xl, flexGrow: 1 },
  block: { gap: space.sm },
  avatarWrap: { alignSelf: 'center' },
  camera: {
    position: 'absolute',
    right: -4,
    bottom: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: space.md, marginTop: 'auto' },
});
