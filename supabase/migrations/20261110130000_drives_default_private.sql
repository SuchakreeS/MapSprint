-- Security review of 2.4 (2026-11-10): new drives must NOT be visible to followers by default.
--
-- finalize-drive stores the (privacy-zone trimmed) route in drives.route. Nobody has privacy zones yet (the zones screen is a Phase 4
-- gate before the Feed), so for now the route is the FULL line from the user's front door. With the old default 'followers', any
-- signed-in person could follow a public account and read that route straight through the API, with no Feed involved. Zones added later
-- also do not re-trim routes that were already stored.
--
-- Until Settings has "Default drive visibility" (screen 27) and zones exist, every drive is private. Sharing is a Phase 4 decision.
alter table public.drives alter column visibility set default 'private';
update public.drives set visibility = 'private' where visibility <> 'private';
