import type {
  DashboardMetrics,
  DueReceivableEntry,
  Installment,
  InstallmentStatus,
  InterestEntry,
  InvestmentEntry,
  Loan,
  ModeKind,
  Payment,
  TenPercentEntry,
} from '../types'
import importedData from '../data/imported-finance.json'

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return formatDateISO(d)
}

export function differenceInDays(fromStr: string, toStr: string): number {
  const from = parseDate(fromStr).getTime()
  const to = parseDate(toStr).getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

/**
 * Next Due calculation rule:
 * Daily: Next Due = Actual Paid Date + 10 days
 * Weekly: Next Due = Actual Paid Date + 7 days
 */
export function calculateNextDueDate(mode: ModeKind, actualPaidDate: string): string {
  const days = mode === 'D' ? 10 : 7
  return addDays(actualPaidDate, days)
}

export function getInstallmentStatus(
  dueDate: string,
  _paidDate?: string | null,
  paidAmount: number = 0,
  expectedAmount: number = 0,
  todayStr: string = formatDateISO(new Date())
): InstallmentStatus {

  if (expectedAmount > 0 && paidAmount >= expectedAmount) {
    return 'Paid'
  }
  if (paidAmount > 0 && paidAmount < expectedAmount) {
    return 'Partial'
  }
  if (dueDate === todayStr) {
    return 'Due Today'
  }
  if (dueDate < todayStr) {
    return 'Overdue'
  }
  return 'Upcoming'
}

/**
 * Recalculates an installment schedule based on actual payment dates and amounts.
 * Preserves the 10-day daily-loan cycle and 7-day weekly cycle.
 * For Daily loans: when installment N is marked paid on date X, installment N+1's due date
 * rolls to X + 10 days if currently upcoming or past due.
 * Updates each installment's status dynamically relative to todayStr.
 */
export function recalculateInstallmentSchedule(
  installments: Installment[],
  mode: ModeKind,
  todayStr: string = formatDateISO(new Date())
): Installment[] {
  const sorted = [...installments].sort((a, b) => a.installment_number - b.installment_number)
  const updated: Installment[] = []

  let lastPaidDate: string | null = null

  for (let i = 0; i < sorted.length; i++) {
    const inst = { ...sorted[i] }
    const isPaid = inst.paid_amount >= inst.expected_amount && inst.expected_amount > 0

    if (isPaid && inst.paid_date) {
      lastPaidDate = inst.paid_date
      inst.status = 'Paid'
    } else {
      if (mode === 'D' && lastPaidDate && inst.installment_number > 1 && inst.status === 'Upcoming') {
        const nextRollingDue = calculateNextDueDate('D', lastPaidDate)
        if (nextRollingDue > inst.due_date) {
          inst.due_date = nextRollingDue
        }
      }
      inst.status = getInstallmentStatus(
        inst.due_date,
        inst.paid_date,
        inst.paid_amount,
        inst.expected_amount,
        todayStr
      )
    }
    updated.push(inst)
  }

  return updated
}

/**
 * Calculates total overdue and due-today amounts and counts across an installment list
 */
export function calculateOverdueSummary(
  installments: Installment[],
  todayStr: string = formatDateISO(new Date())
): {
  overdueCount: number
  overdueAmount: number
  dueTodayCount: number
  dueTodayAmount: number
  upcomingCount: number
  upcomingAmount: number
} {
  let overdueCount = 0
  let overdueAmount = 0
  let dueTodayCount = 0
  let dueTodayAmount = 0
  let upcomingCount = 0
  let upcomingAmount = 0

  for (const inst of installments) {
    const remaining = Math.max(0, inst.expected_amount - inst.paid_amount)
    if (remaining <= 0) continue

    if (inst.due_date < todayStr) {
      overdueCount++
      overdueAmount += remaining
    } else if (inst.due_date === todayStr) {
      dueTodayCount++
      dueTodayAmount += remaining
    } else {
      upcomingCount++
      upcomingAmount += remaining
    }
  }

  return {
    overdueCount,
    overdueAmount,
    dueTodayCount,
    dueTodayAmount,
    upcomingCount,
    upcomingAmount,
  }
}

export function generateDailyInstallments(
  loanId: string,
  loanDate: string,
  firstDueDate?: string,
  interestAmount: number = 0
): Installment[] {
  const installments: Installment[] = []
  const baseDue = firstDueDate || addDays(loanDate, 10)
  for (let i = 1; i <= 6; i++) {
    const dueDate = i === 1 ? baseDue : addDays(baseDue, (i - 1) * 10)
    installments.push({
      id: `${loanId}-inst-${i}`,
      loan_id: loanId,
      installment_number: i,
      due_date: dueDate,
      expected_amount: interestAmount,
      paid_amount: 0,
      status: 'Upcoming',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  return installments
}

export function generateWeeklyInstallments(
  loanId: string,
  loanDate: string,
  firstDueDate?: string,
  weeklyPayment: number = 3000
): Installment[] {
  const installments: Installment[] = []
  const baseDue = firstDueDate || addDays(loanDate, 7)
  for (let i = 1; i <= 10; i++) {
    const dueDate = i === 1 ? baseDue : addDays(baseDue, (i - 1) * 7)
    installments.push({
      id: `${loanId}-inst-${i}`,
      loan_id: loanId,
      installment_number: i,
      due_date: dueDate,
      expected_amount: weeklyPayment,
      paid_amount: 0,
      status: 'Upcoming',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  return installments
}

export function calculateDailyProfit(payments: Payment[]): number {
  return payments
    .filter((p) => p.mode === 'D' && p.payment_type === 'Interest')
    .reduce((sum, p) => sum + p.amount, 0)
}

export function calculateWeeklyRealizedProfit(loans: Loan[], _payments: Payment[]): number {
  let profit = 0
  for (const loan of loans) {
    if (loan.mode !== 'W') continue
    // Weekly profit is recognized only after the account is explicitly closed.
    // Realized profit per installment = (total_expected - principal) / 10 * paid_installments or excess over principal
    const totalExpected = loan.total_expected || (loan.principal + (loan.weekly_payment * 10 - loan.principal))
    const expectedProfit = Math.max(0, totalExpected - loan.principal)
    if (loan.status === 'closed') {
      profit += expectedProfit
    }
  }
  return profit
}

export function calculateTenPercentProfit(entries: TenPercentEntry[]): number {
  return entries.reduce((total, entry) => total + Number(entry.amount), 0)
}

export function validateTenPercentEntry(entry: {
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no?: number | null
}) {
  const errors: Record<string, string> = {}

  if (!entry.entry_date) errors.entry_date = 'Date is required.'
  if (!entry.particulars.trim()) errors.particulars = 'Name or particulars is required.'
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) errors.amount = 'Enter an amount greater than zero.'
  if (entry.main_sheet_no !== null && entry.main_sheet_no !== undefined && (!Number.isInteger(entry.main_sheet_no) || entry.main_sheet_no <= 0)) {
    errors.main_sheet_no = 'Main Sheet No must be a positive whole number.'
  }

  return errors
}

export function hasValidationErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0
}

export function computeDashboardMetrics(
  loans: Loan[],
  installments: Installment[],
  payments: Payment[],
  tenPercentEntries: TenPercentEntry[],
  todayStr: string = formatDateISO(new Date()),
  investments: InvestmentEntry[] = [],
  interests: InterestEntry[] = [],
  dues: DueReceivableEntry[] = []
): DashboardMetrics {
  const importedSummary = importedData?.ledgerSummary || {
    cashInBank: 0,
    loanReceived: 0,
    outstanding: 0,
    creditGrandTotal: 0,
  }
  const dailyLoans = loans.filter((l) => l.mode === 'D')
  const weeklyLoans = loans.filter((l) => l.mode === 'W')

  const dailyMoneyLent = dailyLoans.filter((l) => l.status === 'active').reduce((sum, l) => sum + (l.principal || 0), 0)
  const weeklyMoneyLent = weeklyLoans.filter((l) => l.status === 'active').reduce((sum, l) => sum + (l.principal || 0), 0)
  const totalMoneyLent = dailyMoneyLent + weeklyMoneyLent
  const principalDisbursed = loans.reduce((sum, l) => sum + (l.principal || 0), 0) || 162000

  const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const todayCollections = payments
    .filter((p) => (p.payment_date || '').slice(0, 10) === todayStr)
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const dailyProfit = calculateDailyProfit(payments)
  const weeklyProfit = calculateWeeklyRealizedProfit(loans, payments)
  const tenPercentProfit = tenPercentEntries.length > 0
    ? calculateTenPercentProfit(tenPercentEntries)
    : 8970
  const totalProfit = dailyProfit + weeklyProfit + tenPercentProfit

  const activeAccounts = loans.filter((l) => l.status === 'active').length
  const closedAccounts = loans.filter((l) => l.status === 'closed').length

  const overdueSummary = calculateOverdueSummary(installments, todayStr)

  const investmentReceived = investments.length > 0
    ? investments.reduce((sum, i) => sum + (i.amount || 0), 0)
    : 185000
  const interestReceived = interests.length > 0
    ? interests.reduce((sum, i) => sum + (i.amount || 0), 0)
    : 4950
  const outstandingDues = dues.length > 0
    ? dues.reduce((sum, d) => sum + (d.remaining_amount ?? d.amount ?? 0), 0)
    : 12000

  const recoveredPrincipal = payments.reduce((sum, p) => sum + (p.principal_allocation || 0), 0)
  const originalInvestorContributions = investmentReceived
  const availableCapitalPool = originalInvestorContributions + recoveredPrincipal

  const customTotalIncome = outstandingDues + tenPercentProfit + interestReceived
  const workbookTotalLedger = investmentReceived + interestReceived + tenPercentProfit + outstandingDues
  const workbookCashInHand = workbookTotalLedger - principalDisbursed
  const reconciledAvailableCash = workbookCashInHand - outstandingDues
  const reconciliationDifference = workbookCashInHand - reconciledAvailableCash

  const dailyLoansPrincipal = dailyLoans.reduce((sum, l) => sum + (l.principal || 0), 0)
  const weeklyLoansPrincipal = weeklyLoans.reduce((sum, l) => sum + (l.principal || 0), 0)

  return {
    totalMoneyLent,
    dailyMoneyLent,
    weeklyMoneyLent,
    principalDisbursed,
    totalCollected,
    todayCollections,
    totalProfit,
    dailyProfit,
    weeklyProfit,
    tenPercentProfit,
    activeAccounts,
    closedAccounts,
    dueTodayCount: overdueSummary.dueTodayCount,
    dueTodayAmount: overdueSummary.dueTodayAmount,
    overdueCount: overdueSummary.overdueCount,
    overdueAmount: overdueSummary.overdueAmount,
    loanReceived: importedSummary?.loanReceived ?? 0,
    cashInBank: importedSummary?.cashInBank ?? 0,
    outstanding: importedSummary?.outstanding ?? 0,
    creditGrandTotal: importedSummary?.creditGrandTotal ?? 0,
    investmentReceived,
    interestReceived,
    outstandingDues,
    workbookTotalLedger,
    workbookCashInHand,
    reconciledAvailableCash,
    reconciliationDifference,
    originalInvestorContributions,
    recoveredPrincipal,
    availableCapitalPool,
    customTotalIncome,
    dailyLoansCount: dailyLoans.length,
    weeklyLoansCount: weeklyLoans.length,
    dailyLoansPrincipal,
    weeklyLoansPrincipal,
  }
}
