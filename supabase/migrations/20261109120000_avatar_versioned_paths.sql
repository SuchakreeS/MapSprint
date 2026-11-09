-- Edit profile: each new photo gets its own file name (<uid>/avatar-<ms>.jpg), so a changed photo never shows a
-- cached old one. The profile may still only point at a file in the user's OWN folder.
-- Same rule as src/lib/avatar.ts isOwnAvatarPath (keep both in sync).
alter table public.profiles drop constraint profiles_avatar_url_own;

alter table public.profiles
  add constraint profiles_avatar_url_own check (
    avatar_url is null
    or avatar_url ~ ('^' || id::text || '/avatar(-[0-9]{1,16})?\.jpg$')
  );
