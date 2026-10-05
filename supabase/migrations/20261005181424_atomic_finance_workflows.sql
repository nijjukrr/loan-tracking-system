-- Keep payment recording atomic so a payment can never be saved without its
-- installment and loan totals being updated in the same transaction.
alter table public.payments
  drop constraint if exists payments_payment_type_check;

alter table public.payments
  add constraint payments_payment_type_check check (
    payment_type in ('Interest', 'Weekly Installment', 'Principal', 'Interest + Principal', 'Partial', 'Other')
  );

create or replace function public.record_loan_payment(
  p_loan_id uuid,
  p_installment_id uuid,
  p_paid_date date,
  p_amount numeric,
  p_payment_type text,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
  v_installment public.installments%rowtype;
  v_payment public.payments%rowtype;
  v_next public.installments%rowtype;
  v_new_paid numeric;
  v_total_collected numeric;
  v_remaining numeric;
  v_close boolean;
  v_interval integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found'; end if;
  if v_loan.status = 'closed' then raise exception 'This account is already closed'; end if;

  if p_installment_id is not null and p_payment_type not in ('Principal', 'Interest + Principal') then
    select * into v_installment
    from public.installments
    where id = p_installment_id and loan_id = p_loan_id
    for update;
    if not found then raise exception 'Installment not found for this loan'; end if;
  end if;

  insert into public.payments (
    loan_id, installment_id, customer_id, customer_name, main_sheet_no,
    mode, payment_date, amount, payment_type, note
  ) values (
    v_loan.id,
    case when p_payment_type in ('Principal', 'Interest + Principal') then null else v_installment.id end,
    v_loan.customer_id, v_loan.customer_name, v_loan.main_sheet_no,
    v_loan.mode, p_paid_date, p_amount, p_payment_type, nullif(trim(p_note), '')
  ) returning * into v_payment;

  if v_installment.id is not null then
    v_new_paid := v_installment.paid_amount + p_amount;
    update public.installments set
      paid_date = p_paid_date,
      paid_amount = v_new_paid,
      status = case when v_new_paid >= expected_amount then 'Paid' else 'Partial' end,
      updated_at = now()
    where id = v_installment.id;

    v_interval := case when v_loan.mode = 'D' then 10 else 7 end;
    select * into v_next from public.installments
      where loan_id = p_loan_id
        and installment_number > v_installment.installment_number
        and paid_amount < expected_amount
      order by installment_number limit 1 for update;
    if found then
      update public.installments set
        due_date = p_paid_date + v_interval,
        status = case
          when p_paid_date + v_interval < current_date then 'Overdue'
          when p_paid_date + v_interval = current_date then 'Due Today'
          else 'Upcoming'
        end,
        updated_at = now()
      where id = v_next.id;
    end if;
  end if;

  v_total_collected := v_loan.total_collected + p_amount;
  v_remaining := greatest(0, v_loan.total_expected - v_total_collected);
  v_close := v_loan.mode = 'D' and p_payment_type in ('Principal', 'Interest + Principal');

  update public.loans set
    total_collected = v_total_collected,
    remaining_balance = v_remaining,
    status = case when v_close then 'closed' else status end,
    closed_at = case when v_close then p_paid_date::timestamptz else closed_at end,
    updated_at = now()
  where id = p_loan_id
  returning * into v_loan;

  return jsonb_build_object('loan', to_jsonb(v_loan), 'payment', to_jsonb(v_payment));
end;
$$;

revoke execute on function public.record_loan_payment(uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.record_loan_payment(uuid, uuid, date, numeric, text, text) to authenticated;

create or replace function public.create_loan_account(
  p_customer_id uuid,
  p_person_name text,
  p_phone text,
  p_address text,
  p_mode text,
  p_loan_date date,
  p_principal numeric,
  p_interest_amount numeric,
  p_weekly_payment numeric,
  p_total_return numeric,
  p_first_due_date date default null
)
returns public.loans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_loan public.loans%rowtype;
  v_sheet_no bigint;
  v_count integer;
  v_interval integer;
  v_amount numeric;
  v_total numeric;
  v_first_due date;
begin
  if trim(coalesce(p_person_name, '')) = '' then raise exception 'Person name is required'; end if;
  if p_mode not in ('D', 'W') then raise exception 'Mode must be D or W'; end if;
  if p_principal is null or p_principal <= 0 then raise exception 'Principal must be greater than zero'; end if;
  if p_mode = 'D' and (p_interest_amount is null or p_interest_amount <= 0) then
    raise exception 'Interest per 10-day cycle is required';
  end if;
  if p_mode = 'W' and (p_weekly_payment is null or p_weekly_payment <= 0 or p_total_return < p_principal) then
    raise exception 'Valid weekly payment and total return are required';
  end if;

  if p_customer_id is null then
    insert into public.customers(name, phone, address)
    values (trim(p_person_name), nullif(trim(p_phone), ''), nullif(trim(p_address), ''))
    returning * into v_customer;
  else
    select * into v_customer from public.customers where id = p_customer_id;
    if not found then raise exception 'Selected person was not found'; end if;
  end if;

  perform pg_advisory_xact_lock(721904);
  select coalesce(max(main_sheet_no), 0) + 1 into v_sheet_no from public.loans;
  v_count := case when p_mode = 'D' then 6 else 10 end;
  v_interval := case when p_mode = 'D' then 10 else 7 end;
  v_amount := case when p_mode = 'D' then p_interest_amount else p_weekly_payment end;
  v_total := case when p_mode = 'D' then p_principal + (p_interest_amount * 6) else p_total_return end;
  v_first_due := coalesce(p_first_due_date, p_loan_date + v_interval);

  insert into public.loans (
    customer_id, customer_name, main_sheet_no, mode, loan_date, principal,
    interest_amount, weekly_payment, total_expected, total_collected,
    remaining_balance, status
  ) values (
    v_customer.id, v_customer.name, v_sheet_no, p_mode, p_loan_date, p_principal,
    case when p_mode = 'D' then p_interest_amount else 0 end,
    case when p_mode = 'W' then p_weekly_payment else 0 end,
    v_total, 0, v_total, 'active'
  ) returning * into v_loan;

  insert into public.installments (loan_id, installment_number, due_date, expected_amount, paid_amount, status)
  select v_loan.id, n, v_first_due + ((n - 1) * v_interval), v_amount, 0,
    case when v_first_due + ((n - 1) * v_interval) < current_date then 'Overdue'
         when v_first_due + ((n - 1) * v_interval) = current_date then 'Due Today'
         else 'Upcoming' end
  from generate_series(1, v_count) as n;

  return v_loan;
end;
$$;

revoke execute on function public.create_loan_account(uuid, text, text, text, text, date, numeric, numeric, numeric, numeric, date) from public, anon;
grant execute on function public.create_loan_account(uuid, text, text, text, text, date, numeric, numeric, numeric, numeric, date) to authenticated;
