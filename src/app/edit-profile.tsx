// Edit profile: photo, username, display name. Same fields and rules as onboarding step 4 (design 04).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { CameraIcon, CheckIcon } from '@/components/icons';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/auth-provider';
import { pickAvatarPhoto, uploadAvatar, useAvatarUrl } from '@/features/auth/avatar-photo';
import { useUsernameField } from '@/features/auth/use-username-field';
import { supabase } from '@/features/sync/supabase';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const DISPLAY_NAME_MAX = 40;

export default function EditProfileScreen() {
  const { c, type } = useTheme();
  const { userId, profile, refreshProfile } = useAuth();
  const savedPhoto = useAvatarUrl(profile?.avatar_url);
  const { rawUsername, setRawUsername, username, status, hint, usable, markTaken } = useUsernameField(
    userId,
    profile?.username,
  );
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  /** A newly picked local photo, not uploaded yet. */
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = displayName.trim().slice(0, DISPLAY_NAME_MAX) || null;
  const changed = username !== (profile?.username ?? '') || name !== (profile?.display_name ?? null) || photo != null;
  const canSave = !!userId && usable && changed && !busy;

  const onPickPhoto = async () => {
    setError(null);
    try {
      const uri = await pickAvatarPhoto();
      if (uri) setPhoto(uri);
    } catch {
      setError('Could not open your photos.');
    }
  };

  const onSave = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('profiles').update({ username, display_name: name }).eq('id', userId);
      if (err) {
        if (err.code === '23505') markTaken();
        throw new Error(err.code === '23505' ? 'That username was just taken. Try another.' : 'Could not save. Check your connection.');
      }
      if (photo) {
        try {
          await uploadAvatar(userId, photo, profile?.avatar_url);
        } catch (e) {
          await refreshProfile(); // the name part did save
          throw e;
        }
      }
      await refreshProfile();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Header title="Edit profile" onBack={() => router.back()} />

        <View style={styles.avatarWrap}>
          <Avatar displayName={displayName} username={username} photoUri={photo ?? savedPhoto} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change photo"
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
          <Button label={busy ? 'Saving…' : 'Save'} onPress={onSave} disabled={!canSave} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.lg, gap: space.xl, flexGrow: 1 },
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
