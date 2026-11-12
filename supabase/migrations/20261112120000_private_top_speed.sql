-- Plan 3.10 (PS decision 2026-11-12): private top speed.
--
-- A drive's top speed is visible ONLY to its owner (recap + History). It is never shared, ranked, rewarded or shown to anyone
-- else, so it lives in drive_private (owner-only: policy "drive_private: owner reads own", no insert/update grant for users;
-- only the finalize-drive Edge Function writes it with the secret key). NEVER as a column on drives: followers can read
-- public drive rows through the API.
--
-- top_kmh = the highest speed HELD for >= 3 s (src/lib/top-speed.ts, the same rule on the phone and in finalize-drive).

alter table public.drive_private
  add column top_kmh real check (top_kmh is null or (top_kmh >= 0 and top_kmh <= 250));

-- The old max_kmh was the max of the smoothed speed: one GPS glitch could inflate it, and nothing ever read it.
-- Dropped instead of copied: old drives get no top speed (no back-fill, PS decision).
alter table public.drive_private drop column max_kmh;

-- Top speed can not be shared at all, so the "Share max speed" setting is gone. Its column grant goes with the column;
-- no policy, view or function used it.
alter table public.profiles drop column share_max_speed;
