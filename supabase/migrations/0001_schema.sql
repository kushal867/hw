-- EduSathi core schema. All timestamps are UTC (timestamptz); UI renders Nepal time.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ───────── Profiles ─────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_path text,
  preferred_language text not null default 'en' check (preferred_language in ('en','ne')),
  bio text check (char_length(bio) <= 280),
  -- protected fields: only trusted server code may change these
  platform_role text not null default 'user' check (platform_role in ('user','admin')),
  restricted_until timestamptz,
  restriction_reason text,
  created_at timestamptz not null default now()
);

-- ───────── Hierarchy: college → course → semester → subject ─────────
create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  city text,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  country text not null default 'NP',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (name, city)
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  degree_level text,
  status text not null default 'active' check (status in ('active','archived')),
  unique (college_id, slug), unique (college_id, name)
);
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  semester_number int not null check (semester_number between 1 and 12),
  academic_year text,                       -- e.g. "2082" (BS) or "2025/26"; free text for differing calendars
  requires_approval boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (course_id, semester_number, academic_year)
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  code text,
  status text not null default 'active' check (status in ('active','archived')),
  unique (semester_id, name),
  unique (id, semester_id)                  -- target for composite FKs (subject must belong to semester)
);

alter table public.profiles
  add column college_id uuid references public.colleges(id) on delete set null,
  add column course_id uuid references public.courses(id) on delete set null,
  add column semester_id uuid references public.semesters(id) on delete set null;

-- ───────── Membership ─────────
create table public.semester_members (
  semester_id uuid not null references public.semesters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  membership_status text not null default 'active' check (membership_status in ('active','pending','removed')),
  joined_at timestamptz not null default now(),
  primary key (semester_id, user_id)
);
create index on public.semester_members (user_id);

create table public.semester_invites (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  token_hash text not null unique,          -- SHA-256 of the token; raw token is never stored
  created_by uuid not null references public.profiles(id) on delete cascade,
  requires_approval boolean not null default false,
  expires_at timestamptz not null,
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (max_uses is null or used_count <= max_uses)
);
create index on public.semester_invites (semester_id);

create table public.semester_requests (    -- "request group creation"
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (requester_id, semester_id)
);

-- ───────── Documents ─────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 3 and 140),
  description text check (char_length(description) <= 1000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  category text not null check (category in ('lecture_notes','homework','assignments','lab_reports','previous_papers','important_questions','revision_notes','other')),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  mime_type text not null check (mime_type = 'application/pdf'),
  sha256 text not null,                      -- duplicate detection within a semester
  visibility text not null default 'private' check (visibility in ('private','public')),
  moderation_status text not null default 'private' check (moderation_status in ('private','pending','approved','rejected','removed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, semester_id) references public.subjects(id, semester_id),
  unique (semester_id, sha256),
  -- public means approved; nothing else may be public
  check (visibility = 'private' or moderation_status = 'approved')
);
create index on public.documents (semester_id, created_at desc);
create index on public.documents (visibility, moderation_status, published_at desc);
create index documents_title_trgm on public.documents using gin (title gin_trgm_ops);

-- ───────── Discussions ─────────
create table public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  subject_id uuid,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 1 and 5000),
  post_type text not null default 'general' check (post_type in ('general','homework_help','notes_request','exam_prep','announcement')),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, semester_id) references public.subjects(id, semester_id)
);
create index on public.discussion_posts (semester_id, created_at desc);
create table public.discussion_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discussion_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at timestamptz not null default now()
);
create index on public.discussion_comments (post_id, created_at);

-- ───────── Exam questions ─────────
create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  subject_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  question_text text not null check (char_length(question_text) between 5 and 2000),
  answer_text text check (char_length(answer_text) <= 4000),
  topic text,
  question_type text not null default 'practice' check (question_type in ('practice','previous_exam','teacher_confirmed')),
  source_note text check (char_length(source_note) <= 300),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at timestamptz not null default now(),
  foreign key (subject_id, semester_id) references public.subjects(id, semester_id)
);
create index on public.exam_questions (subject_id, created_at desc);
create table public.saved_questions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ───────── Moderation, notifications, badges, audit ─────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('document','post','comment','question','user','copyright')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','inappropriate','copyright','harassment','wrong_info','other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reports (status, created_at desc);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  destination text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
create table public.profile_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_type text not null check (badge_type in ('helpful_contributor','notes_sharer','discussion_helper','semester_moderator','verified_educator')),
  awarded_by uuid references public.profiles(id),   -- null = awarded by automated rules
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_type)
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','done','rejected')),
  created_at timestamptz not null default now()
);
create table public.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);
