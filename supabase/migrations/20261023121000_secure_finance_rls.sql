-- Milestone 6: Row Level Security for All Financial Tables
-- Ensures active authenticated members can access ledger data, while unauthorized or anonymous users cannot.

-- 1. Enable RLS on all newly added tables
alter table public.investment_entries enable row level security;
alter table public.interest_entries enable row level security;
alter table public.due_receivables enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.import_batches enable row level security;

-- 2. Revoke all privileges from anon
revoke all on table public.investment_entries from anon;
revoke all on table public.interest_entries from anon;
revoke all on table public.due_receivables from anon;
revoke all on table public.ledger_transactions from anon;
revoke all on table public.audit_logs from anon;
revoke all on table public.import_batches from anon;

-- 3. Grant table permissions to authenticated role
grant select, insert, update, delete on table public.investment_entries to authenticated;
grant select, insert, update, delete on table public.interest_entries to authenticated;
grant select, insert, update, delete on table public.due_receivables to authenticated;
grant select, insert, update on table public.ledger_transactions to authenticated;
grant select, insert on table public.audit_logs to authenticated;
grant select, insert, update on table public.import_batches to authenticated;

-- 4. RLS Policies requiring active app membership
create policy "Active members can access investment entries"
  on public.investment_entries for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access interest entries"
  on public.interest_entries for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access due receivables"
  on public.due_receivables for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access ledger transactions"
  on public.ledger_transactions for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can read audit logs"
  on public.audit_logs for select to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can insert audit logs"
  on public.audit_logs for insert to authenticated
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access import batches"
  on public.import_batches for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));
