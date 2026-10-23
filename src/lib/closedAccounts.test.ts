import { describe, it, expect, beforeEach } from 'vitest'
import { LocalPreviewFinanceApi } from './financeApi'
import type { NewLoanInput } from '../types'

describe('Closed Account History & Zero-Amount Historical Rows', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(() => {
    api = new LocalPreviewFinanceApi()
  })

  it('preserves existing closed accounts without deleting history', async () => {
    const closedLoans = await api.listLoans({ status: 'closed' })
    expect(Array.isArray(closedLoans)).toBe(true)

    // Ensure all closed loans have status === 'closed'
    for (const loan of closedLoans) {
      expect(loan.status).toBe('closed')
    }
  })

  it('closes an active loan with custom closure remarks', async () => {
    const newLoanInput: NewLoanInput = {
      customer_name: 'Test Borrower For Closure',
      main_sheet_no: 888,
      mode: 'W',
      loan_date: '2026-10-01',
      principal: 10000,
      weekly_payment: 1000,
      total_return: 10000,
      first_due_date: '2026-10-08',
    }

    const created = await api.createLoan(newLoanInput)
    expect(created.status).toBe('active')

    const closed = await api.closeLoan(created.id, 'Account settled via final cash settlement')
    expect(closed.status).toBe('closed')
    expect(closed.closed_at).toBeDefined()
    expect(closed.source_remarks).toContain('Account settled via final cash settlement')

    // Confirm it appears in closed loans list
    const closedList = await api.listLoans({ status: 'closed' })
    expect(closedList.some((l) => l.id === created.id)).toBe(true)

    // Confirm it does NOT appear in active loans list
    const activeList = await api.listLoans({ status: 'active' })
    expect(activeList.some((l) => l.id === created.id)).toBe(false)
  })

  it('handles zero-principal historical rows without errors', async () => {
    const zeroLoanInput: NewLoanInput = {
      customer_name: 'Prakash-ZeroRow',
      main_sheet_no: 999,
      mode: 'D',
      loan_date: '2026-09-01',
      principal: 0,
      interest_amount: 0,
      first_due_date: '2026-09-10',
    }

    const created = await api.createLoan(zeroLoanInput)
    expect(created.principal).toBe(0)

    const closedZero = await api.closeLoan(created.id, 'Historical zero-amount workbook closure')
    expect(closedZero.status).toBe('closed')
    expect(closedZero.principal).toBe(0)
    expect(closedZero.source_remarks).toContain('Historical zero-amount workbook closure')
  })
})
