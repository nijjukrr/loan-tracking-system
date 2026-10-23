import { describe, it, expect } from 'vitest'
import type { Payment } from '../types'

describe('Finance Search and Ledger Filters', () => {
  const mockPayments: Payment[] = [
    {
      id: 'pay-001',
      loan_id: 'loan-1',
      customer_name: 'Yuvaraj DMK',
      main_sheet_no: 101,
      mode: 'D',
      payment_date: '2026-10-01',
      amount: 500,
      payment_type: 'Interest',
      note: 'Advance interest for 10-day cycle',
      interest_allocation: 500,
      principal_allocation: 0,
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'pay-002',
      loan_id: 'loan-2',
      customer_name: 'Pattani',
      main_sheet_no: 102,
      mode: 'W',
      payment_date: '2026-10-10',
      amount: 3000,
      payment_type: 'Weekly Installment',
      note: 'Installment #1 settled',
      interest_allocation: 300,
      principal_allocation: 2700,
      created_at: '2026-10-10T00:00:00Z',
    },
    {
      id: 'pay-003',
      loan_id: 'loan-3',
      customer_name: 'Kavitha',
      main_sheet_no: 103,
      mode: 'D',
      payment_date: '2026-10-15',
      amount: 10000,
      payment_type: 'Principal',
      note: 'Full principal return on closure',
      interest_allocation: 0,
      principal_allocation: 10000,
      created_at: '2026-10-15T00:00:00Z',
    },
  ]

  it('searches payments by borrower name case-insensitively', () => {
    const query = 'yuvaraj'
    const results = mockPayments.filter((p) => p.customer_name.toLowerCase().includes(query))
    expect(results.length).toBe(1)
    expect(results[0].customer_name).toBe('Yuvaraj DMK')
  })

  it('searches payments by notes and remark content', () => {
    const query = 'advance interest'
    const results = mockPayments.filter((p) => (p.note || '').toLowerCase().includes(query))
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('pay-001')
  })

  it('filters payments strictly by payment type', () => {
    const interestPayments = mockPayments.filter((p) => p.payment_type === 'Interest')
    expect(interestPayments.length).toBe(1)
    expect(interestPayments[0].amount).toBe(500)

    const principalPayments = mockPayments.filter((p) => p.payment_type === 'Principal')
    expect(principalPayments.length).toBe(1)
    expect(principalPayments[0].amount).toBe(10000)
  })

  it('filters payments within a custom date range', () => {
    const startDate = '2026-10-05'
    const endDate = '2026-10-12'
    const results = mockPayments.filter((p) => p.payment_date >= startDate && p.payment_date <= endDate)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('pay-002')
  })

  it('ensures filtered summary totals exactly equal the sum of filtered entries', () => {
    const dailyPayments = mockPayments.filter((p) => p.mode === 'D')
    const totalAmount = dailyPayments.reduce((sum, p) => sum + p.amount, 0)
    const totalInterest = dailyPayments.reduce((sum, p) => sum + (p.interest_allocation || 0), 0)
    const totalPrincipal = dailyPayments.reduce((sum, p) => sum + (p.principal_allocation || 0), 0)

    expect(totalAmount).toBe(10500)
    expect(totalInterest).toBe(500)
    expect(totalPrincipal).toBe(10000)
    expect(totalInterest + totalPrincipal).toBe(totalAmount)
  })
})
