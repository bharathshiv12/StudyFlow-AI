
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end; $$;

-- Study tasks
create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  title text not null,
  description text,
  scheduled_date date not null,
  scheduled_time time,
  duration_minutes int default 30,
  task_type text not null default 'study', -- study|homework
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.study_tasks enable row level security;
create policy "own tasks all" on public.study_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Assignments
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_path text,
  file_name text,
  due_date date not null,
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.assignments enable row level security;
create policy "own assignments all" on public.assignments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Focus sessions
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_minutes int not null,
  completed_minutes int not null default 0,
  finished boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.focus_sessions enable row level security;
create policy "own focus all" on public.focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quizzes
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  questions jsonb not null, -- [{question, options[], answerIndex, explanation}]
  score int,
  total int,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.quizzes enable row level security;
create policy "own quizzes all" on public.quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily quotes (cache one per user/day)
create table public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_date date not null,
  quote_text text not null,
  author text,
  created_at timestamptz not null default now(),
  unique (user_id, quote_date)
);
alter table public.daily_quotes enable row level security;
create policy "own quotes all" on public.daily_quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- User notification & integration settings
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  daily_quote_email boolean not null default false,
  daily_quote_sms boolean not null default false,
  reminder_lead_minutes int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "own settings all" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI chat messages (planner + homework tabs)
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tab text not null, -- 'planner' | 'homework'
  role text not null, -- 'user' | 'assistant'
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "own chat all" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for assignments (private)
insert into storage.buckets (id, name, public) values ('assignments', 'assignments', false)
on conflict (id) do nothing;

create policy "users read own assignment files" on storage.objects for select
  using (bucket_id = 'assignments' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users upload own assignment files" on storage.objects for insert
  with check (bucket_id = 'assignments' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own assignment files" on storage.objects for delete
  using (bucket_id = 'assignments' and auth.uid()::text = (storage.foldername(name))[1]);
