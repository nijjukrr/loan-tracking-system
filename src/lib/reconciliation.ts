import type {
  DueReceivableEntry,
  InterestEntry,
  InvestmentEntry,
  Loan,
  TenPercentEntry,
} from '../types'

/**
 * Standard financial reference figures from NISHANTH-2026.xlsx workbook
 * Sheets: PLAN, SEP&OCT, LOAN
 */
export const WORKBOOK_REFERENCE_TARGETS = {
  investmentReceived: 185000,
  interestReceived: 4950,
  tenPercentProfit: 8970,
  outstandingDues: 12000,
  principalIssued: 162000,
  workbookTotalLedger: 210920,
  workbookCashInHand: 48920,
  reconciledAvailableCash: 36920,
} as const

export interface OpeningBalanceRecord {
  id: string
  category: 'INVESTMENT' | 'INTEREST' | 'TEN_PERCENT' | 'DUE' | 'LOAN_PRINCIPAL'
  label: string
  referenceTarget: number
  sourceSheet: string
  itemCount: number
  accountingDefinition: string
  notes: string
}

export const DOCUMENTED_OPENING_BALANCES: OpeningBalanceRecord[] = [
  {
    id: 'ob-inv-185000',
    category: 'INVESTMENT',
    label: 'Partner & Capital Investment',
    referenceTarget: 185000,
    sourceSheet: 'SEP&OCT (Cols P-S)',
    itemCount: 8,
    accountingDefinition: 'Injected equity/capital funds into lending operations. NOT revenue or profit.',
    notes: '8 verified investors: Ponniyan (27k), Sathish (13k), Rathika (50k), Gurusamy (30k), Jyothimani (10k), Sathish-Thand (25k), Sivaraj (10k), Thangaraj (20k).',
  },
  {
    id: 'ob-int-4950',
    category: 'INTEREST',
    label: 'Interest Inflow Received',
    referenceTarget: 4950,
    sourceSheet: 'SEP&OCT (Cols K-N)',
    itemCount: 9,
    accountingDefinition: 'Interest income physically collected from borrowers.',
    notes: '9 verified receipts: Yuvaraj-DMK (500), Pattani (90), Pattani (60), Kavitha (500), Pattani (200), Karuppasamy (1000), Yuvaraj-DMK (500), Prakash (2000), SCM Selvam (100).',
  },
  {
    id: 'ob-ten-8970',
    category: 'TEN_PERCENT',
    label: '10% Profit Received',
    referenceTarget: 8970,
    sourceSheet: 'SEP&OCT (Cols F-I)',
    itemCount: 24,
    accountingDefinition: 'Realized 10% profit payments explicitly categorized. Credits from investments are NOT 10% profit.',
    notes: '24 individual profit transactions totaling exactly ₹8,970 (corrected from erroneous ₹161,010 batch import).',
  },
  {
    id: 'ob-due-12000',
    category: 'DUE',
    label: 'Outstanding Dues (Receivable)',
    referenceTarget: 12000,
    sourceSheet: 'SEP&OCT (Cols A-D)',
    itemCount: 6,
    accountingDefinition: 'Uncollected customer receivables. NOT liquid cash in hand.',
    notes: '6 verified entries: Ajith-1 (3k), Shanthi-1 (1k), Divya (1k), Ajith-2 (3k), Ajith-3 (3k), Shanthi-2 (1k).',
  },
  {
    id: 'ob-prin-162000',
    category: 'LOAN_PRINCIPAL',
    label: 'Loan Principal Disbursed',
    referenceTarget: 162000,
    sourceSheet: 'LOAN',
    itemCount: 17,
    accountingDefinition: 'Total capital loaned out across all active and historical borrower accounts.',
    notes: '17 account rows (12 active loans totaling ₹162,000 principal plus 5 historical zero-amount closed accounts).',
  },
]

export interface CategoryReconciliation {
  category: string
  label: string
  referenceTarget: number
  actualTotal: number
  variance: number // actualTotal - referenceTarget
  isReconciled: boolean
  count: number
  expectedCount: number
  notes: string
}

export interface CashReconciliationReport {
  workbookReportedTotal: number // ₹210,920
  calculatedTotalLedger: number // sum of Inv + Int + Profit + Dues
  totalLedgerVariance: number
  isTotalLedgerReconciled: boolean

  principalDisbursed: number // ₹162,000
  workbookNominalCash: number // ₹48,920 (= ₹210,920 - ₹162,000)
  uncollectedDuesAdjustment: number // ₹12,000
  reconciledAvailableCash: number // ₹36,920 (= ₹48,920 - ₹12,000)
  
  cashVariance: number
  isCashReconciled: boolean
  explanation: string
}

