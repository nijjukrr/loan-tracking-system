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
drop policy if exists "Active members can access investment entries" on public.investment_entries;
create policy "Active members can access investment entries"
  on public.investment_entries for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Active members can access interest entries" on public.interest_entries;
create policy "Active members can access interest entries"
  on public.interest_entries for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Active members can access due receivables" on public.due_receivables;
create policy "Active members can access due receivables"
  on public.due_receivables for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Active members can access ledger transactions" on public.ledger_transactions;
create policy "Active members can access ledger transactions"
  on public.ledger_transactions for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Active members can read audit logs" on public.audit_logs;
create policy "Active members can read audit logs"
  on public.audit_logs for select to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Active members can insert audit logs" on public.audit_logs;
create policy "Active members can insert audit logs"
  on public.audit_logs for insert to authenticated
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Active members can access import batches" on public.import_batches;
create policy "Active members can access import batches"
  on public.import_batches for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

-- 5. Monthly & Sweet Fund Permissions
alter table public.monthly_fund_members enable row level security;
alter table public.monthly_fund_collections enable row level security;
alter table public.sweet_fund_programmes enable row level security;
alter table public.sweet_fund_members enable row level security;
alter table public.sweet_fund_installments enable row level security;
alter table public.sweet_fund_payments enable row level security;

revoke all on table public.monthly_fund_members from anon;
revoke all on table public.monthly_fund_collections from anon;
revoke all on table public.sweet_fund_programmes from anon;
revoke all on table public.sweet_fund_members from anon;
revoke all on table public.sweet_fund_installments from anon;
revoke all on table public.sweet_fund_payments from anon;

grant select, insert, update, delete on table public.monthly_fund_members to authenticated;
grant select, insert, update, delete on table public.monthly_fund_collections to authenticated;
grant select, insert, update, delete on table public.sweet_fund_programmes to authenticated;
grant select, insert, update, delete on table public.sweet_fund_members to authenticated;
grant select, insert, update, delete on table public.sweet_fund_installments to authenticated;
grant select, insert, update, delete on table public.sweet_fund_payments to authenticated;

create policy "Active members can access monthly fund members"
  on public.monthly_fund_members for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access monthly fund collections"
  on public.monthly_fund_collections for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access sweet fund programmes"
  on public.sweet_fund_programmes for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access sweet fund members"
  on public.sweet_fund_members for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access sweet fund installments"
  on public.sweet_fund_installments for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

create policy "Active members can access sweet fund payments"
  on public.sweet_fund_payments for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

