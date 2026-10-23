import { describe, expect, it } from 'vitest'
import { generateSafeImportPreview } from './importPreview'
import type { ImportedFinanceData, Loan } from '../types'

describe('Safe Import Preview and Deduplication Engine', () => {
  const sampleImport: ImportedFinanceData = {
    source: {
      fileName: 'NISHANTH-2026.xlsx',
      sha256: 'mock-sha-256',
      importedAt: '2026-10-23T10:00:00.000Z',
    },
    verification: {
      mainRows: 17,
      dailyCount: 13,
      dailyPrincipal: 108000,
      dailyMainSheetNos: [1, 2, 3],
      weeklyCount: 4,
      weeklyPrincipal: 54000,
      weeklyMainSheetNos: [8, 9],
      tenPercentCount: 24,
      tenPercentProfit: 8970,
      investmentCount: 8,
      investmentTotal: 185000,
      interestCount: 9,
      interestTotal: 4950,
      duesCount: 6,
      duesTotal: 12000,
      totalLoansCount: 17,
      totalPrincipal: 162000,
    },
    ledgerSummary: {
      cashInBank: 48920,
      loanReceived: 40000,
      outstanding: 166150,
      creditGrandTotal: 210920,
      investmentTotal: 185000,
      interestTotal: 4950,
      tenPercentTotal: 8970,
      duesTotal: 12000,
      loansPrincipalTotal: 162000,
      workbookTotalLedger: 210920,
      workbookCashInHand: 48920,
      reconciledAvailableCash: 36920,
    },
    mainTransactions: [],
    loans: [
      {
        sourceKey: 'NISHANTH-2026.xlsx:LOAN:R3',
        mainSheetNo: 1,
        acNo: 1,
        customerName: 'YUVARAJ-DMK',
        mode: 'D',
        loanDate: '2026-09-21',
        principal: 10000,
        sourceCredit: 0,
        sourceRemarks: null,
        cleared: false,
      },
      {
        sourceKey: 'NISHANTH-2026.xlsx:LOAN:R4',
        mainSheetNo: 2,
        acNo: 2,
        customerName: 'KARUPPASAMY',
        mode: 'D',
        loanDate: '2026-09-21',
        principal: 10000,
        sourceCredit: 0,
        sourceRemarks: null,
        cleared: false,
      },
    ],
    investments: [
      {
        id: 'inv-1',
        entry_date: '2026-09-20',
        investor_name: 'PONNIYAN',
        amount: 27000,
        source_reference: 'NISHANTH-2026.xlsx:SEP&OCT:R3:INVESTMENT',
        notes: null,
        created_at: '2026-09-20T00:00:00Z',
      },
    ],
    interests: [],
    dues: [],
    tenPercentEntries: [
      {
        sourceKey: 'NISHANTH-2026.xlsx:SEP&OCT:R3:PROFIT',
        mainSheetNo: 3,
        date: '2026-09-22',
        particulars: 'GANESHAMURTHI',
        amount: 50,
      },
    ],
  }

  it('marks all records as new when state is empty', () => {
    const preview = generateSafeImportPreview(sampleImport, {})
    expect(preview.deduplication.newLoansCount).toBe(2)
    expect(preview.deduplication.duplicateLoansCount).toBe(0)
    expect(preview.deduplication.newInvestmentsCount).toBe(1)
    expect(preview.deduplication.duplicateInvestmentsCount).toBe(0)
    expect(preview.deduplication.canCommit).toBe(true)
  })

  it('detects duplicate loans and duplicate investments on repeated import', () => {
    const existingLoans: Loan[] = [
      {
        id: 'l-1',
        customer_name: 'YUVARAJ-DMK',
        main_sheet_no: 1,
        mode: 'D',
        loan_date: '2026-09-21',
        principal: 10000,
        interest_amount: 300,
        weekly_payment: 0,
        total_expected: 10000,
        total_collected: 0,
        remaining_balance: 10000,
        status: 'active',
        source_remarks: 'NISHANTH-2026.xlsx:LOAN:R3',
        created_at: '2026-09-21T00:00:00Z',
        updated_at: '2026-09-21T00:00:00Z',
      },
    ]

    const existingInvestments = [
      {
        id: 'inv-1',
        entry_date: '2026-09-20',
        investor_name: 'PONNIYAN',
        amount: 27000,
        source_reference: 'NISHANTH-2026.xlsx:SEP&OCT:R3:INVESTMENT',
        created_at: '2026-09-20T00:00:00Z',
      },
    ]

    const preview = generateSafeImportPreview(sampleImport, {
      loans: existingLoans,
      investments: existingInvestments,
    })

    expect(preview.deduplication.newLoansCount).toBe(1) // Karuppasamy is new
    expect(preview.deduplication.duplicateLoansCount).toBe(1) // Yuvaraj is duplicate
    expect(preview.deduplication.newInvestmentsCount).toBe(0) // Ponniyan already exists
    expect(preview.deduplication.duplicateInvestmentsCount).toBe(1)
    expect(preview.deduplication.canCommit).toBe(true)
  })
})
