create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) > 0),
  main_sheet_no bigint unique not null check (main_sheet_no > 0),
  mode text not null check (mode in ('D', 'W')),
  loan_date date not null,
  principal numeric(14, 2) not null check (principal > 0),
  interest_amount numeric(14, 2) not null default 0 check (interest_amount >= 0),
  weekly_payment numeric(14, 2) not null default 0 check (weekly_payment >= 0),
  total_expected numeric(14, 2) not null check (total_expected >= principal),
  total_collected numeric(14, 2) not null default 0 check (total_collected >= 0),
  remaining_balance numeric(14, 2) not null check (remaining_balance >= 0),
  status text not null default 'active' check (status in ('active', 'closed')),
  closed_at timestamptz,
  source_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  expected_amount numeric(14, 2) not null check (expected_amount >= 0),
  paid_date date,
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  status text not null default 'Upcoming' check (status in ('Upcoming', 'Due Today', 'Paid', 'Partial', 'Overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_id, installment_number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  installment_id uuid references public.installments (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null check (length(trim(customer_name)) > 0),
  main_sheet_no bigint not null check (main_sheet_no > 0),
  mode text not null check (mode in ('D', 'W')),
  payment_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_type text not null check (payment_type in ('Interest', 'Weekly Installment', 'Principal', 'Partial', 'Other')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists loans_mode_status_idx on public.loans (mode, status);
create index if not exists loans_main_sheet_no_idx on public.loans (main_sheet_no);
create index if not exists installments_due_date_status_idx on public.installments (due_date, status);
create index if not exists payments_loan_id_idx on public.payments (loan_id);
create index if not exists payments_payment_date_idx on public.payments (payment_date desc);

alter table public.customers enable row level security;
alter table public.loans enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.loans from anon, authenticated;
revoke all on table public.installments from anon, authenticated;
revoke all on table public.payments from anon, authenticated;

grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.loans to authenticated;
grant select, insert, update, delete on table public.installments to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;

create policy "Members can access customers" on public.customers
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Members can access loans" on public.loans
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Members can access installments" on public.installments
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Members can access payments" on public.payments
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));
