-- Rate limiter v2: sliding-window counter instead of a fixed window.
-- A fixed window lets a client send up to 2x the limit by straddling a window boundary. The sliding window weights the previous
-- window by how much of it still "overlaps" now, which removes that burst while staying O(1) (two rows per user+bucket).
-- Same signature, same fail-closed behaviour: returns true when the call is allowed.
begin;

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

create or replace function public.check_rate_limit(p_user uuid, p_bucket text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  now_s double precision := extract(epoch from now());
  w timestamptz := to_timestamp(floor(now_s / p_window_seconds) * p_window_seconds);
  elapsed double precision := now_s - extract(epoch from w);
  cur int; prev int;
begin
  insert into rate_limits (user_id, bucket, window_start, hits) values (p_user, p_bucket, w, 1)
    on conflict (user_id, bucket, window_start) do update set hits = rate_limits.hits + 1 returning hits into cur;
  select hits into prev from rate_limits where user_id = p_user and bucket = p_bucket and window_start = w - make_interval(secs => p_window_seconds);
  -- Housekeeping on ~1% of calls (a table-wide DELETE on every call would not scale).
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '2 days'; end if;
  return cur + coalesce(prev, 0) * (1 - elapsed / p_window_seconds) <= p_max;
end $$;

revoke all on function public.check_rate_limit(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, int, int) to service_role;

commit;
