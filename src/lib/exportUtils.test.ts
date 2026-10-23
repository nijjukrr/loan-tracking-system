import { describe, it, expect } from 'vitest'
import {
  escapeCsvCell,
  generateDuesCsv,
  generateInterestCsv,
  generateInvestmentCsv,
  generateLoansCsv,
  generatePaymentsCsv,
  generateReconciliationCsv,
  generateTenPercentCsv,
} from './exportUtils'
import type { DueReceivableEntry, InterestEntry, InvestmentEntry, Loan, Payment, TenPercentEntry } from '../types'
import { computeReconciliationReport } from './reconciliation'

describe('Financial Reports & CSV Exports', () => {
  it('correctly escapes CSV cells according to RFC 4180', () => {
    expect(escapeCsvCell(null)).toBe('""')
    expect(escapeCsvCell(undefined)).toBe('""')
    expect(escapeCsvCell(185000)).toBe('"185000"')
    expect(escapeCsvCell('Simple Text')).toBe('"Simple Text"')
    expect(escapeCsvCell('Text with, comma')).toBe('"Text with, comma"')
    expect(escapeCsvCell('Quote "test" here')).toBe('"Quote ""test"" here"')
    expect(escapeCsvCell('Multi\nLine')).toBe('"Multi\nLine"')
  })

  it('generates valid Investment CSV format', () => {
    const mockInv: InvestmentEntry[] = [
      { id: 'inv-1', entry_date: '2026-10-01', investor_name: 'Ponniyan', amount: 27000, created_at: '' },
      { id: 'inv-2', entry_date: '2026-10-02', investor_name: 'Rathika', amount: 50000, created_at: '' },
    ]
    const csv = generateInvestmentCsv(mockInv)
    expect(csv).toContain('"Investor Name"')
    expect(csv).toContain('"Ponniyan"')
    expect(csv).toContain('"27000"')
    expect(csv).toContain('"Rathika"')
    expect(csv).toContain('"50000"')
  })

  it('generates valid Interest CSV format', () => {
    const mockInt: InterestEntry[] = [
      { id: 'int-1', entry_date: '2026-10-01', customer_name: 'Yuvaraj-DMK', amount: 500, created_at: '' },
    ]
    const csv = generateInterestCsv(mockInt)
    expect(csv).toContain('"Interest Amount (INR)"')
    expect(csv).toContain('"Yuvaraj-DMK"')
    expect(csv).toContain('"500"')
  })

  it('generates valid 10% Profit CSV format', () => {
    const mockTp: TenPercentEntry[] = [
      { id: 'tp-1', entry_date: '2026-10-01', particulars: 'Sathish', amount: 8970, main_sheet_no: null, notes: null, source_kind: 'imported', main_transaction_id: null, created_at: '' },
    ]
    const csv = generateTenPercentCsv(mockTp)
    expect(csv).toContain('"Profit Amount (INR)"')
    expect(csv).toContain('"8970"')
  })

  it('generates valid Loans CSV including zero-amount historical rows', () => {
    const mockLoans: Loan[] = [
      {
        id: 'l-1',
        customer_name: 'Prakash-Closed',
        main_sheet_no: 1,
        mode: 'D',
        loan_date: '2026-09-01',
        principal: 0,
        interest_amount: 0,
        weekly_payment: 0,
        total_expected: 0,
        total_collected: 0,
        remaining_balance: 0,
        status: 'closed',
        source_remarks: 'CLOSED IN SOURCE',
        created_at: '',
        updated_at: '',
      },
    ]
    const csv = generateLoansCsv(mockLoans)
    expect(csv).toContain('"Prakash-Closed"')
    expect(csv).toContain('"0"')
    expect(csv).toContain('"closed"')
    expect(csv).toContain('"CLOSED IN SOURCE"')
  })

  it('generates valid Payments CSV format with allocation splits', () => {
    const mockPayments: Payment[] = [
      {
        id: 'pay-001',
        loan_id: 'l-1',
        customer_name: 'Pattani',
        main_sheet_no: 101,
        mode: 'W',
        payment_date: '2026-10-10',
        amount: 3000,
        payment_type: 'Weekly Installment',
        principal_allocation: 2700,
        interest_allocation: 300,
        created_at: '',
      },
    ]
    const csv = generatePaymentsCsv(mockPayments)
    expect(csv).toContain('"Payment ID"')
    expect(csv).toContain('"Pattani"')
    expect(csv).toContain('"3000"')
    expect(csv).toContain('"2700"')
    expect(csv).toContain('"300"')
  })

  it('generates valid Dues CSV format for customer receivables', () => {
    const mockDues: DueReceivableEntry[] = [
      {
        id: 'due-001',
        borrower_name: 'Ajith-1',
        due_date: '2026-10-01',
        amount: 3000,
        settled_amount: 0,
        remaining_amount: 3000,
        status: 'unpaid',
        created_at: '',
      },
    ]
    const csv = generateDuesCsv(mockDues)
    expect(csv).toContain('"Due ID"')
    expect(csv).toContain('"Ajith-1"')
    expect(csv).toContain('"3000"')
    expect(csv).toContain('"unpaid"')
  })

  it('generates valid Reconciliation Audit CSV with nominal vs liquid cash distinction', () => {
    const report = computeReconciliationReport({
      investments: [{ id: '1', entry_date: '', investor_name: '', amount: 185000, created_at: '' }],
      interests: [{ id: '1', entry_date: '', customer_name: '', amount: 4950, created_at: '' }],
      tenPercentEntries: [{ id: '1', entry_date: '', particulars: '', amount: 8970, main_sheet_no: null, notes: null, source_kind: 'imported', main_transaction_id: null, created_at: '' }],
      dues: [{ id: '1', borrower_name: '', due_date: '', amount: 12000, settled_amount: 0, remaining_amount: 12000, status: 'unpaid', created_at: '' }],
      loans: [{ id: '1', customer_name: '', main_sheet_no: 1, mode: 'D', loan_date: '', principal: 162000, interest_amount: 0, weekly_payment: 0, total_expected: 162000, total_collected: 0, remaining_balance: 162000, status: 'active', created_at: '', updated_at: '' }],
    })
    const csv = generateReconciliationCsv(report)
    expect(csv).toContain('"Nominal Cash in Hand"')
    expect(csv).toContain('"48920"')
    expect(csv).toContain('"Liquid Available Cash (Excl Dues)"')
    expect(csv).toContain('"36920"')
  })
})
