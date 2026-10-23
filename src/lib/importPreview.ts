import type {
  DueReceivableEntry,
  ImportedFinanceData,
  InterestEntry,
  InvestmentEntry,
  Loan,
  TenPercentEntry,
} from '../types'

export type DeduplicationReport = {
  totalScanned: number
  newLoansCount: number
  duplicateLoansCount: number
  newInvestmentsCount: number
  duplicateInvestmentsCount: number
  newInterestsCount: number
  duplicateInterestsCount: number
  newProfitsCount: number
  duplicateProfitsCount: number
  newDuesCount: number
  duplicateDuesCount: number
  validationErrors: string[]
  canCommit: boolean
}

export type SafeImportPreview = {
  sourceFileName: string
  sourceSha256: string
  importedAt: string
  summary: {
    investmentTotal: number
    interestTotal: number
    tenPercentTotal: number
    duesTotal: number
    loansPrincipalTotal: number
    workbookTotalLedger: number
    workbookCashInHand: number
    reconciledAvailableCash: number
  }
  deduplication: DeduplicationReport
  staged: {
    loans: ImportedFinanceData['loans']
    investments: InvestmentEntry[]
    interests: InterestEntry[]
    tenPercentEntries: TenPercentEntry[]
    dues: DueReceivableEntry[]
  }
}

export function generateSafeImportPreview(
  imported: ImportedFinanceData,
  existingState: {
    loans?: Loan[]
    investments?: InvestmentEntry[]
    interests?: InterestEntry[]
    tenPercentEntries?: TenPercentEntry[]
    dues?: DueReceivableEntry[]
  }
): SafeImportPreview {
  const existingLoanKeys = new Set((existingState.loans || []).map((l) => l.source_remarks || l.id))
  const existingLoanNamesDates = new Set(
    (existingState.loans || []).map((l) => `${l.customer_name}:${l.loan_date}:${l.principal}`)
  )

  const existingInvestmentKeys = new Set((existingState.investments || []).map((i) => i.source_reference || i.id))
  const existingInterestKeys = new Set((existingState.interests || []).map((i) => i.source_reference || i.id))
  const existingProfitKeys = new Set((existingState.tenPercentEntries || []).map((p) => p.particulars + ':' + p.amount))
  const existingDueKeys = new Set((existingState.dues || []).map((d) => d.source_reference || d.id))

  const validationErrors: string[] = []

  // Analyze loans for duplicates
  let newLoans = 0
  let dupLoans = 0
  for (const loan of imported.loans) {
    const key = `${loan.customerName}:${loan.loanDate}:${loan.principal}`
    if (existingLoanKeys.has(loan.sourceKey) || existingLoanNamesDates.has(key)) {
      dupLoans++
    } else {
      newLoans++
    }
  }

  // Analyze investments for duplicates
  let newInv = 0
  let dupInv = 0
  for (const inv of imported.investments) {
    if (inv.source_reference && existingInvestmentKeys.has(inv.source_reference)) {
      dupInv++
    } else {
      newInv++
    }
  }

  // Analyze interest for duplicates
  let newInt = 0
  let dupInt = 0
  for (const int of imported.interests) {
    if (int.source_reference && existingInterestKeys.has(int.source_reference)) {
      dupInt++
    } else {
      newInt++
    }
  }

  // Analyze profits for duplicates
  let newProf = 0
  let dupProf = 0
  for (const prof of imported.tenPercentEntries) {
    const key = `${prof.particulars}:${prof.amount}`
    if (existingProfitKeys.has(key)) {
      dupProf++
    } else {
      newProf++
    }
  }

  // Analyze dues for duplicates
  let newDues = 0
  let dupDues = 0
  for (const due of imported.dues) {
    if (due.source_reference && existingDueKeys.has(due.source_reference)) {
      dupDues++
    } else {
      newDues++
    }
  }

  // Validation rules
  if (imported.verification.totalPrincipal < 0) {
    validationErrors.push('Total loan principal cannot be negative')
  }
  if (imported.verification.investmentTotal < 0) {
    validationErrors.push('Total investment cannot be negative')
  }

  const stagedTenPercent: TenPercentEntry[] = imported.tenPercentEntries.map(
    (tp: { date: string; particulars: string; amount: number; mainSheetNo: number | null }, idx: number) => ({
      id: `profit-staged-${idx + 1}`,
      entry_date: tp.date,
      particulars: tp.particulars,
      amount: tp.amount,
      main_sheet_no: tp.mainSheetNo,
      notes: 'Imported from workbook',
      source_kind: 'imported',
      main_transaction_id: null,
      created_at: new Date().toISOString(),
    })
  )

  const deduplication: DeduplicationReport = {
    totalScanned:
      imported.loans.length +
      imported.investments.length +
      imported.interests.length +
      imported.tenPercentEntries.length +
      imported.dues.length,
    newLoansCount: newLoans,
    duplicateLoansCount: dupLoans,
    newInvestmentsCount: newInv,
    duplicateInvestmentsCount: dupInv,
    newInterestsCount: newInt,
    duplicateInterestsCount: dupInt,
    newProfitsCount: newProf,
    duplicateProfitsCount: dupProf,
    newDuesCount: newDues,
    duplicateDuesCount: dupDues,
    validationErrors,
    canCommit: validationErrors.length === 0,
  }

  return {
    sourceFileName: imported.source.fileName,
    sourceSha256: imported.source.sha256,
    importedAt: imported.source.importedAt,
    summary: {
      investmentTotal: imported.ledgerSummary.investmentTotal,
      interestTotal: imported.ledgerSummary.interestTotal,
      tenPercentTotal: imported.ledgerSummary.tenPercentTotal,
      duesTotal: imported.ledgerSummary.duesTotal,
      loansPrincipalTotal: imported.ledgerSummary.loansPrincipalTotal,
      workbookTotalLedger: imported.ledgerSummary.workbookTotalLedger,
      workbookCashInHand: imported.ledgerSummary.workbookCashInHand,
      reconciledAvailableCash: imported.ledgerSummary.reconciledAvailableCash,
    },
    deduplication,
    staged: {
      loans: imported.loans,
      investments: imported.investments,
      interests: imported.interests,
      tenPercentEntries: stagedTenPercent,
      dues: imported.dues,
    },
  }
}
