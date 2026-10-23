import { describe, expect, it } from 'vitest'
import {
  DomainValidationError,
  validateDueInput,
  validateInterestInput,
  validateInvestmentInput,
  validateNewLoanInput,
  validatePaymentInput,
  validateTenPercentEntry,
} from './domainValidators'

describe('Domain Validators', () => {
  it('validates loan input successfully', () => {
    expect(() =>
      validateNewLoanInput({
        customer_name: 'YUVARAJ-DMK',
        mode: 'D',
        principal: 10000,
        loan_date: '2026-09-21',
      })
    ).not.toThrow()
  })

  it('rejects invalid loan input', () => {
    expect(() =>
      validateNewLoanInput({
        customer_name: '',
        mode: 'D',
        principal: 10000,
        loan_date: '2026-09-21',
      })
    ).toThrow(DomainValidationError)

    expect(() =>
      validateNewLoanInput({
        customer_name: 'John',
        mode: 'D',
        principal: -500,
        loan_date: '2026-09-21',
      })
    ).toThrow(DomainValidationError)
  })

  it('validates payment input', () => {
    expect(() =>
      validatePaymentInput({
        loan_id: 'l-1',
        payment_date: '2026-10-01',
        amount: 500,
        payment_type: 'Interest',
      })
    ).not.toThrow()

    expect(() =>
      validatePaymentInput({
        loan_id: '',
        payment_date: '2026-10-01',
        amount: 500,
        payment_type: 'Interest',
      })
    ).toThrow(DomainValidationError)
  })

  it('validates investment and interest entries', () => {
    expect(() =>
      validateInvestmentInput({
        investor_name: 'PONNIYAN',
        amount: 27000,
        entry_date: '2026-09-20',
      })
    ).not.toThrow()

    expect(() =>
      validateInterestInput({
        customer_name: 'PATTANI',
        amount: 90,
        entry_date: '2026-10-01',
      })
    ).not.toThrow()

    expect(() =>
      validateDueInput({
        borrower_name: 'AJITH-1',
        amount: 3000,
        due_date: '2026-10-06',
      })
    ).not.toThrow()

    expect(() =>
      validateTenPercentEntry({
        particulars: 'GOVIND',
        amount: 730,
        entry_date: '2026-09-22',
        main_sheet_no: null,
        notes: null,
      })
    ).not.toThrow()
  })
})
