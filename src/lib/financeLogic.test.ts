import { describe, expect, it } from 'vitest'
import { calculateTenPercentProfit, validateTenPercentEntry } from './financeLogic'
import type { TenPercentEntry } from '../types'

const entry = (amount: number): TenPercentEntry => ({
  id: crypto.randomUUID(),
  entry_date: '2026-10-05',
  particulars: 'Manual entry',
  amount,
  main_sheet_no: null,
  notes: null,
  source_kind: 'manual',
  main_transaction_id: null,
  created_at: '2026-10-05T00:00:00Z',
})

describe('10% profit calculations', () => {
  it('keeps the current imported total at zero when there are no entries', () => {
    expect(calculateTenPercentProfit([])).toBe(0)
  })

  it('adds manual and explicitly tagged amounts', () => {
    expect(calculateTenPercentProfit([entry(50), entry(730), entry(400)])).toBe(1180)
  })
})

describe('10% entry validation', () => {
  it('accepts an omitted Main Sheet No', () => {
    expect(validateTenPercentEntry({ entry_date: '2026-10-05', particulars: 'New profit', amount: 100, main_sheet_no: null, notes: null })).toEqual({})
  })

  it('rejects inferred-looking incomplete data', () => {
    expect(validateTenPercentEntry({ entry_date: '', particulars: ' ', amount: -1, main_sheet_no: 0, notes: null })).toEqual({
      entry_date: 'Date is required.',
      particulars: 'Name or particulars is required.',
      amount: 'Enter an amount greater than zero.',
      main_sheet_no: 'Main Sheet No must be a positive whole number.',
    })
  })
})
