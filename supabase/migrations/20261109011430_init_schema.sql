-- ============ Extensions ============
create extension if not exists postgis with schema extensions;

-- ============ profiles ============
-- One row per user. Created automatically on sign-up (trigger below).
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name    text check (char_length(display_name) <= 40),
  avatar_url      text,
  is_private      boolean not null default false,
  share_max_speed boolean not null default false,
  province        text,
  -- server-only (XP / payments): the app can never write these
  level           int  not null default 1,
  total_xp        int  not null default 0,
  plan            text not null default 'free' check (plan in ('free', 'premium')),
  created_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Column-level permissions: signed-in users can read profiles and edit only these columns.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, is_private, share_max_speed, province)
  on public.profiles to authenticated;

create policy "profiles: signed-in users can read"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles: users update their own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ============ Auto-create a profile on sign-up ============
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

  -- ============ vehicles ============
create table public.vehicles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 30),
  make       text check (char_length(make) <= 30),
  model      text check (char_length(model) <= 30),
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;
revoke all on public.vehicles from anon, authenticated;
grant select, delete on public.vehicles to authenticated;
grant insert (nickname, make, model), update (nickname, make, model) on public.vehicles to authenticated;

create policy "vehicles: signed-in users can read"
  on public.vehicles for select to authenticated using (true);
create policy "vehicles: insert own"
  on public.vehicles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "vehicles: update own"
  on public.vehicles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "vehicles: delete own"
  on public.vehicles for delete to authenticated
  using (user_id = (select auth.uid()));

create index vehicles_user_idx on public.vehicles (user_id);

-- ============ drives ============
-- Public-safe drive card. Stats are written ONLY by the server (finalize-drive, 2.4).
create table public.drives (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  vehicle_id      uuid references public.vehicles (id) on delete set null,
  started_at      timestamptz not null,
  ended_at        timestamptz not null,
  visibility      text not null default 'followers' check (visibility in ('private', 'followers', 'public')),
  -- server-only below
  status          text not null default 'uploading' check (status in ('uploading', 'processed', 'rejected')),
  distance_m      real,
  moving_s        int,
  elapsed_s       int,
  avg_moving_kmh  real,
  avg_overall_kmh real,
  smooth_score    real,
  xp_earned       int,
  new_cells       int,
  route           extensions.geography(LineString, 4326), -- privacy-zone TRIMMED line only
  created_at      timestamptz not null default now(),
  check (ended_at > started_at)
);

alter table public.drives enable row level security;
revoke all on public.drives from anon, authenticated;
grant select, delete on public.drives to authenticated;
grant insert (id, vehicle_id, started_at, ended_at, visibility) on public.drives to authenticated;
grant update (vehicle_id, visibility) on public.drives to authenticated;

create policy "drives: owner reads own"
  on public.drives for select to authenticated
  using (user_id = (select auth.uid()));
create policy "drives: insert own"
  on public.drives for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (vehicle_id is null or exists (
      select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid())))
  );
create policy "drives: update own"
  on public.drives for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (vehicle_id is null or exists (
      select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid())))
  );
create policy "drives: delete own"
  on public.drives for delete to authenticated
  using (user_id = (select auth.uid()));

create index drives_user_started_idx on public.drives (user_id, started_at desc);
create index drives_status_started_idx on public.drives (status, started_at);
create index drives_vehicle_idx on public.drives (vehicle_id);
create index drives_route_gix on public.drives using gist (route);

