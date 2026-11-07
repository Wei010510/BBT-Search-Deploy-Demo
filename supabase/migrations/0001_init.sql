-- 在 Supabase SQL Editor 中整段执行。

create table episodes (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  episode int not null,
  title text,
  video_object_key text not null,
  duration_ms int,
  created_at timestamptz default now(),
  unique (season, episode)
);

create table subtitle_lines (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id),
  start_ms int not null,
  end_ms int not null,
  en_text text,
  zh_text text,
  search_text text generated always as (
    coalesce(en_text, '') || ' ' || coalesce(zh_text, '')
  ) stored,
  created_at timestamptz default now(),
  check (end_ms > start_ms)
);

create extension if not exists pg_trgm;

create index subtitle_lines_search_trgm_idx
on subtitle_lines
using gin (search_text gin_trgm_ops);

create table selected_assets (
  id uuid primary key default gen_random_uuid(),
  line_ids uuid[] not null,
  share_title text,
  created_at timestamptz default now()
);
