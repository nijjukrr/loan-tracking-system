-- Remove the permissive development policies created by the legacy combined
-- migration. Finance data is available only to approved, active app members.
revoke all on table public.app_members from anon;
revoke all on table public.main_transactions from anon;
revoke all on table public.ten_percent_entries from anon;
revoke all on table public.customers from anon;
revoke all on table public.loans from anon;
revoke all on table public.installments from anon;
revoke all on table public.payments from anon;
revoke execute on function public.tag_main_transaction_as_ten_percent(uuid) from public, anon;

grant select on table public.app_members to authenticated;
grant select, insert, update on table public.main_transactions to authenticated;
grant select, insert, update, delete on table public.ten_percent_entries to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.loans to authenticated;
grant select, insert, update, delete on table public.installments to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant execute on function public.tag_main_transaction_as_ten_percent(uuid) to authenticated;

drop policy if exists "Allow select app_members" on public.app_members;
drop policy if exists "Members can read their own membership" on public.app_members;
create policy "Members can read their own membership" on public.app_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Allow all main_transactions" on public.main_transactions;
drop policy if exists "Members can read MAIN transactions" on public.main_transactions;
drop policy if exists "Members can update MAIN transaction categories" on public.main_transactions;
create policy "Members can access main transactions" on public.main_transactions
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Allow all ten_percent_entries" on public.ten_percent_entries;
drop policy if exists "Members can read 10 percent entries" on public.ten_percent_entries;
drop policy if exists "Members can add 10 percent entries" on public.ten_percent_entries;
drop policy if exists "Members can update 10 percent entries" on public.ten_percent_entries;
create policy "Members can access ten percent entries" on public.ten_percent_entries
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Allow all customers" on public.customers;
drop policy if exists "Members can access customers" on public.customers;
create policy "Members can access customers" on public.customers
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Allow all loans" on public.loans;
drop policy if exists "Members can access loans" on public.loans;
create policy "Members can access loans" on public.loans
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Allow all installments" on public.installments;
drop policy if exists "Members can access installments" on public.installments;
create policy "Members can access installments" on public.installments
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));

drop policy if exists "Allow all payments" on public.payments;
drop policy if exists "Members can access payments" on public.payments;
create policy "Members can access payments" on public.payments
  for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.active));
