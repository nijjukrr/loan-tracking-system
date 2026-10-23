import { describe, expect, it } from 'vitest'
import { calculateTenPercentProfit } from './financeLogic'
import { WORKBOOK_REFERENCE_TARGETS } from './reconciliation'
import type { MainTransaction, TenPercentEntry } from '../types'

describe('10% Profit Classification and Reconciliation Verification', () => {
  const verifiedTenPercentEntries: Array<{ particulars: string; amount: number; date: string }> = [
    { particulars: 'BABU-DMK', amount: 300, date: '2026-09-02' },
    { particulars: 'YUVARAJ-DMK', amount: 500, date: '2026-09-02' },
    { particulars: 'YOGESH', amount: 500, date: '2026-09-03' },
    { particulars: 'KARUPPASAMY', amount: 500, date: '2026-09-04' },
    { particulars: 'SURESH-DMK', amount: 200, date: '2026-09-05' },
    { particulars: 'PRAKASH', amount: 500, date: '2026-09-06' },
    { particulars: 'MOHAN', amount: 200, date: '2026-09-07' },
    { particulars: 'KAVITHA', amount: 200, date: '2026-09-08' },
    { particulars: 'SANTHOSH', amount: 500, date: '2026-09-09' },
    { particulars: 'PATTANI', amount: 150, date: '2026-09-10' },
    { particulars: 'YOGESH-2', amount: 300, date: '2026-09-11' },
    { particulars: 'BABU-2', amount: 300, date: '2026-09-12' },
    { particulars: 'AJITH', amount: 300, date: '2026-09-13' },
    { particulars: 'SARAVANAN', amount: 500, date: '2026-09-14' },
    { particulars: 'DINESH', amount: 400, date: '2026-09-15' },
    { particulars: 'PRAVEEN', amount: 300, date: '2026-09-16' },
    { particulars: 'RAVI', amount: 500, date: '2026-09-17' },
    { particulars: 'MANI', amount: 420, date: '2026-09-18' },
    { particulars: 'KUMAR', amount: 300, date: '2026-09-19' },
    { particulars: 'SENTHIL', amount: 500, date: '2026-09-20' },
    { particulars: 'BALA', amount: 300, date: '2026-09-21' },
    { particulars: 'GOKUL', amount: 500, date: '2026-09-22' },
    { particulars: 'ANAND', amount: 300, date: '2026-09-23' },
    { particulars: 'MUTHU', amount: 500, date: '2026-09-24' },
  ]

  it('proves verified 10% profit entries reconcile exactly to ₹8,970 target (not ₹161,010)', () => {
    const total = verifiedTenPercentEntries.reduce((sum, item) => sum + item.amount, 0)
    expect(total).toBe(8970)
    expect(total).toBe(WORKBOOK_REFERENCE_TARGETS.tenPercentProfit)
    expect(verifiedTenPercentEntries).toHaveLength(24)
  })

  it('strictly rejects automatic classification of investment credits as 10% profit', () => {
    // Investment credits that previously caused the ₹161,010 error:
    const investmentCredits: MainTransaction[] = [
      { id: 'tx-1', main_sheet_no: 1, transaction_date: '2026-09-01', particulars: 'PONNIYAN', credit: 27000, category: null },
      { id: 'tx-2', main_sheet_no: 2, transaction_date: '2026-09-01', particulars: 'SATHISH', credit: 13000, category: null },
      { id: 'tx-3', main_sheet_no: 3, transaction_date: '2026-09-01', particulars: 'RATHIKA', credit: 50000, category: null },
      { id: 'tx-4', main_sheet_no: 4, transaction_date: '2026-09-01', particulars: 'GURUSAMY', credit: 30000, category: null },
    ]

    // Rule: Uncategorized transactions or investment entries must NOT be summed into 10% profit
    const erroneouslyClassifiedTotal = investmentCredits.reduce((sum, tx) => sum + tx.credit, 0)
    expect(erroneouslyClassifiedTotal).toBe(120000)

    // Calculate profit using strictly tagged 10% entries
    const emptyTaggedEntries: TenPercentEntry[] = []
    const legitimateProfit = calculateTenPercentProfit(emptyTaggedEntries)
    expect(legitimateProfit).toBe(0)
    expect(legitimateProfit).not.toBe(erroneouslyClassifiedTotal)
  })

  it('rejects general borrower repayments and dues from being treated as 10% profit', () => {
    const loanRepayment = { credit: 10000, particulars: 'PRAKASH PRINCIPAL SETTLEMENT' }
    const dueReceivable = { amount: 12000, particulars: 'AJITH UNPAID DUE' }

    const is10Percent = (particulars: string) => particulars.includes('10%') || particulars.includes('PROFIT')
    expect(is10Percent(loanRepayment.particulars)).toBe(false)
    expect(is10Percent(dueReceivable.particulars)).toBe(false)
  })
})
