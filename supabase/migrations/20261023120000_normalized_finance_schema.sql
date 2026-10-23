-- Milestone 5: Normalized Finance Database Schema
-- Adds first-class support for Investment Entries, Interest Entries, Due Receivables,
-- Unified Ledger Transactions, Audit Logs, and Import Batches.
-- Drops restrictive unique constraint on loans.main_sheet_no to allow multiple loans per customer/account number.

-- 1. Relax loans constraint to allow multiple loans with the same account number or customer
alter table public.loans
  drop constraint if exists loans_main_sheet_no_key;

-- 2. Investment Entries table (reconciles to ₹185,000)
create table if not exists public.investment_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  investor_name text not null check (length(trim(investor_name)) > 0),
  amount numeric(14, 2) not null check (amount > 0),
  source_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists investment_entries_date_idx on public.investment_entries (entry_date desc);

-- 3. Interest Entries table (reconciles to ₹4,950)
create table if not exists public.interest_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  customer_name text not null check (length(trim(customer_name)) > 0),
  ac_no bigint,
  amount numeric(14, 2) not null check (amount > 0),
  source_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists interest_entries_date_idx on public.interest_entries (entry_date desc);

-- 4. Due Receivables table (reconciles to ₹12,000)
create table if not exists public.due_receivables (
  id uuid primary key default gen_random_uuid(),
  due_date date not null,
  borrower_name text not null check (length(trim(borrower_name)) > 0),
  loan_id uuid references public.loans (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  settled_amount numeric(14, 2) not null default 0 check (settled_amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'settled')),
  source_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists due_receivables_date_status_idx on public.due_receivables (due_date, status);

-- 5. Unified Financial Ledger Transactions
create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  direction text not null check (direction in ('INFLOW', 'OUTFLOW')),
  category text not null check (
    category in (
      'INVESTMENT',
      'LOAN_DISBURSEMENT',
      'INTEREST_RECEIVED',
      'WEEKLY_COLLECTION',
      'PRINCIPAL_REPAYMENT',
      'TEN_PERCENT_PROFIT',
      'DUE_RECEIVABLE',
      'ADJUSTMENT'
    )
  ),
  amount numeric(14, 2) not null check (amount > 0),
  particulars text not null check (length(trim(particulars)) > 0),
  reference_id uuid,
  source_sheet text,
  source_row integer,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists ledger_transactions_date_cat_idx on public.ledger_transactions (transaction_date desc, category);

-- 6. Audit Logs for Financial Operations
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (length(trim(action)) > 0),
  entity_type text not null check (length(trim(entity_type)) > 0),
  entity_id text not null,
  details jsonb,
  performed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- 7. Import Batches for repeatable, duplicate-safe workbook imports
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_sha256 text not null,
  records_count integer not null default 0,
  total_investment numeric(14, 2) not null default 0,
  total_interest numeric(14, 2) not null default 0,
  total_ten_percent numeric(14, 2) not null default 0,
  total_dues numeric(14, 2) not null default 0,
  total_loans_principal numeric(14, 2) not null default 0,
  status text not null default 'committed' check (status in ('preview', 'committed', 'rolled_back')),
  created_at timestamptz not null default now()
);
