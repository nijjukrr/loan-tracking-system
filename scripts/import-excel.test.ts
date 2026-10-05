import { describe, expect, it } from 'vitest'
import { parseFinanceWorkbook } from './import-excel'

const workbookPath = 'C:/Users/nijju/OneDrive/Documents/Nijju acc/nijju2026.xlsx'

describe('verified Excel import', () => {
  it('extracts the source rows and verified loan totals without guessing 10 percent entries', async () => {
    const result = await parseFinanceWorkbook(workbookPath)
    expect(result.verification).toMatchObject({
      mainRows: 29,
      dailyCount: 8,
      dailyPrincipal: 125000,
      dailyMainSheetNos: [3, 4, 8, 15, 23, 24, 25, 29],
      weeklyCount: 1,
      weeklyPrincipal: 27000,
      weeklyMainSheetNos: [14],
      tenPercentCount: 0,
      tenPercentProfit: 0,
    })
    expect(new Set(result.loans.map((loan) => loan.sourceKey)).size).toBe(result.loans.length)
  })
})