export interface ReconciliationReport {
  generatedAt: string
  categories: {
    investments: CategoryReconciliation
    interests: CategoryReconciliation
    tenPercentProfit: CategoryReconciliation
    outstandingDues: CategoryReconciliation
    principalIssued: CategoryReconciliation
  }
  cashReconciliation: CashReconciliationReport
  allCategoriesReconciled: boolean
  discrepancies: string[]
}

export interface ActualFinancialDatasets {
  investments?: InvestmentEntry[]
  interests?: InterestEntry[]
  tenPercentEntries?: Array<TenPercentEntry | { amount: number }>
  dues?: DueReceivableEntry[]
  loans?: Loan[]
}

/**
 * Reconciles actual data entries against the documented workbook reference figures
 */
export function computeReconciliationReport(
  actuals: ActualFinancialDatasets = {}
): ReconciliationReport {
  const investments = actuals.investments ?? []
  const interests = actuals.interests ?? []
  const tenPercents = actuals.tenPercentEntries ?? []
  const dues = actuals.dues ?? []
  const loans = actuals.loans ?? []

  const actualInv = investments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const actualInt = interests.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const actualTen = tenPercents.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const actualDue = dues.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const actualPrin = loans.reduce((sum, item) => sum + Number(item.principal || 0), 0)

  const discrepancies: string[] = []

  const invRec: CategoryReconciliation = {
    category: 'INVESTMENT',
    label: 'Investment Received',
    referenceTarget: WORKBOOK_REFERENCE_TARGETS.investmentReceived,
    actualTotal: actualInv,
    variance: actualInv - WORKBOOK_REFERENCE_TARGETS.investmentReceived,
    isReconciled: actualInv === WORKBOOK_REFERENCE_TARGETS.investmentReceived,
    count: investments.length,
    expectedCount: 8,
    notes: '8 verified partners totaling ₹1,85,000',
  }
  if (!invRec.isReconciled && investments.length > 0) {
    discrepancies.push(`Investment variance of ₹${Math.abs(invRec.variance).toLocaleString('en-IN')}`)
  }

  const intRec: CategoryReconciliation = {
    category: 'INTEREST',
    label: 'Interest Inflow Received',
    referenceTarget: WORKBOOK_REFERENCE_TARGETS.interestReceived,
    actualTotal: actualInt,
    variance: actualInt - WORKBOOK_REFERENCE_TARGETS.interestReceived,
    isReconciled: actualInt === WORKBOOK_REFERENCE_TARGETS.interestReceived,
    count: interests.length,
    expectedCount: 9,
    notes: '9 interest receipts totaling ₹4,950',
  }
  if (!intRec.isReconciled && interests.length > 0) {
    discrepancies.push(`Interest variance of ₹${Math.abs(intRec.variance).toLocaleString('en-IN')}`)
  }

  const tenRec: CategoryReconciliation = {
    category: 'TEN_PERCENT',
    label: '10% Profit Received',
    referenceTarget: WORKBOOK_REFERENCE_TARGETS.tenPercentProfit,
    actualTotal: actualTen,
    variance: actualTen - WORKBOOK_REFERENCE_TARGETS.tenPercentProfit,
    isReconciled: actualTen === WORKBOOK_REFERENCE_TARGETS.tenPercentProfit,
    count: tenPercents.length,
    expectedCount: 24,
    notes: '24 classified profit entries totaling ₹8,970 (corrected from ₹161,010 misclassification)',
  }
  if (!tenRec.isReconciled && tenPercents.length > 0) {
    discrepancies.push(`10% Profit variance of ₹${Math.abs(tenRec.variance).toLocaleString('en-IN')}`)
  }

  const dueRec: CategoryReconciliation = {
    category: 'DUE',
    label: 'Outstanding Dues (Receivables)',
    referenceTarget: WORKBOOK_REFERENCE_TARGETS.outstandingDues,
    actualTotal: actualDue,
    variance: actualDue - WORKBOOK_REFERENCE_TARGETS.outstandingDues,
    isReconciled: actualDue === WORKBOOK_REFERENCE_TARGETS.outstandingDues,
    count: dues.length,
    expectedCount: 6,
    notes: '6 unpaid dues totaling ₹12,000',
  }
  if (!dueRec.isReconciled && dues.length > 0) {
    discrepancies.push(`Outstanding dues variance of ₹${Math.abs(dueRec.variance).toLocaleString('en-IN')}`)
  }

  const prinRec: CategoryReconciliation = {
    category: 'LOAN_PRINCIPAL',
    label: 'Principal Disbursed',
    referenceTarget: WORKBOOK_REFERENCE_TARGETS.principalIssued,
    actualTotal: actualPrin,
    variance: actualPrin - WORKBOOK_REFERENCE_TARGETS.principalIssued,
    isReconciled: actualPrin === WORKBOOK_REFERENCE_TARGETS.principalIssued,
    count: loans.length,
    expectedCount: 17,
    notes: '17 loan accounts totaling ₹1,62,000 principal issued',
  }
  if (!prinRec.isReconciled && loans.length > 0) {
    discrepancies.push(`Principal variance of ₹${Math.abs(prinRec.variance).toLocaleString('en-IN')}`)
  }

  // Calculated Total Ledger Value: Inv + Int + Ten + Dues
  const calculatedTotalLedger = actualInv + actualInt + actualTen + actualDue
  const totalLedgerVariance = calculatedTotalLedger - WORKBOOK_REFERENCE_TARGETS.workbookTotalLedger
  const isTotalLedgerReconciled = calculatedTotalLedger === WORKBOOK_REFERENCE_TARGETS.workbookTotalLedger

  // Workbook nominal cash = Total Ledger - Principal = 210,920 - 162,000 = 48,920
  // But dues of ₹12,000 are uncollected receivables, not liquid cash!
  // Reconciled available liquid cash = 48,920 - 12,000 = 36,920.
  const calculatedNominalCash = calculatedTotalLedger - actualPrin
  const calculatedAvailableCash = calculatedNominalCash - actualDue
  const cashVariance = calculatedAvailableCash - WORKBOOK_REFERENCE_TARGETS.reconciledAvailableCash

  const cashReconciliation: CashReconciliationReport = {
    workbookReportedTotal: WORKBOOK_REFERENCE_TARGETS.workbookTotalLedger,
    calculatedTotalLedger,
    totalLedgerVariance,
    isTotalLedgerReconciled,
    principalDisbursed: actualPrin,
    workbookNominalCash: WORKBOOK_REFERENCE_TARGETS.workbookCashInHand,
    uncollectedDuesAdjustment: actualDue || WORKBOOK_REFERENCE_TARGETS.outstandingDues,
    reconciledAvailableCash: calculatedAvailableCash,
    cashVariance,
    isCashReconciled: cashVariance === 0,
    explanation:
      'The Excel workbook ledger calculates Cash/Bank as ₹2,10,920 - ₹1,62,000 = ₹48,920. ' +
      'However, this total includes ₹12,000 of uncollected borrower dues. Since unpaid dues are receivables ' +
      'rather than liquid cash, the actual reconciled liquid cash balance is ₹36,920 (₹48,920 nominal - ₹12,000 unpaid dues).',
  }

  const allCategoriesReconciled =
    invRec.isReconciled &&
    intRec.isReconciled &&
    tenRec.isReconciled &&
    dueRec.isReconciled &&
    prinRec.isReconciled &&
    isTotalLedgerReconciled

  return {
    generatedAt: new Date().toISOString(),
    categories: {
      investments: invRec,
      interests: intRec,
      tenPercentProfit: tenRec,
      outstandingDues: dueRec,
      principalIssued: prinRec,
    },
    cashReconciliation,
    allCategoriesReconciled,
    discrepancies,
  }
}

