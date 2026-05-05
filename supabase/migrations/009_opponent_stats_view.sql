-- ─── Migration 009: Per-user opponent stats view ─────────────────────────────
-- Shows the current user's record against each opponent commander they have faced.
-- security invoker + RLS means each user sees only their own data.

create or replace view public.my_opponent_stats
with (security_invoker = true)
as
select
  opp.value ->> 'commanderName'                          as opponent_commander,
  opp.value ->> 'commanderImageUri'                      as opponent_image_uri,
  opp.value -> 'commanderColorIdentity'                  as opponent_color_identity,
  count(*)                                               as games_faced,
  sum(case when g.winner_player_id = me.value ->> 'id'
       then 1 else 0 end)                                as my_wins,
  sum(case when g.winner_player_id = opp.value ->> 'id'
       then 1 else 0 end)                                as opp_wins,
  round(
    sum(case when g.winner_player_id = me.value ->> 'id' then 1 else 0 end)::numeric
    / nullif(count(*), 0),
    4
  )                                                      as my_win_rate
from public.games g,
     jsonb_array_elements(g.players) me(value),
     jsonb_array_elements(g.players) opp(value)
where g.user_id = auth.uid()
  and (me.value  ->> 'is_me')::boolean = true
  and (opp.value ->> 'is_me')::boolean = false
group by 1, 2, 3
order by games_faced desc;

grant select on public.my_opponent_stats to authenticated;
