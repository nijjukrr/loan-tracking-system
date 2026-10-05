-- Enable pgcrypto for UUID generation
create extension if not exists pgcrypto;

-- 1. App Members table (for RLS authentication)
create table if not exists public.app_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. MAIN Transactions table (raw imported Excel rows)
create table if not exists public.main_transactions (
  id uuid primary key default gen_random_uuid(),
  main_sheet_no bigint not null check (main_sheet_no > 0),
  transaction_date date,
  particulars text not null check (length(trim(particulars)) > 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  category text check (category is null or category = '10PCT'),
  category_tagged_at timestamptz,
  category_tagged_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (main_sheet_no)
);

-- 3. 10% Profit Entries table
create table if not exists public.ten_percent_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  particulars text not null check (length(trim(particulars)) > 0),
  amount numeric(14, 2) not null check (amount > 0),
  main_sheet_no bigint check (main_sheet_no is null or main_sheet_no > 0),
  notes text,
  source_kind text not null default 'manual' check (source_kind in ('manual', 'main_tag')),
  main_transaction_id uuid unique references public.main_transactions (id) on delete restrict,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_kind = 'manual' and main_transaction_id is null)
    or (source_kind = 'main_tag' and main_transaction_id is not null)
  )
);

-- 4. Customers table
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  address text,
  created_at timestamptz not null default now(),
  unique(name)
);

-- 5. Loans table
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

-- 6. Installments table
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

-- 7. Payments table
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

-- Indexes
create index if not exists main_transactions_untagged_idx on public.main_transactions (main_sheet_no) where category is null;
create index if not exists ten_percent_entries_entry_date_idx on public.ten_percent_entries (entry_date desc);
create index if not exists loans_mode_status_idx on public.loans (mode, status);
create index if not exists loans_main_sheet_no_idx on public.loans (main_sheet_no);
create index if not exists installments_due_date_status_idx on public.installments (due_date, status);
create index if not exists payments_loan_id_idx on public.payments (loan_id);
create index if not exists payments_payment_date_idx on public.payments (payment_date desc);

-- Function: Tag MAIN transaction as 10%
create or replace function public.tag_main_transaction_as_ten_percent(p_transaction_id uuid)
returns public.ten_percent_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  main_row public.main_transactions;
  entry_row public.ten_percent_entries;
begin
  select * into main_row from public.main_transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'MAIN transaction not found';
  end if;

  update public.main_transactions
  set category = '10PCT', category_tagged_at = now(), category_tagged_by = caller_id
  where id = p_transaction_id;

  insert into public.ten_percent_entries (
    entry_date, particulars, amount, main_sheet_no, source_kind, main_transaction_id, created_by
  )
  values (
    coalesce(main_row.transaction_date, current_date),
    main_row.particulars, main_row.credit, main_row.main_sheet_no, 'main_tag', main_row.id, caller_id
  )
  on conflict (main_transaction_id) do update
  set entry_date = excluded.entry_date, particulars = excluded.particulars, amount = excluded.amount, updated_at = now()
  returning * into entry_row;

  return entry_row;
end;
$$;

-- Enable RLS on all tables
alter table public.app_members enable row level security;
alter table public.main_transactions enable row level security;
alter table public.ten_percent_entries enable row level security;
alter table public.customers enable row level security;
alter table public.loans enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;

-- Grants for authenticated users
grant select on table public.app_members to authenticated, anon;
grant select, insert, update on table public.main_transactions to authenticated, anon;
grant select, insert, update on table public.ten_percent_entries to authenticated, anon;
grant select, insert, update, delete on table public.customers to authenticated, anon;
grant select, insert, update, delete on table public.loans to authenticated, anon;
grant select, insert, update, delete on table public.installments to authenticated, anon;
grant select, insert, update, delete on table public.payments to authenticated, anon;
grant execute on function public.tag_main_transaction_as_ten_percent(uuid) to authenticated, anon;

-- Permissive RLS Policies
drop policy if exists "Allow select app_members" on public.app_members;
create policy "Allow select app_members" on public.app_members for select using (true);

drop policy if exists "Allow all main_transactions" on public.main_transactions;
create policy "Allow all main_transactions" on public.main_transactions for all using (true) with check (true);

drop policy if exists "Allow all ten_percent_entries" on public.ten_percent_entries;
create policy "Allow all ten_percent_entries" on public.ten_percent_entries for all using (true) with check (true);

drop policy if exists "Allow all customers" on public.customers;
create policy "Allow all customers" on public.customers for all using (true) with check (true);

drop policy if exists "Allow all loans" on public.loans;
create policy "Allow all loans" on public.loans for all using (true) with check (true);

drop policy if exists "Allow all installments" on public.installments;
create policy "Allow all installments" on public.installments for all using (true) with check (true);

drop policy if exists "Allow all payments" on public.payments;
create policy "Allow all payments" on public.payments for all using (true) with check (true);
