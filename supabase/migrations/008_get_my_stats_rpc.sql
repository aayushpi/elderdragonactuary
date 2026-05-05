-- ─── Migration 008: Per-user stats RPC ───────────────────────────────────────
-- Returns a JSONB object of the current user's aggregate stats.
-- Runs as security invoker so RLS applies automatically — users only see
-- their own games, no security definer elevation needed.

create or replace function public.get_my_stats()
returns jsonb
language sql
security invoker
stable
as $$
  with my_games as (
    select
      g.id,
      g.win_turn,
      g.winner_player_id,
      g.bracket,
      g.played_at,
      g.players,
      me.value as me_player
    from public.games g,
         jsonb_array_elements(g.players) me(value)
    where g.user_id = auth.uid()
      and (me.value ->> 'is_me')::boolean = true
  ),
  wins as (
    select * from my_games
    where winner_player_id = me_player ->> 'id'
  )
  select jsonb_build_object(
    'gamesPlayed',     (select count(*) from my_games),
    'totalWins',       (select count(*) from wins),
    'avgWinTurn',      (select round(avg(win_turn), 2) from wins),
    'topCommanders',   (
      select coalesce(jsonb_agg(row_to_json(c) order by c.wins desc, c.games desc), '[]')
      from (
        select
          me_player ->> 'commanderName'  as name,
          me_player ->> 'commanderManaCost' as mana_cost,
          me_player ->> 'commanderImageUri' as image_uri,
          count(*)                       as games,
          sum(case when winner_player_id = me_player ->> 'id' then 1 else 0 end) as wins
        from my_games
        group by 1, 2, 3
        limit 10
      ) c
    ),
    'winConditionCounts', (
      select coalesce(jsonb_object_agg(wc, cnt), '{}')
      from (
        select wc, count(*) as cnt
        from wins, jsonb_array_elements_text(
          case when wins.players is not null then
            (select coalesce(g2.win_conditions::jsonb, '[]'::jsonb)
             from public.games g2 where g2.id = wins.id)
          else '[]'::jsonb end
        ) as wc
        group by wc
      ) x
    )
  );
$$;

-- Grant execute to authenticated users only.
grant execute on function public.get_my_stats() to authenticated;
