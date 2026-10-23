import { describe, expect, it } from 'vitest'
import {
  computeReconciliationReport,
  DOCUMENTED_OPENING_BALANCES,
} from './reconciliation'
import type { DueReceivableEntry, InterestEntry, InvestmentEntry, Loan } from '../types'

describe('Reconciliation Domain Service', () => {
  it('documents all 5 opening balance categories correctly', () => {
    expect(DOCUMENTED_OPENING_BALANCES).toHaveLength(5)
    const totalTarget = DOCUMENTED_OPENING_BALANCES.reduce((sum, item) => sum + item.referenceTarget, 0)
    // 185000 + 4950 + 8970 + 12000 + 162000 = 372920
    expect(totalTarget).toBe(372920)
  })

  it('computes exact reconciliation when verified datasets match workbook targets', () => {
    const now = new Date().toISOString()

    const mockInvestments: InvestmentEntry[] = [
      { id: '1', entry_date: '2026-09-01', investor_name: 'Ponniyan', amount: 27000, created_at: now },
      { id: '2', entry_date: '2026-09-01', investor_name: 'Sathish', amount: 13000, created_at: now },
      { id: '3', entry_date: '2026-09-01', investor_name: 'Rathika', amount: 50000, created_at: now },
      { id: '4', entry_date: '2026-09-01', investor_name: 'Gurusamy', amount: 30000, created_at: now },
      { id: '5', entry_date: '2026-09-01', investor_name: 'Jyothimani', amount: 10000, created_at: now },
      { id: '6', entry_date: '2026-09-01', investor_name: 'Sathish-Thand', amount: 25000, created_at: now },
      { id: '7', entry_date: '2026-09-01', investor_name: 'Sivaraj', amount: 10000, created_at: now },
      { id: '8', entry_date: '2026-09-01', investor_name: 'Thangaraj', amount: 20000, created_at: now },
    ]

    const mockInterests: InterestEntry[] = [
      { id: '1', entry_date: '2026-09-01', customer_name: 'Yuvaraj-DMK', amount: 500, created_at: now },
      { id: '2', entry_date: '2026-09-01', customer_name: 'Pattani', amount: 90, created_at: now },
      { id: '3', entry_date: '2026-09-01', customer_name: 'Pattani', amount: 60, created_at: now },
      { id: '4', entry_date: '2026-09-01', customer_name: 'Kavitha', amount: 500, created_at: now },
      { id: '5', entry_date: '2026-09-01', customer_name: 'Pattani', amount: 200, created_at: now },
      { id: '6', entry_date: '2026-09-01', customer_name: 'Karuppasamy', amount: 1000, created_at: now },
      { id: '7', entry_date: '2026-09-01', customer_name: 'Yuvaraj-DMK', amount: 500, created_at: now },
      { id: '8', entry_date: '2026-09-01', customer_name: 'Prakash', amount: 2000, created_at: now },
      { id: '9', entry_date: '2026-09-01', customer_name: 'SCM Selvam', amount: 100, created_at: now },
    ]

    const mockTenPercents = [{ amount: 8970 }]

    const mockDues: DueReceivableEntry[] = [
      { id: '1', due_date: '2026-09-01', borrower_name: 'Ajith-1', amount: 3000, settled_amount: 0, remaining_amount: 3000, status: 'unpaid', created_at: now },
      { id: '2', due_date: '2026-09-01', borrower_name: 'Shanthi-1', amount: 1000, settled_amount: 0, remaining_amount: 1000, status: 'unpaid', created_at: now },
      { id: '3', due_date: '2026-09-01', borrower_name: 'Divya', amount: 1000, settled_amount: 0, remaining_amount: 1000, status: 'unpaid', created_at: now },
      { id: '4', due_date: '2026-09-01', borrower_name: 'Ajith-2', amount: 3000, settled_amount: 0, remaining_amount: 3000, status: 'unpaid', created_at: now },
      { id: '5', due_date: '2026-09-01', borrower_name: 'Ajith-3', amount: 3000, settled_amount: 0, remaining_amount: 3000, status: 'unpaid', created_at: now },
      { id: '6', due_date: '2026-09-01', borrower_name: 'Shanthi-2', amount: 1000, settled_amount: 0, remaining_amount: 1000, status: 'unpaid', created_at: now },
    ]

    const mockLoans = [
      { id: 'l1', principal: 162000 } as Loan,
    ]

    const report = computeReconciliationReport({
      investments: mockInvestments,
      interests: mockInterests,
      tenPercentEntries: mockTenPercents,
      dues: mockDues,
      loans: mockLoans,
    })

    expect(report.categories.investments.isReconciled).toBe(true)
    expect(report.categories.investments.actualTotal).toBe(185000)
    expect(report.categories.interests.isReconciled).toBe(true)
    expect(report.categories.interests.actualTotal).toBe(4950)
    expect(report.categories.tenPercentProfit.isReconciled).toBe(true)
    expect(report.categories.tenPercentProfit.actualTotal).toBe(8970)
    expect(report.categories.outstandingDues.isReconciled).toBe(true)
    expect(report.categories.outstandingDues.actualTotal).toBe(12000)
    expect(report.categories.principalIssued.isReconciled).toBe(true)
    expect(report.categories.principalIssued.actualTotal).toBe(162000)

    expect(report.cashReconciliation.isTotalLedgerReconciled).toBe(true)
    expect(report.cashReconciliation.calculatedTotalLedger).toBe(210920)
    expect(report.cashReconciliation.workbookNominalCash).toBe(48920)
    expect(report.cashReconciliation.uncollectedDuesAdjustment).toBe(12000)
    expect(report.cashReconciliation.reconciledAvailableCash).toBe(36920)
    expect(report.cashReconciliation.isCashReconciled).toBe(true)
    expect(report.allCategoriesReconciled).toBe(true)
    expect(report.discrepancies).toHaveLength(0)
  })

  it('correctly reports variance and flags discrepancies when totals differ', () => {
    const report = computeReconciliationReport({
      investments: [{ id: '1', entry_date: '2026-09-01', investor_name: 'Test', amount: 100000, created_at: new Date().toISOString() }],
      interests: [],
      tenPercentEntries: [],
      dues: [],
      loans: [],
    })

    expect(report.categories.investments.isReconciled).toBe(false)
    expect(report.categories.investments.variance).toBe(-85000)
    expect(report.allCategoriesReconciled).toBe(false)
    expect(report.discrepancies.length).toBeGreaterThan(0)
  })
})