export interface DiscrepancyResolution {
  category: string
  referenceAmount: number
  actualAmount: number
  variance: number
  status: 'reconciled' | 'variance_pending' | 'resolved'
  resolutionNotes: string
}

export function generateDiscrepancyResolutions(report: ReconciliationReport): DiscrepancyResolution[] {
  const categories = [
    { key: 'INVESTMENT', cat: report.categories.investments, note: '8 partner contributions totaling ₹1,85,000' },
    { key: 'INTEREST', cat: report.categories.interests, note: '9 interest receipts totaling ₹4,950' },
    { key: 'TEN_PERCENT', cat: report.categories.tenPercentProfit, note: '24 classified entries totaling ₹8,970' },
    { key: 'DUE', cat: report.categories.outstandingDues, note: '6 customer uncollected receivables totaling ₹12,000' },
    { key: 'LOAN_PRINCIPAL', cat: report.categories.principalIssued, note: '17 loan accounts totaling ₹1,62,000 principal disbursed' },
  ]

  return categories.map(({ key, cat, note }) => ({
    category: key,
    referenceAmount: cat.referenceTarget,
    actualAmount: cat.actualTotal,
    variance: cat.variance,
    status: cat.isReconciled ? 'reconciled' : 'variance_pending',
    resolutionNotes: cat.isReconciled ? `Verified: ${note}` : `Variance of ₹${Math.abs(cat.variance).toLocaleString('en-IN')} requires ledger audit`,
  }))
}
