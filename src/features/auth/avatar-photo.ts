// Profile photo (design 04): pick from the gallery (square crop) -> 512x512 JPEG -> Supabase Storage
// bucket "avatars" at <user_id>/avatar.jpg (RLS: only your own folder; tested in supabase/tests/rls_test.sql).
import { useEffect, useState } from 'react';

import { supabase } from '@/features/sync/supabase';

const BUCKET = 'avatars';
const SIZE = 512;
const SIGNED_URL_TTL_S = 60 * 60;

/** Lets the user pick and crop a photo. Returns a local 512x512 JPEG uri, or null if cancelled. */
export async function pickAvatarPhoto(): Promise<string | null> {
  const ImagePicker = await import('expo-image-picker');
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled) return null;

  // Width only: keeps the aspect ratio if the cropper ever returns a non-square image (no stretching).
  const rendered = await ImageManipulator.manipulate(res.assets[0].uri)
    .resize({ width: SIZE, height: null })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}

/** Uploads (replacing any old photo) and stores the path on the profile. Returns the storage path. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw new Error('Could not upload the photo. Check your connection and try again.');

  const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', userId);
  if (dbErr) throw new Error('Photo uploaded, but saving it to your profile failed. Try again.');
  return path;
}

/** A short-lived displayable URL for a stored avatar path (the bucket is private). */
export function useAvatarUrl(path: string | null | undefined): string | null {
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_S)
      .then(({ data }) => {
        if (alive && data?.signedUrl) setSigned({ path, url: data.signedUrl });
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return path && signed?.path === path ? signed.url : null;
}
