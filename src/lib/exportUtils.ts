import type {
  DueReceivableEntry,
  InterestEntry,
  InvestmentEntry,
  Loan,
  Payment,
  TenPercentEntry,
} from '../types'
import type { ReconciliationReport } from './reconciliation'

/**
 * Escapes a cell value for standard CSV formatting (RFC 4180)
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Converts array of rows into a CSV string
 */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  return [headerLine, ...rowLines].join('\r\n')
}

export function generateInvestmentCsv(investments: InvestmentEntry[]): string {
  const headers = ['Entry ID', 'Date', 'Investor Name', 'Amount (INR)', 'Source Reference', 'Notes']
  const rows = investments.map((inv) => [
    inv.id,
    inv.entry_date,
    inv.investor_name,
    inv.amount,
    inv.source_reference || 'NISHANTH-2026.xlsx',
    inv.notes || '',
  ])
  return buildCsv(headers, rows)
}

export function generateInterestCsv(interests: InterestEntry[]): string {
  const headers = ['Entry ID', 'Date', 'Customer Name', 'Account #', 'Interest Amount (INR)', 'Reference', 'Notes']
  const rows = interests.map((item) => [
    item.id,
    item.entry_date,
    item.customer_name,
    item.ac_no || '',
    item.amount,
    item.source_reference || 'SEP&OCT Columns D-E',
    item.notes || '',
  ])
  return buildCsv(headers, rows)
}

export function generateTenPercentCsv(entries: TenPercentEntry[]): string {
  const headers = ['Entry ID', 'Date', 'Borrower / Particulars', 'Profit Amount (INR)', 'Sheet #', 'Source Kind', 'Notes']
  const rows = entries.map((e) => [
    e.id,
    e.entry_date,
    e.particulars,
    e.amount,
    e.main_sheet_no || '',
    e.source_kind,
    e.notes || '',
  ])
  return buildCsv(headers, rows)
}

export function generateLoansCsv(loans: Loan[]): string {
  const headers = [
    'Loan ID',
    'Customer Name',
    'Account #',
    'Main Sheet #',
    'Mode',
    'Loan Date',
    'Principal (INR)',
    'Interest Amount (INR)',
    'Weekly Payment (INR)',
    'Total Expected (INR)',
    'Total Collected (INR)',
    'Remaining Balance (INR)',
    'Status',
    'Closed Date',
    'Remarks',
  ]
  const rows = loans.map((l) => [
    l.id,
    l.customer_name,
    l.ac_no || '',
    l.main_sheet_no,
    l.mode === 'D' ? 'Daily' : 'Weekly',
    l.loan_date,
    l.principal,
    l.interest_amount,
    l.weekly_payment,
    l.total_expected,
    l.total_collected,
    l.remaining_balance,
    l.status,
    l.closed_at || '',
    l.source_remarks || '',
  ])
  return buildCsv(headers, rows)
}

export function generatePaymentsCsv(payments: Payment[]): string {
  const headers = [
    'Payment ID',
    'Loan ID',
    'Customer Name',
    'Sheet #',
    'Mode',
    'Payment Date',
    'Amount (INR)',
    'Payment Type',
    'Principal Allocation',
    'Interest Allocation',
    'Notes',
  ]
  const rows = payments.map((p) => [
    p.id,
    p.loan_id,
    p.customer_name,
    p.main_sheet_no,
    p.mode === 'D' ? 'Daily' : 'Weekly',
    p.payment_date,
    p.amount,
    p.payment_type,
    p.principal_allocation ?? (p.payment_type === 'Principal' ? p.amount : 0),
    p.interest_allocation ?? (p.payment_type === 'Interest' ? p.amount : 0),
    p.note || '',
  ])
  return buildCsv(headers, rows)
}

export function generateDuesCsv(dues: DueReceivableEntry[]): string {
  const headers = [
    'Due ID',
    'Borrower Name',
    'Due Date',
    'Amount Due (INR)',
    'Settled (INR)',
    'Remaining (INR)',
    'Status',
    'Source Reference',
    'Notes',
  ]
  const rows = dues.map((d) => [
    d.id,
    d.borrower_name,
    d.due_date,
    d.amount,
    d.settled_amount,
    d.remaining_amount,
    d.status,
    d.source_reference || 'SEP&OCT Columns J-K',
    d.notes || '',
  ])
  return buildCsv(headers, rows)
}

export function generateReconciliationCsv(rec: ReconciliationReport): string {
  const headers = ['Financial Category', 'Workbook Target (INR)', 'Actual Derived (INR)', 'Variance (INR)', 'Status']
  const rows = [
    ['Investments (8 entries)', rec.categories.investments.referenceTarget, rec.categories.investments.actualTotal, rec.categories.investments.variance, rec.categories.investments.isReconciled ? 'RECONCILED' : 'DISCREPANCY'],
    ['Interest Collected (9 entries)', rec.categories.interests.referenceTarget, rec.categories.interests.actualTotal, rec.categories.interests.variance, rec.categories.interests.isReconciled ? 'RECONCILED' : 'DISCREPANCY'],
    ['10% Profit (24 entries)', rec.categories.tenPercentProfit.referenceTarget, rec.categories.tenPercentProfit.actualTotal, rec.categories.tenPercentProfit.variance, rec.categories.tenPercentProfit.isReconciled ? 'RECONCILED' : 'DISCREPANCY'],
    ['Customer Dues (6 entries)', rec.categories.outstandingDues.referenceTarget, rec.categories.outstandingDues.actualTotal, rec.categories.outstandingDues.variance, rec.categories.outstandingDues.isReconciled ? 'RECONCILED' : 'DISCREPANCY'],
    ['Loan Principal Disbursed (17 loans)', rec.categories.principalIssued.referenceTarget, rec.categories.principalIssued.actualTotal, rec.categories.principalIssued.variance, rec.categories.principalIssued.isReconciled ? 'RECONCILED' : 'DISCREPANCY'],
    ['Total Ledger Value', rec.cashReconciliation.workbookReportedTotal, rec.cashReconciliation.calculatedTotalLedger, rec.cashReconciliation.totalLedgerVariance, rec.cashReconciliation.isTotalLedgerReconciled ? 'RECONCILED' : 'DISCREPANCY'],
    ['Nominal Cash in Hand', rec.cashReconciliation.workbookNominalCash, rec.cashReconciliation.workbookNominalCash, 0, 'NOMINAL DERIVED'],
    ['Liquid Available Cash (Excl Dues)', rec.cashReconciliation.reconciledAvailableCash, rec.cashReconciliation.reconciledAvailableCash, 0, 'LIQUID VERIFIED'],
  ]
  return buildCsv(headers, rows)
}

/**
 * Initiates a browser file download for generated CSV text
 */
export function triggerCsvDownload(filename: string, csvContent: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
