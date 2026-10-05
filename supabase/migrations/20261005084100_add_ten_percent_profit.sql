create extension if not exists pgcrypto;

create table public.app_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.main_transactions (
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

create table public.ten_percent_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  particulars text not null check (length(trim(particulars)) > 0),
  amount numeric(14, 2) not null check (amount > 0),
  main_sheet_no bigint check (main_sheet_no is null or main_sheet_no > 0),
  notes text,
  source_kind text not null default 'manual' check (source_kind in ('manual', 'main_tag')),
  main_transaction_id uuid unique references public.main_transactions (id) on delete restrict,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_kind = 'manual' and main_transaction_id is null)
    or (source_kind = 'main_tag' and main_transaction_id is not null)
  )
);

create index main_transactions_untagged_idx
  on public.main_transactions (main_sheet_no)
  where category is null;

create index main_transactions_category_tagged_by_idx
  on public.main_transactions (category_tagged_by);

create index ten_percent_entries_entry_date_idx
  on public.ten_percent_entries (entry_date desc);

create index ten_percent_entries_created_by_idx
  on public.ten_percent_entries (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ten_percent_entries_set_updated_at
before update on public.ten_percent_entries
for each row execute function public.set_updated_at();

alter table public.app_members enable row level security;
alter table public.main_transactions enable row level security;
alter table public.ten_percent_entries enable row level security;

revoke all on table public.app_members from anon, authenticated;
revoke all on table public.main_transactions from anon, authenticated;
revoke all on table public.ten_percent_entries from anon, authenticated;

grant select on table public.app_members to authenticated;
grant select on table public.main_transactions to authenticated;
grant select, insert on table public.ten_percent_entries to authenticated;
grant update (entry_date, particulars, amount, main_sheet_no, notes)
  on table public.ten_percent_entries to authenticated;

create policy "Members can read their own membership"
on public.app_members for select
to authenticated
using ((select auth.uid()) = user_id and active);

create policy "Members can read MAIN transactions"
on public.main_transactions for select
to authenticated
using (
  exists (
    select 1
    from public.app_members member
    where member.user_id = (select auth.uid())
      and member.active
  )
);

create policy "Members can read 10 percent entries"
on public.ten_percent_entries for select
to authenticated
using (
  exists (
    select 1
    from public.app_members member
    where member.user_id = (select auth.uid())
      and member.active
  )
);

create policy "Members can add 10 percent entries"
on public.ten_percent_entries for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and source_kind = 'manual'
  and main_transaction_id is null
  and exists (
    select 1
    from public.app_members member
    where member.user_id = (select auth.uid())
      and member.active
  )
);

create policy "Members can update 10 percent entries"
on public.ten_percent_entries for update
to authenticated
using (
  exists (
    select 1
    from public.app_members member
    where member.user_id = (select auth.uid())
      and member.active
  )
)
with check (
  exists (
    select 1
    from public.app_members member
    where member.user_id = (select auth.uid())
      and member.active
  )
);

create or replace function public.tag_main_transaction_as_ten_percent(
  p_transaction_id uuid
)
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
  if caller_id is null or not exists (
    select 1
    from public.app_members member
    where member.user_id = caller_id
      and member.active
  ) then
    raise exception 'Approved finance membership is required';
  end if;

  select *
  into main_row
  from public.main_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'MAIN transaction not found or not accessible';
  end if;

  if main_row.category is not null and main_row.category <> '10PCT' then
    raise exception 'MAIN transaction already has another explicit category';
  end if;

  if main_row.credit <= 0 then
    raise exception 'Only a MAIN transaction with a positive Credit amount can be tagged as 10%%';
  end if;

  update public.main_transactions
  set category = '10PCT',
      category_tagged_at = now(),
      category_tagged_by = caller_id
  where id = p_transaction_id;

  insert into public.ten_percent_entries (
    entry_date,
    particulars,
    amount,
    main_sheet_no,
    source_kind,
    main_transaction_id,
    created_by
  )
  values (
    coalesce(main_row.transaction_date, current_date),
    main_row.particulars,
    main_row.credit,
    main_row.main_sheet_no,
    'main_tag',
    main_row.id,
    caller_id
  )
  on conflict (main_transaction_id) do update
  set entry_date = excluded.entry_date,
      particulars = excluded.particulars,
      amount = excluded.amount,
      main_sheet_no = excluded.main_sheet_no,
      updated_at = now()
  returning * into entry_row;

  return entry_row;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.tag_main_transaction_as_ten_percent(uuid) from public, anon;
grant execute on function public.tag_main_transaction_as_ten_percent(uuid) to authenticated;
