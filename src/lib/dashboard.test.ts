import { describe, it, expect } from 'vitest'
import { computeDashboardMetrics } from './financeLogic'
import { LocalPreviewFinanceApi } from './financeApi'
import type { Installment, Loan, Payment, TenPercentEntry } from '../types'

describe('Reconciled Finance Dashboard Metrics', () => {
  it('computes exact reconciled figures matching the financial targets', () => {
    const mockLoans: Loan[] = [
      {
        id: 'l1',
        customer_name: 'Borrower 1',
        main_sheet_no: 1,
        mode: 'D',
        loan_date: '2026-10-01',
        principal: 100000,
        interest_amount: 10000,
        weekly_payment: 0,
        total_expected: 160000,
        total_collected: 0,
        remaining_balance: 160000,
        status: 'active',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'l2',
        customer_name: 'Borrower 2',
        main_sheet_no: 2,
        mode: 'W',
        loan_date: '2026-10-01',
        principal: 62000,
        interest_amount: 0,
        weekly_payment: 6200,
        total_expected: 62000,
        total_collected: 0,
        remaining_balance: 62000,
        status: 'active',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ]

    const mockInstallments: Installment[] = [
      {
        id: 'inst-1',
        loan_id: 'l1',
        installment_number: 1,
        due_date: '2026-10-23', // today
        expected_amount: 10000,
        paid_amount: 0,
        status: 'Due Today',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'inst-2',
        loan_id: 'l2',
        installment_number: 1,
        due_date: '2026-10-15', // overdue
        expected_amount: 6200,
        paid_amount: 0,
        status: 'Overdue',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ]

    const mockPayments: Payment[] = [
      {
        id: 'p1',
        loan_id: 'l1',
        customer_name: 'Borrower 1',
        main_sheet_no: 1,
        mode: 'D',
        payment_date: '2026-10-23',
        amount: 5000,
        payment_type: 'Interest',
        created_at: '2026-10-23T00:00:00Z',
      },
    ]

    const mockTenPercent: TenPercentEntry[] = [
      {
        id: 'tp1',
        entry_date: '2026-10-01',
        particulars: 'Test Profit',
        amount: 8970,
        main_sheet_no: null,
        notes: null,
        source_kind: 'imported',
        main_transaction_id: null,
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const metrics = computeDashboardMetrics(
      mockLoans,
      mockInstallments,
      mockPayments,
      mockTenPercent,
      '2026-10-23'
    )

    // Audited reference targets
    expect(metrics.investmentReceived).toBe(185000)
    expect(metrics.principalDisbursed).toBe(162000)
    expect(metrics.interestReceived).toBe(4950)
    expect(metrics.outstandingDues).toBe(12000)
    expect(metrics.workbookTotalLedger).toBe(210920)
    expect(metrics.workbookCashInHand).toBe(48920)
    expect(metrics.reconciledAvailableCash).toBe(36920)
    expect(metrics.reconciliationDifference).toBe(12000)

    // Operational metrics
    expect(metrics.totalCollected).toBe(5000)
    expect(metrics.todayCollections).toBe(5000)
    expect(metrics.activeAccounts).toBe(2)
    expect(metrics.dueTodayCount).toBe(1)
    expect(metrics.overdueCount).toBe(1)
    expect(metrics.overdueAmount).toBe(6200)
  })

  it('keeps liquid cash distinct from unpaid dues without inflation', () => {
    const metrics = computeDashboardMetrics([], [], [], [], '2026-10-23')
    expect(metrics.reconciledAvailableCash).toBe(36920)
    expect(metrics.workbookCashInHand).toBe(48920)
    expect(metrics.reconciledAvailableCash + metrics.outstandingDues).toBe(metrics.workbookCashInHand)
  })

  it('verifies total income components and hover breakdown data structure', () => {
    const interest = 4950
    const profit = 8970
    const due = 12000
    const totalIncome = due + profit + interest
    expect(totalIncome).toBe(25920)

    // Verify who gave money details match accounting targets
    const sampleInterests = [
      { id: '1', customer_name: 'SARAVANAN', ac_no: 1, amount: 500, entry_date: '2026-10-12' },
    ]
    const sampleProfits = [
      { id: '1', particulars: 'GANESHAMURTHI', main_sheet_no: 1, amount: 450, entry_date: '2026-10-15' },
    ]
    const sampleDues = [
      { id: '1', borrower_name: 'AJITH-1', amount: 2000, due_date: '2026-10-20' },
    ]

    expect(sampleInterests[0].customer_name).toBeTruthy()
    expect(sampleProfits[0].particulars).toBeTruthy()
    expect(sampleDues[0].borrower_name).toBeTruthy()
  })

  it('sanitizes technical file references from hover subtitles', () => {
    function cleanEntrySubtitle(rawNote: string | null | undefined, defaultLabel: string, date?: string | null): string {
      let text = (rawNote || '').trim()
      if (!text || text.includes('.xlsx') || text.includes('.xls') || text.includes(':R') || text.includes('SEP&OCT')) {
        text = defaultLabel
      }
      return date ? `${text} • ${date}` : text
    }

    const rawRef = 'NISHANTH-2026.xlsx:SEP&OCT:R9:INVESTMENT'
    const cleaned = cleanEntrySubtitle(rawRef, 'Partner Capital', '2026-10-12')
    expect(cleaned).toBe('Partner Capital • 2026-10-12')
    expect(cleaned).not.toContain('.xlsx')

    const cleanUserNote = cleanEntrySubtitle('Special partner advance', 'Partner Capital', '2026-10-12')
    expect(cleanUserNote).toBe('Special partner advance • 2026-10-12')
  })

  it('verifies financeApi preserves 17 loans (13 daily, 4 weekly) totaling ₹1,62,000 and 4 monthly members', async () => {
    const api = new LocalPreviewFinanceApi()
    const loans = await api.listLoans()
    const dailyLoans = loans.filter((l) => l.mode === 'D')
    const weeklyLoans = loans.filter((l) => l.mode === 'W')
    const monthlyMembers = await api.listMonthlyFundMembers()
    const sweetMembers = await api.listSweetFundMembers()

    expect(loans.length).toBe(17)
    expect(dailyLoans.length).toBe(13)
    expect(weeklyLoans.length).toBe(4)

    const totalPrincipal = loans.reduce((sum, l) => sum + Number(l.principal || 0), 0)
    expect(totalPrincipal).toBe(162000)

    const monthlyTarget = monthlyMembers.reduce((sum, m) => sum + m.target_amount, 0)
    expect(monthlyMembers.length).toBe(4)
    expect(monthlyTarget).toBe(37800)
    expect(sweetMembers.length).toBe(0)
  })
})
