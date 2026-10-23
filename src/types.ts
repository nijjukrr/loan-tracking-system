export type ModeKind = 'D' | 'W'
export type LoanStatus = 'active' | 'closed'
export type InstallmentStatus = 'Upcoming' | 'Due Today' | 'Paid' | 'Partial' | 'Overdue'
export type PaymentType = 'Interest' | 'Weekly Installment' | 'Principal' | 'Interest + Principal' | 'Partial' | 'Other'

export type LedgerDirection = 'INFLOW' | 'OUTFLOW'
export type LedgerCategory =
  | 'INVESTMENT'
  | 'LOAN_DISBURSEMENT'
  | 'INTEREST_RECEIVED'
  | 'WEEKLY_COLLECTION'
  | 'PRINCIPAL_REPAYMENT'
  | 'TEN_PERCENT_PROFIT'
  | 'DUE_RECEIVABLE'
  | 'ADJUSTMENT'

export type Customer = {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  active?: boolean
  created_at?: string
}

export type Loan = {
  id: string
  customer_id?: string | null
  customer_name: string
  ac_no?: number | null
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
  /** True when the source ledger marks this individual debit row green/paid. */
  source_paid?: boolean
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
  principal_allocation?: number
  interest_allocation?: number
  note?: string | null
  reversal_of?: string | null
  created_at: string
}

export type InvestmentEntry = {
  id: string
  entry_date: string
  investor_name: string
  amount: number
  source_reference?: string | null
  notes?: string | null
  created_at: string
}

export type InterestEntry = {
  id: string
  entry_date: string
  customer_name: string
  ac_no?: number | null
  amount: number
  source_reference?: string | null
  notes?: string | null
  created_at: string
}

export type TenPercentEntry = {
  id: string
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no: number | null
  notes: string | null
  source_kind: 'manual' | 'main_tag' | 'imported'
  main_transaction_id: string | null
  created_at: string
}

export type DueReceivableEntry = {
  id: string
  due_date: string
  borrower_name: string
  loan_id?: string | null
  amount: number
  settled_amount: number
  remaining_amount: number
  status: 'unpaid' | 'partial' | 'settled'
  source_reference?: string | null
  notes?: string | null
  created_at: string
}

export type FinancialLedgerTransaction = {
  id: string
  transaction_date: string
  direction: LedgerDirection
  category: LedgerCategory
  amount: number
  particulars: string
  reference_id?: string | null
  source_sheet?: string | null
  source_row?: number | null
  notes?: string | null
  created_at: string
}

export type AuditLogEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  details?: Record<string, unknown> | null
  performed_by?: string | null
  created_at: string
}

export type ImportBatchRecord = {
  id: string
  imported_at: string
  file_name: string
  file_sha256: string
  records_count: number
  total_investment: number
  total_interest: number
  total_ten_percent: number
  total_dues: number
  total_loans_principal: number
  status: 'preview' | 'committed' | 'rolled_back'
}

export type ImportedMainTransaction = {
  sourceKey: string
  mainSheetNo: number
  date: string
  particulars: string
  mode: 'D' | 'W' | null
  debit: number
  credit: number
  remarks: string | null
  category: '10PCT' | null
  cleared: boolean
}

export type ImportedLedgerSummary = {
  cashInBank: number
  loanReceived: number
  outstanding: number
  creditGrandTotal: number
  investmentTotal: number
  interestTotal: number
  tenPercentTotal: number
  duesTotal: number
  loansPrincipalTotal: number
  workbookTotalLedger: number
  workbookCashInHand: number
  reconciledAvailableCash: number
}

export type ImportedLoan = {
  sourceKey: string
  mainSheetNo: number
  acNo?: number | null
  customerName: string
  mode: 'D' | 'W'
  loanDate: string
  principal: number
  sourceCredit: number
  sourceRemarks: string | null
  cleared: boolean
}

export type ImportedFinanceData = {
  source: { fileName: string; sha256: string; importedAt: string }
  verification: {
    mainRows: number
    dailyCount: number
    dailyPrincipal: number
    dailyMainSheetNos: number[]
    weeklyCount: number
    weeklyPrincipal: number
    weeklyMainSheetNos: number[]
    tenPercentCount: number
    tenPercentProfit: number
    investmentCount: number
    investmentTotal: number
    interestCount: number
    interestTotal: number
    duesCount: number
    duesTotal: number
    totalLoansCount: number
    totalPrincipal: number
  }
  ledgerSummary: ImportedLedgerSummary
  mainTransactions: ImportedMainTransaction[]
  loans: ImportedLoan[]
  investments: InvestmentEntry[]
  interests: InterestEntry[]
  dues: DueReceivableEntry[]
  tenPercentEntries: Array<{
    sourceKey: string
    mainSheetNo: number | null
    date: string
    particulars: string
    amount: number
  }>
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
  // Workbook & Ledger Reconciled Figures
  investmentReceived: number
  interestReceived: number
  outstandingDues: number
  workbookTotalLedger: number
  workbookCashInHand: number
  reconciledAvailableCash: number
  loanReceived: number
  cashInBank: number
  outstanding: number
  creditGrandTotal: number
}

export type NewLoanInput = {
  customer_id?: string
  customer_name: string
  phone?: string
  address?: string
  mode: ModeKind
  loan_date: string
  principal: number
  interest_amount?: number
  interest_rate?: number
  weekly_payment?: number
  total_expected?: number
  total_return?: number
  first_due_date?: string
  ac_no?: number
  main_sheet_no?: number
}

export type NewPaymentInput = {
  loan_id: string
  installment_id?: string
  payment_date?: string
  paid_date?: string
  amount: number
  payment_type: PaymentType
  note?: string
}

export type NewTenPercentEntry = {
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no: number | null
  notes: string | null
}

export type NewInvestmentInput = {
  entry_date: string
  investor_name: string
  amount: number
  notes?: string
}

export type NewInterestInput = {
  entry_date: string
  customer_name: string
  ac_no?: number
  amount: number
  notes?: string
}

export type NewDueInput = {
  due_date: string
  borrower_name: string
  amount: number
  notes?: string
}
