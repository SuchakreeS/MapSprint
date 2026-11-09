-- Badge catalogue (plan doc, 2026-11-03). xp_reward is decided in Phase 3 (3.6).
insert into public.badges (code, name, description, tier, xp_reward) values
  ('first_gear',         'First Gear',          'Record your first drive',                      null, 0),
  ('century',            'Century',             '100 km total',                                 null, 0),
  ('cartographer_1',     'Cartographer I',      '100 cells explored',                           '1',  0),
  ('cartographer_2',     'Cartographer II',     '1,000 cells explored',                         '2',  0),
  ('cartographer_3',     'Cartographer III',    '10,000 cells explored',                        '3',  0),
  ('district_hunter',    'District Hunter',     '50% of any district explored',                 null, 0),
  ('zen_driver',         'Zen Driver',          'Smooth score of 90+ on a 20 km+ drive',        null, 0),
  ('weekend_explorer',   'Weekend Explorer',    'Explore 20 new cells on a Saturday or Sunday', null, 0),
  ('province_collector', 'Province Collector',  'Drive in all 4 launch provinces',              null, 0),
  ('streak_7',           'Streak 7',            'Drive 7 days in a row',                        null, 0)
on conflict (code) do nothing;
