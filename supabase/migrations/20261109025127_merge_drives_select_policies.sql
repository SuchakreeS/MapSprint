-- Performance advisor: two permissive SELECT policies on public.drives meant both ran on every read.
-- Same rule, one policy: you always see your own drives (any status); others only see
-- processed drives that visibility + follows allow.
drop policy "drives: owner reads own" on public.drives;
drop policy "drives: others read processed drives they are allowed to see" on public.drives;

create policy "drives: read own, or processed ones you are allowed to see"
  on public.drives for select to authenticated
  using (
    user_id = (select auth.uid())
    or (status = 'processed' and private.can_view(user_id, visibility))
  );
