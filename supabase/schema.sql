create table if not exists customers (
  id text primary key,
  name text not null,
  phone text not null,
  note text not null
);

create table if not exists products (
  id text primary key,
  name text not null,
  model text not null,
  specification text not null,
  category text not null,
  is_high_risk boolean not null default false
);

create table if not exists orders (
  id text primary key,
  order_id text not null,
  customer_id text not null references customers(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  order_status text not null,
  product_info jsonb not null
);

create table if not exists complaints (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  order_ref_id text not null references orders(id) on delete cascade,
  order_id text not null,
  ticket_no text not null,
  created_at text not null,
  priority text not null,
  complaint_type text not null,
  complaint_text text not null,
  status text not null,
  path_tag text not null,
  problem_type text not null,
  ai_question_summary text not null,
  sop_judgement text not null,
  next_actions text[] not null default '{}',
  recording_summary text not null,
  order_status text not null,
  product_info jsonb not null,
  ai_suggested_status text,
  reanalyze_available boolean not null default true,
  reanalyze_pending boolean not null default false,
  analysis_snapshot_id text,
  primary_action text,
  analysis_used_fallback boolean not null default false,
  analysis_fallback_reason text,
  manual_guidance text,
  customer_intent_summary text,
  analyzed_attachment_count integer
);

create table if not exists messages (
  id text primary key,
  complaint_id text not null references complaints(id) on delete cascade,
  role text not null,
  text text not null,
  time_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists processing_records (
  id text primary key,
  complaint_id text not null references complaints(id) on delete cascade,
  actor text not null,
  action text not null,
  note text not null,
  time_label text not null,
  resulting_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id text primary key,
  complaint_id text not null references complaints(id) on delete cascade,
  name text not null,
  kind text not null,
  mime_type text not null,
  size integer not null,
  preview_url text not null,
  uploaded_at_label text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists event_logs (
  id text primary key,
  type text not null,
  complaint_id text not null references complaints(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text not null
);

create table if not exists analysis_snapshots (
  id text primary key,
  complaint_id text not null references complaints(id) on delete cascade,
  created_at timestamptz not null default now(),
  result jsonb not null
);
