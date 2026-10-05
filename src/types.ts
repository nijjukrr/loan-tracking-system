export type ModeKind = 'D' | 'W'
export type LoanStatus = 'active' | 'closed'
export type InstallmentStatus = 'Upcoming' | 'Due Today' | 'Paid' | 'Partial' | 'Overdue'
export type PaymentType = 'Interest' | 'Weekly Installment' | 'Principal' | 'Partial' | 'Other'

export type Customer = {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  created_at?: string
}

export type Loan = {
  id: string
  customer_id?: string | null
  customer_name: string
  main_sheet_no: number
  mode: ModeKind
  loan_date: string
  principal: number
  interest_amount: number
  weekly_payment: number
  total_expected: number
  total_collected: number
  remaining_balance: number
  status: LoanStatus
  closed_at?: string | null
  source_remarks?: string | null
  created_at: string
  updated_at: string
}

export type Installment = {
  id: string
  loan_id: string
  installment_number: number
  due_date: string
  expected_amount: number
  paid_date?: string | null
  paid_amount: number
  status: InstallmentStatus
  created_at: string
  updated_at: string
}

export type Payment = {
  id: string
  loan_id: string
  installment_id?: string | null
  customer_id?: string | null
  customer_name: string
  main_sheet_no: number
  mode: ModeKind
  payment_date: string
  amount: number
  payment_type: PaymentType
  note?: string | null
  created_at: string
}

export type TenPercentEntry = {
  id: string
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no: number | null
  notes: string | null
  source_kind: 'manual' | 'main_tag'
  main_transaction_id: string | null
  created_at: string
}

export type NewTenPercentEntry = {
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no: number | null
  notes: string | null
}

export type MainTransaction = {
  id: string
  main_sheet_no: number
  transaction_date: string | null
  particulars: string
  credit: number
  category: '10PCT' | null
}

export type DashboardMetrics = {
  totalMoneyLent: number
  dailyMoneyLent: number
  weeklyMoneyLent: number
  totalCollected: number
  totalProfit: number
  dailyProfit: number
  weeklyProfit: number
  tenPercentProfit: number
  activeAccounts: number
  closedAccounts: number
  dueTodayCount: number
  overdueCount: number
}

export type NewLoanInput = {
  customer_name: string
  phone?: string
  address?: string
  mode: ModeKind
  loan_date: string
  principal: number
  interest_amount?: number
  weekly_payment?: number
  first_due_date?: string
  main_sheet_no?: number
}

export type NewPaymentInput = {
  loan_id: string
  installment_id?: string
  paid_date: string
  amount: number
  payment_type: PaymentType
  note?: string
}