-- ============ drive_private ============
-- Owner-only data: raw track location in Storage, max speed, server flags.
create table public.drive_private (
  drive_id   uuid primary key references public.drives (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  track_path text,
  max_kmh    real,
  raw_points int,
  flags      jsonb not null default '{}'::jsonb
);

alter table public.drive_private enable row level security;
revoke all on public.drive_private from anon, authenticated;
grant select on public.drive_private to authenticated;

create policy "drive_private: owner reads own"
  on public.drive_private for select to authenticated
  using (user_id = (select auth.uid()));

create index drive_private_user_idx on public.drive_private (user_id);

-- ============ Private schema for helper functions ============
-- Functions in "public" become callable through the API. Helpers live in "private" so they can't be.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ============ follows ============
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (followee_id) on public.follows to authenticated;
grant update (status) on public.follows to authenticated;

create policy "follows: the two people involved can read"
  on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
create policy "follows: follow as yourself"
  on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "follows: followee accepts a request"
  on public.follows for update to authenticated
  using (followee_id = (select auth.uid()))
  with check (followee_id = (select auth.uid()) and status = 'accepted');
create policy "follows: either side can remove"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

create index follows_followee_idx on public.follows (followee_id, status);

-- Status is decided by the server: public account = accepted at once, private = pending.
create function private.follows_set_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select case when p.is_private then 'pending' else 'accepted' end
    into new.status
    from public.profiles p
    where p.id = new.followee_id;
  new.created_at := now();
  return new;
end;
$$;

create trigger follows_before_insert
  before insert on public.follows
  for each row execute function private.follows_set_status();

-- ============ Visibility helpers ============
create function private.is_accepted_follower(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = (select auth.uid())
      and f.followee_id = owner
      and f.status = 'accepted'
  );
$$;

-- owner: always | private: nobody else | followers: accepted followers
-- public: everyone signed in, BUT a private account's public drives go to its followers only
create function private.can_view(owner uuid, vis text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when owner = (select auth.uid()) then true
    when vis = 'private' then false
    when vis = 'followers' then private.is_accepted_follower(owner)
    when vis = 'public' then
      not coalesce((select p.is_private from public.profiles p where p.id = owner), true)
      or private.is_accepted_follower(owner)
    else false
  end;
$$;

-- Used by kudos/comments (block 4): can the signed-in user see this drive?
create function private.can_view_drive(drive uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.drives d
    where d.id = drive
      and (d.user_id = (select auth.uid())
           or (d.status = 'processed' and private.can_view(d.user_id, d.visibility)))
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_accepted_follower(uuid),
                          private.can_view(uuid, text),
                          private.can_view_drive(uuid) to authenticated;

-- ============ drives: let followers / public see finished drives ============
create policy "drives: others read processed drives they are allowed to see"
  on public.drives for select to authenticated
  using (status = 'processed' and private.can_view(user_id, visibility));

-- ============ kudos ============
create table public.kudos (
  drive_id   uuid not null references public.drives (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drive_id, user_id)
);

alter table public.kudos enable row level security;
revoke all on public.kudos from anon, authenticated;
grant select, delete on public.kudos to authenticated;
grant insert (drive_id) on public.kudos to authenticated;

create policy "kudos: read on drives you can see"
  on public.kudos for select to authenticated
  using (private.can_view_drive(drive_id));
create policy "kudos: give on drives you can see"
  on public.kudos for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_drive(drive_id));
create policy "kudos: take back your own"
  on public.kudos for delete to authenticated
  using (user_id = (select auth.uid()));

create index kudos_user_idx on public.kudos (user_id);

-- ============ comments ============
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  drive_id   uuid not null references public.drives (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
grant select, delete on public.comments to authenticated;
grant insert (drive_id, body) on public.comments to authenticated;

create policy "comments: read on drives you can see"
  on public.comments for select to authenticated
  using (private.can_view_drive(drive_id));
create policy "comments: write on drives you can see"
  on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_drive(drive_id));
create policy "comments: author or drive owner can delete"
  on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.drives d
               where d.id = drive_id and d.user_id = (select auth.uid()))
  );

create index comments_drive_idx on public.comments (drive_id, created_at);
create index comments_user_idx on public.comments (user_id);

-- ============ privacy_zones ============
-- Home / work. Owner-only, nobody else can ever read them.
create table public.privacy_zones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label      text check (char_length(label) <= 30),
  center     extensions.geography(Point, 4326) not null,
  radius_m   int not null default 300 check (radius_m between 100 and 1000),
  created_at timestamptz not null default now()
);

alter table public.privacy_zones enable row level security;
revoke all on public.privacy_zones from anon, authenticated;
grant select, delete on public.privacy_zones to authenticated;
grant insert (label, center, radius_m), update (label, center, radius_m)
  on public.privacy_zones to authenticated;

create policy "privacy_zones: owner reads"
  on public.privacy_zones for select to authenticated
  using (user_id = (select auth.uid()));
create policy "privacy_zones: owner inserts"
  on public.privacy_zones for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "privacy_zones: owner updates"
  on public.privacy_zones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "privacy_zones: owner deletes"
  on public.privacy_zones for delete to authenticated
  using (user_id = (select auth.uid()));

create index privacy_zones_user_idx on public.privacy_zones (user_id);

-- ============ explored_cells (server writes) ============
create table public.explored_cells (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  h3_index       text not null check (h3_index ~ '^[0-9a-f]{15}$'),
  first_drive_id uuid references public.drives (id) on delete set null,
  first_seen_at  timestamptz not null default now(),
  primary key (user_id, h3_index)
);

alter table public.explored_cells enable row level security;
revoke all on public.explored_cells from anon, authenticated;
grant select on public.explored_cells to authenticated;

create policy "explored_cells: owner reads"
  on public.explored_cells for select to authenticated
  using (user_id = (select auth.uid()));

create index explored_cells_drive_idx on public.explored_cells (first_drive_id);

-- ============ xp_events (server writes) ============
-- Audit trail: profiles.total_xp = sum(amount).
create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  drive_id   uuid references public.drives (id) on delete set null,
  source     text not null check (source in ('distance', 'new_cell', 'smooth', 'first_drive', 'badge')),
  amount     int not null,
  created_at timestamptz not null default now()
);

alter table public.xp_events enable row level security;
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;

create policy "xp_events: owner reads"
  on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()));

create index xp_events_user_idx on public.xp_events (user_id, created_at desc);
create index xp_events_drive_idx on public.xp_events (drive_id);

-- ============ badges (static catalogue) ============
create table public.badges (
  id          int generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  description text not null,
  tier        text,
  xp_reward   int not null default 0
);

alter table public.badges enable row level security;
revoke all on public.badges from anon, authenticated;
grant select on public.badges to authenticated;

create policy "badges: signed-in users can read"
  on public.badges for select to authenticated using (true);

-- ============ user_badges (server writes) ============
create table public.user_badges (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  badge_id    int  not null references public.badges (id) on delete cascade,
  drive_id    uuid references public.drives (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;

create policy "user_badges: signed-in users can read"
  on public.user_badges for select to authenticated using (true);

create index user_badges_badge_idx on public.user_badges (badge_id);
create index user_badges_drive_idx on public.user_badges (drive_id);
