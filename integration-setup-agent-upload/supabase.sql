-- Run once in the Supabase SQL editor.
create table if not exists guides (
  slug text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Only the server (service role key) reads and writes this table.
alter table guides enable row level security;
