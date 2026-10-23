import { describe, expect, it } from 'vitest'
import { parseFinanceWorkbook } from './import-excel'

const nishanthWorkbookPath = 'C:/Users/nijju/OneDrive/Documents/Nijju acc/NISHANTH-2026.xlsx'
const legacyWorkbookPath = 'C:/Users/nijju/OneDrive/Documents/Nijju acc/nijju2026.xlsx'

describe('verified Excel import of NISHANTH-2026.xlsx', () => {
  it('correctly parses multi-sheet ledger with exact reference targets', async () => {
    const result = await parseFinanceWorkbook(nishanthWorkbookPath)

    // 1. Investment: 8 entries = 185,000
    expect(result.verification.investmentCount).toBe(8)
    expect(result.verification.investmentTotal).toBe(185000)

    // 2. Interest: 9 entries = 4,950
    expect(result.verification.interestCount).toBe(9)
    expect(result.verification.interestTotal).toBe(4950)

    // 3. 10% Profit: 24 entries = 8,970 (Discrepancy resolved from erroneous 161,010)
    expect(result.verification.tenPercentCount).toBe(24)
    expect(result.verification.tenPercentProfit).toBe(8970)

    // 4. Dues: 6 entries = 12,000
    expect(result.verification.duesCount).toBe(6)
    expect(result.verification.duesTotal).toBe(12000)

    // 5. Loans: 17 records = 162,000 principal
    expect(result.verification.totalLoansCount).toBe(17)
    expect(result.verification.totalPrincipal).toBe(162000)

    // 6. Plan summary & cash reconciliation
    expect(result.ledgerSummary.workbookTotalLedger).toBe(210920)
    expect(result.ledgerSummary.workbookCashInHand).toBe(48920)
    expect(result.ledgerSummary.reconciledAvailableCash).toBe(36920) // 48920 - 12000

    // 7. Verify sourceKey traceability on all records
    expect(new Set(result.loans.map((l) => l.sourceKey)).size).toBe(result.loans.length)
    expect(new Set(result.investments.map((i) => i.id)).size).toBe(result.investments.length)
    expect(new Set(result.interests.map((i) => i.id)).size).toBe(result.interests.length)
    expect(new Set(result.dues.map((d) => d.id)).size).toBe(result.dues.length)
  })

  it('supports legacy single-sheet workbooks gracefully', async () => {
    const result = await parseFinanceWorkbook(legacyWorkbookPath)
    expect(result.loans.length).toBeGreaterThan(0)
    expect(new Set(result.loans.map((loan) => loan.sourceKey)).size).toBe(result.loans.length)
  })
})
