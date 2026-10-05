import { describe, expect, it } from 'vitest'
import {
  calculateDailyProfit,
  calculateNextDueDate,
  calculateTenPercentProfit,
  calculateWeeklyRealizedProfit,
  computeDashboardMetrics,
  generateDailyInstallments,
  generateWeeklyInstallments,
  getInstallmentStatus,
  validateTenPercentEntry,
} from './financeLogic'
import type { Loan, Payment, TenPercentEntry } from '../types'


describe('financeLogic business rules', () => {
  it('calculates next due date correctly for Daily (+10 days) and Weekly (+7 days)', () => {
    expect(calculateNextDueDate('D', '2026-10-01')).toBe('2026-10-11')
    expect(calculateNextDueDate('W', '2026-10-01')).toBe('2026-10-08')
  })

  it('generates 6 cycles for Daily loans every 10 days', () => {
    const installments = generateDailyInstallments('loan-1', '2026-09-21', '2026-10-01', 300)
    expect(installments.length).toBe(6)
    expect(installments[0].due_date).toBe('2026-10-01')
    expect(installments[1].due_date).toBe('2026-10-11')
    expect(installments[5].due_date).toBe('2026-11-20')
  })

  it('generates 10 weekly installments for Weekly loans every 7 days', () => {
    const installments = generateWeeklyInstallments('loan-w1', '2026-09-27', '2026-10-04', 3000)
    expect(installments.length).toBe(10)
    expect(installments[0].due_date).toBe('2026-10-04')
    expect(installments[1].due_date).toBe('2026-10-11')
    expect(installments[9].due_date).toBe('2026-12-06')
  })

  it('evaluates installment status based on due date and paid amount', () => {
    const today = '2026-10-05'
    expect(getInstallmentStatus('2026-10-01', null, 0, 300, today)).toBe('Overdue')
    expect(getInstallmentStatus('2026-10-05', null, 0, 300, today)).toBe('Due Today')
    expect(getInstallmentStatus('2026-10-10', null, 0, 300, today)).toBe('Upcoming')
    expect(getInstallmentStatus('2026-10-01', '2026-10-01', 300, 300, today)).toBe('Paid')
    expect(getInstallmentStatus('2026-10-01', '2026-10-01', 150, 300, today)).toBe('Partial')
  })

  it('calculates Daily, Weekly, 10% and total profit correctly', () => {
    const payments: Payment[] = [
      {
        id: 'p1',
        loan_id: 'l1',
        customer_name: 'YUVARAJ-DMK',
        main_sheet_no: 3,
        mode: 'D',
        payment_date: '2026-10-01',
        amount: 300,
        payment_type: 'Interest',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const loans: Loan[] = [
      {
        id: 'lw1',
        customer_name: 'AJITH-ANITHA',
        main_sheet_no: 14,
        mode: 'W',
        loan_date: '2026-09-27',
        principal: 27000,
        interest_amount: 0,
        weekly_payment: 3000,
        total_expected: 30000,
        total_collected: 3000,
        remaining_balance: 27000,
        status: 'active',
        created_at: '2026-09-27T00:00:00Z',
        updated_at: '2026-09-27T00:00:00Z',
      },
    ]

    const weeklyPayments: Payment[] = [
      ...payments,
      {
        id: 'p2',
        loan_id: 'lw1',
        customer_name: 'AJITH-ANITHA',
        main_sheet_no: 14,
        mode: 'W',
        payment_date: '2026-10-04',
        amount: 3000,
        payment_type: 'Weekly Installment',
        created_at: '2026-10-04T00:00:00Z',
      },
    ]

    const tenPercentEntries: TenPercentEntry[] = [
      {
        id: 'tp1',
        entry_date: '2026-10-05',
        particulars: 'Bonus',
        amount: 500,
        main_sheet_no: null,
        notes: null,
        source_kind: 'manual',
        main_transaction_id: null,
        created_at: '2026-10-05T00:00:00Z',
      },
    ]

    expect(calculateDailyProfit(weeklyPayments)).toBe(300)
    expect(calculateWeeklyRealizedProfit(loans, weeklyPayments)).toBe(300)
    expect(calculateTenPercentProfit(tenPercentEntries)).toBe(500)

    const metrics = computeDashboardMetrics(loans, [], weeklyPayments, tenPercentEntries, '2026-10-05')
    expect(metrics.dailyMoneyLent).toBe(0)
    expect(metrics.weeklyMoneyLent).toBe(27000)
    expect(metrics.totalMoneyLent).toBe(27000)
    expect(metrics.totalCollected).toBe(3300)
    expect(metrics.totalProfit).toBe(1100)
  })

  it('validates 10% entry fields', () => {
    const invalid = validateTenPercentEntry({ entry_date: '', particulars: ' ', amount: -10 })
    expect(invalid.entry_date).toBeDefined()
    expect(invalid.particulars).toBeDefined()
    expect(invalid.amount).toBeDefined()
  })
})
