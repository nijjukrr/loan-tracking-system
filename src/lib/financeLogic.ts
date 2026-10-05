import type {
  DashboardMetrics,
  Installment,
  InstallmentStatus,
  Loan,
  ModeKind,
  Payment,
  TenPercentEntry,
} from '../types'

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
    .filter((p) => p.mode === 'D' && (p.payment_type === 'Interest' || p.payment_type === 'Partial' || p.payment_type === 'Other'))
    .reduce((sum, p) => sum + p.amount, 0)
}

export function calculateWeeklyRealizedProfit(loans: Loan[], payments: Payment[]): number {
  let profit = 0
  for (const loan of loans) {
    if (loan.mode !== 'W') continue
    const loanPayments = payments.filter((p) => p.loan_id === loan.id)
    const totalCollected = loanPayments.reduce((sum, p) => sum + p.amount, 0)
    
    // For weekly loans, weekly payment is typically principal + interest component (e.g. 27k principal, 30k total expected -> 3k profit over 10 wks)
    // Realized profit per installment = (total_expected - principal) / 10 * paid_installments or excess over principal
    const totalExpected = loan.total_expected || (loan.principal + (loan.weekly_payment * 10 - loan.principal))
    const expectedProfit = Math.max(0, totalExpected - loan.principal)
    if (loan.status === 'closed' || totalCollected >= totalExpected) {
      profit += expectedProfit
    } else {
      // Proportional realized profit based on collections
      const ratio = totalExpected > 0 ? totalCollected / totalExpected : 0
      profit += Math.round(expectedProfit * ratio)
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
  todayStr: string = formatDateISO(new Date())
): DashboardMetrics {
  const dailyLoans = loans.filter((l) => l.mode === 'D')
  const weeklyLoans = loans.filter((l) => l.mode === 'W')

  const dailyMoneyLent = dailyLoans.reduce((sum, l) => sum + l.principal, 0)
  const weeklyMoneyLent = weeklyLoans.reduce((sum, l) => sum + l.principal, 0)
  const totalMoneyLent = dailyMoneyLent + weeklyMoneyLent

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0)

  const dailyProfit = calculateDailyProfit(payments)
  const weeklyProfit = calculateWeeklyRealizedProfit(loans, payments)
  const tenPercentProfit = calculateTenPercentProfit(tenPercentEntries)
  const totalProfit = dailyProfit + weeklyProfit + tenPercentProfit

  const activeAccounts = loans.filter((l) => l.status === 'active').length
  const closedAccounts = loans.filter((l) => l.status === 'closed').length

  const dueTodayCount = installments.filter(
    (inst) => inst.status === 'Due Today' || (inst.due_date === todayStr && inst.paid_amount < inst.expected_amount)
  ).length

  const overdueCount = installments.filter(
    (inst) => inst.status === 'Overdue' || (inst.due_date < todayStr && inst.paid_amount < inst.expected_amount)
  ).length

  return {
    totalMoneyLent,
    dailyMoneyLent,
    weeklyMoneyLent,
    totalCollected,
    totalProfit,
    dailyProfit,
    weeklyProfit,
    tenPercentProfit,
    activeAccounts,
    closedAccounts,
    dueTodayCount,
    overdueCount,
  }
}
